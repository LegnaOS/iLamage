import apng2gif 	from './apng2gif'
import apng2webp 	from './apng2webp'
import apng2pngs 	from './apng2pngs'  // APNG 转 PNG 序列帧
import apng2jpgs 	from './apng2jpgs'  // APNG 转 JPG 序列帧
import apngCompress from './apngCompress'
import gif2apng 	from './gif2apng'
import gif2pngs     from './gif2pngs'  // GIF 直接转 PNG 序列（快速）
import PNGs2apng 	from './pngs2apng'
import pngs2webp    from './pngs2webp' // PNG 序列直接转 WEBP（快速）
import webp2apng 	from './webp2apng'
import lottie2pngs 	from './lottie2pngs'
import svga2pngs 	from './svga2pngs'
import video2pngsWebAV from './video2pngs-webav' // WebAV 优先（WebM/MP4/VAP），自动降级到 FFmpeg
import webm2pngsWebAV from './webm2pngs-webav' // WebM WebAV 版本（兼容旧代码）
import webm2pngsFFmpeg from './webm2pngs' // FFmpeg 版本（降级使用）
import pag2pngs from './pag2pngs' // PAG 转 PNG 序列
import Action 		from './action'
import fs 			from 'fs-extra'
import path 		from 'path'
import TYPE 		from '../../store/enum/type'

export default function (store, sameOutputPath, locale) {
  // console.log(locale)
  var action = new Action(store)
	// var promise=null;
  var itemPromises = []

  // console.log(sameOutputPath);
  for (var i = 0; i < action.items.length; i++) {
    let item = action.items[i]
    // let item = JSON.parse(JSON.stringify(action.items[i]))
    var promise = null

    // 统一输出到目录
    if (sameOutputPath) {
      item.basic.outputPath = sameOutputPath
    }

    store.dispatch('editProcess', {
      index: item.index,
      text: locale.startConvert + '...',
      schedule: 0.1
    })

    switch (item.basic.type) {
      case TYPE.PNGs:
        // 优化：如果只输出序列帧，跳过 APNG 组装
        const onlySequenceFrames_PNGs = item.options.outputFormat.every(
          fmt => fmt === TYPE.PNG_SEQ || fmt === TYPE.JPG_SEQ
        )

        if (onlySequenceFrames_PNGs) {
          console.log('[PNGs] Only sequence frames requested, skipping APNG assembly')
          promise = apng2other(item, store, locale)
        } else {
          // 保存原始的 PNG 序列文件列表（PNGs2apng 会修改它）
          const originalFileList = [...item.basic.fileList]
          const originalDelays = item.options.delays ? [...item.options.delays] : null

          console.log('[PNGs] Saving original fileList:', originalFileList.length, 'frames')

          promise = PNGs2apng(item, store, locale).then(() => {
            // 恢复原始文件列表，供 apng2other 中的快速路径使用
            item.basic.originalFileList = originalFileList
            item.basic.originalDelays = originalDelays

            console.log('[PNGs] Restored originalFileList:', item.basic.originalFileList.length, 'frames')

            return apng2other(item, store, locale)
          })
        }
        break

      case TYPE.GIF: {
        // 检查输出格式
        const onlySequenceFrames = item.options.outputFormat.every(
          fmt => fmt === TYPE.PNG_SEQ || fmt === TYPE.JPG_SEQ
        )

        // 检查是否不需要 APNG（可以跳过 APNG 组装）
        const needsApng = item.options.outputFormat.some(
          fmt => fmt === TYPE.APNG || fmt === TYPE.GIF
        )

        console.log('[GIF] Output formats:', item.options.outputFormat)
        console.log('[GIF] Only sequence frames:', onlySequenceFrames)
        console.log('[GIF] Needs APNG:', needsApng)

        // 如果只输出序列帧或 WEBP，强制使用 WebAV（最快）
        const preferWebAV = store.getters.preferWebAV || onlySequenceFrames || !needsApng

        if (preferWebAV && typeof VideoDecoder !== 'undefined') {
          // 使用 WebAV 处理 GIF（直接解码为 PNG 序列）
          promise = video2pngsWebAV(item, store, locale).then(() => {
            console.log('[GIF] WebAV completed, checking if should skip APNG assembly...')
            console.log('[GIF] needsApng:', needsApng)

            // 保存原始的 PNG 序列文件列表（无论是否组装 APNG）
            const originalFileList = [...item.basic.fileList]
            const originalDelays = item.options.delays ? [...item.options.delays] : null

            if (!needsApng) {
              console.log('[GIF] No APNG/GIF output needed, skipping APNG assembly')
              console.log('[GIF] Saving originalFileList for direct WEBP conversion:', originalFileList.length, 'frames')

              // 保存原始文件列表，供 apng2webp 使用
              item.basic.originalFileList = originalFileList
              item.basic.originalDelays = originalDelays

              // 直接调用 apng2other 处理 WEBP/序列帧输出
              return apng2other(item, store, locale)
            }

            console.log('[GIF] Saving original fileList:', originalFileList.length, 'frames')
            console.log('[GIF] Need APNG/GIF, assembling APNG...')

            return PNGs2apng(item, store, locale).then(() => {
              // 恢复原始文件列表，供 apng2other 中的快速路径使用
              item.basic.originalFileList = originalFileList
              item.basic.originalDelays = originalDelays

              console.log('[GIF] Restored originalFileList:', item.basic.originalFileList.length, 'frames')

              // 调用 apng2other 处理其他格式输出
              return apng2other(item, store, locale)
            })
          })
        } else {
          // 降级到传统方案
          if (onlySequenceFrames || !needsApng) {
            // 只输出序列帧或不需要 APNG：使用 gif2pngs（FFmpeg 直接提取，快速）
            console.log('[GIF] Using gif2pngs (FFmpeg), onlySequenceFrames:', onlySequenceFrames, 'needsApng:', needsApng)
            promise = gif2pngs(item, store, locale).then(() => {
              // gif2pngs 已经将 item.basic.type 改为 'PNGs'

              // 保存原始文件列表，供 apng2webp 使用
              const originalFileList = [...item.basic.fileList]
              const originalDelays = item.options.delays ? [...item.options.delays] : null

              console.log('[GIF] Saving originalFileList for direct WEBP conversion:', originalFileList.length, 'frames')
              item.basic.originalFileList = originalFileList
              item.basic.originalDelays = originalDelays

              // 直接调用 apng2other 处理 WEBP/序列帧输出
              return apng2other(item, store, locale)
            })
          } else {
            // 需要 APNG/GIF：使用传统 gif2apng
            console.log('[GIF] Need APNG/GIF, using traditional gif2apng path')
            promise = gif2apng(item, store, locale).then(() => {
              // 保存原始的 PNG 序列文件列表（PNGs2apng 会修改它）
              const originalFileList = [...item.basic.fileList]
              const originalDelays = item.options.delays ? [...item.options.delays] : null

              console.log('[GIF] Saving original fileList:', originalFileList.length, 'frames')

              return PNGs2apng(item, store, locale).then(() => {
                // 恢复原始文件列表，供 apng2other 中的快速路径使用
                item.basic.originalFileList = originalFileList
                item.basic.originalDelays = originalDelays

                console.log('[GIF] Restored originalFileList:', item.basic.originalFileList.length, 'frames')

                // 调用 apng2other 处理其他格式输出
                return apng2other(item, store, locale)
              })
            })
          }
        }
        break
      }

      case TYPE.APNG:
        // 优化：如果只输出序列帧，跳过压缩，直接分解
        const onlySequenceFrames_APNG = item.options.outputFormat.every(
          fmt => fmt === TYPE.PNG_SEQ || fmt === TYPE.JPG_SEQ
        )

        if (onlySequenceFrames_APNG) {
          console.log('[APNG] Only sequence frames requested, skipping compression')
          promise = apng2other(item, store, locale)
        } else {
          promise = apngCompress(item, 0, store, locale).then(() => {
            return apng2other(item, store, locale)
          })
        }
        break

      case TYPE.WEBP:
        promise = webp2apng(item, store, locale).then(() => {
          // webp2apng 已经保存了 originalFileList 并调用了 PNGs2apng
          // 现在 fileList[0] 是 APNG 文件，originalFileList 是 PNG 序列

          console.log('[WEBP] After webp2apng, outputFormat:', item.options.outputFormat)
          console.log('[WEBP] fileList length:', item.basic.fileList?.length)
          console.log('[WEBP] originalFileList length:', item.basic.originalFileList?.length)

          // 优化：如果只输出序列帧，跳过 APNG 组装（避免不必要的转换）
          const onlySequenceFrames = item.options.outputFormat.every(
            fmt => fmt === TYPE.PNG_SEQ || fmt === TYPE.JPG_SEQ
          )

          console.log('[WEBP] onlySequenceFrames:', onlySequenceFrames)

          if (onlySequenceFrames) {
            console.log('[WEBP] Only sequence frames requested, using originalFileList')
            // 直接调用 apng2other 处理序列帧输出
            return apng2other(item, store, locale)
          }

          // webp2apng 已经调用了 PNGs2apng 并保存了 originalFileList
          // 直接调用 apng2other 处理其他格式输出
          console.log('[WEBP] Using originalFileList from webp2apng:', item.basic.originalFileList?.length, 'frames')
          return apng2other(item, store, locale)
        })
        break

      case TYPE.LOTTIE:
        promise = lottie2pngs(item, store, locale).then(() => {
          // lottie2pngs 已经将 item.basic.type 改为 'PNGs'

          // 优化：如果只输出序列帧，跳过 APNG 组装（避免不必要的转换）
          const onlySequenceFrames = item.options.outputFormat.every(
            fmt => fmt === TYPE.PNG_SEQ || fmt === TYPE.JPG_SEQ
          )

          if (onlySequenceFrames) {
            console.log('[Lottie] Only sequence frames requested, skipping APNG assembly')
            // 直接调用 apng2other 处理序列帧输出
            return apng2other(item, store, locale)
          }

          // 保存原始的 PNG 序列文件列表（PNGs2apng 会修改它）
          const originalFileList = [...item.basic.fileList]
          const originalDelays = item.options.delays ? [...item.options.delays] : null

          console.log('[Lottie] Saving original fileList:', originalFileList.length, 'frames')

          // 需要 APNG/GIF/WEBP，正常组装
          return PNGs2apng(item, store, locale).then(() => {
            // 恢复原始文件列表，供 apng2other 中的快速路径使用
            item.basic.originalFileList = originalFileList
            item.basic.originalDelays = originalDelays

            console.log('[Lottie] Restored originalFileList:', item.basic.originalFileList.length, 'frames')

            // 调用 apng2other 处理其他格式输出
            return apng2other(item, store, locale)
          })
        })
        break

      case TYPE.SVGA:
        promise = svga2pngs(item, store, locale).then(() => {
          // svga2pngs 已经将 item.basic.type 改为 'PNGs'

          // 优化：如果只输出序列帧，跳过 APNG 组装（避免不必要的转换）
          const onlySequenceFrames = item.options.outputFormat.every(
            fmt => fmt === TYPE.PNG_SEQ || fmt === TYPE.JPG_SEQ
          )

          if (onlySequenceFrames) {
            console.log('[SVGA] Only sequence frames requested, skipping APNG assembly')
            // 直接调用 apng2other 处理序列帧输出
            return apng2other(item, store, locale)
          }

          // 需要 APNG/GIF/WEBP，正常组装
          // 保存原始的 PNG 序列文件列表（PNGs2apng 会修改它）
          const originalFileList = [...item.basic.fileList]
          const originalDelays = item.options.delays ? [...item.options.delays] : null

          console.log('[SVGA] Saving original fileList:', originalFileList.length, 'frames')

          return PNGs2apng(item, store, locale).then(() => {
            // 恢复原始文件列表，供 apng2other 中的快速路径使用
            item.basic.originalFileList = originalFileList
            item.basic.originalDelays = originalDelays

            console.log('[SVGA] Restored originalFileList:', item.basic.originalFileList.length, 'frames')

            // 调用 apng2other 处理其他格式输出
            return apng2other(item, store, locale)
          })
        })
        break

      case TYPE.WEBM:
      case TYPE.MP4:
      case TYPE.VAP:
      case TYPE.AVIF:
      case TYPE.MOV:
      case TYPE.MPEG:
      case TYPE.FLV: {
        // 根据配置选择解码器（WebAV 优先，FFmpeg 降级）
        const preferWebAV = store.getters.preferWebAV
        const video2pngs = preferWebAV ? video2pngsWebAV : webm2pngsFFmpeg

        promise = video2pngs(item, store, locale).then(() => {
          // video2pngs 已经将 item.basic.type 改为 'PNGs'

          // 优化：如果只输出序列帧，跳过 APNG 组装
          const onlySequenceFrames = item.options.outputFormat.every(
            fmt => fmt === TYPE.PNG_SEQ || fmt === TYPE.JPG_SEQ
          )

          if (onlySequenceFrames) {
            console.log('[Video] Only sequence frames requested, skipping APNG assembly')
            // 直接调用 apng2other 处理序列帧输出
            return apng2other(item, store, locale)
          }

          // 保存原始的 PNG 序列文件列表（PNGs2apng 会修改它）
          const originalFileList = [...item.basic.fileList]
          const originalDelays = item.options.delays ? [...item.options.delays] : null

          console.log('[Video] Saving original fileList:', originalFileList.length, 'frames')

          return PNGs2apng(item, store, locale).then(() => {
            // 恢复原始文件列表，供 apng2other 中的快速路径使用
            item.basic.originalFileList = originalFileList
            item.basic.originalDelays = originalDelays

            console.log('[Video] Restored originalFileList:', item.basic.originalFileList.length, 'frames')

            // 调用 apng2other 处理其他格式输出
            return apng2other(item, store, locale)
          })
        })
        break
      }

      case TYPE.PAG:
        promise = pag2pngs(item, store, locale).then(() => {
          // pag2pngs 已经将 item.basic.type 改为 'PNGs'

          // 优化：如果只输出序列帧，跳过 APNG 组装
          const onlySequenceFrames = item.options.outputFormat.every(
            fmt => fmt === TYPE.PNG_SEQ || fmt === TYPE.JPG_SEQ
          )

          if (onlySequenceFrames) {
            console.log('[PAG] Only sequence frames requested, skipping APNG assembly')
            // 直接调用 apng2other 处理序列帧输出
            return apng2other(item, store, locale)
          }

          // 保存原始的 PNG 序列文件列表（PNGs2apng 会修改它）
          const originalFileList = [...item.basic.fileList]
          const originalDelays = item.options.delays ? [...item.options.delays] : null

          console.log('[PAG] Saving original fileList:', originalFileList.length, 'frames')

          return PNGs2apng(item, store, locale).then(() => {
            // 恢复原始文件列表，供 apng2other 中的快速路径使用
            item.basic.originalFileList = originalFileList
            item.basic.originalDelays = originalDelays

            console.log('[PAG] Restored originalFileList:', item.basic.originalFileList.length, 'frames')

            // 调用 apng2other 处理其他格式输出
            return apng2other(item, store, locale)
          })
        }).catch((error) => {
          // 捕获 PAG 文件取消错误（用户需要手动导出）
          if (error && error.isPAGCancelled) {
            console.log('PAG file processing cancelled by user')
            return Promise.resolve() // 正常结束，不抛出错误
          }
          // 其他错误继续抛出
          throw error
        })
        break
    }
    itemPromises.push(promise)
  }

  // 使用 Promise.allSettled 而不是 Promise.all
  // 这样即使某些任务失败，其他任务也能继续执行
  return Promise.allSettled(itemPromises).then((results) => {
    // 清理临时目录
    for (var i = 0; i < action.items.length; i++) {
      fs.remove(action.items[i].basic.tmpDir);
    }

    // 检查结果
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected' && (!r.reason || !r.reason.cancelled)).length
    const cancelled = results.filter(r =>
      r.status === 'rejected' && r.reason && r.reason.cancelled
    ).length

    console.log(`Tasks completed: ${succeeded} succeeded, ${failed} failed, ${cancelled} cancelled`)

    // 如果有任务被取消，更新所有未完成任务的状态
    if (cancelled > 0) {
      results.forEach((result, index) => {
        if (result.status === 'rejected' && result.reason && result.reason.cancelled) {
          store.dispatch('editProcess', {
            index: index,
            text: locale.convertCancelled || '已取消',
            schedule: -1
          })
        }
      })
    }

    // 解锁（允许用户继续操作）
    store.dispatch('setLock', false)
  }).catch((error) => {
    // 确保即使出错也解锁
    console.error('Processor error:', error)
    store.dispatch('setLock', false)
    throw error
  })
}
function apng2other (item, store, locale) {
  // 检查是否已取消
  if (store.state.cancelled) {
    console.log('[apng2other] Task cancelled before start')
    return Promise.reject({ cancelled: true })
  }

  var funcArr = []
  var hasApng = false

  // 优化：如果源是 PNG 序列，先处理序列帧和 WEBP 输出（不需要等待 APNG 组装）
  const isPNGSequence = item.basic.type === 'PNGs'
  const hasSequenceOutput = item.options.outputFormat.some(
    fmt => fmt === TYPE.PNG_SEQ || fmt === TYPE.JPG_SEQ
  )
  const hasWebpOutput = item.options.outputFormat.includes(TYPE.WEBP)

  console.log('[apng2other] item.basic.type:', item.basic.type)
  console.log('[apng2other] isPNGSequence:', isPNGSequence)
  console.log('[apng2other] hasSequenceOutput:', hasSequenceOutput)
  console.log('[apng2other] hasWebpOutput:', hasWebpOutput)
  console.log('[apng2other] outputFormat:', item.options.outputFormat)
  console.log('[apng2other] fileList length:', item.basic.fileList?.length)
  console.log('[apng2other] originalFileList length:', item.basic.originalFileList?.length)

  // 使用原始的 PNG 序列文件列表（如果存在）
  // PNGs2apng 会修改 item.basic.fileList，但会保存原始列表到 item.basic.originalFileList
  const originalFileList = item.basic.originalFileList || (isPNGSequence ? [...item.basic.fileList] : null)
  const originalDelays = item.basic.originalDelays || (isPNGSequence ? (item.options.delays ? [...item.options.delays] : null) : null)

  if (isPNGSequence && (hasSequenceOutput || hasWebpOutput)) {
    console.log('[apng2other] Source is PNG sequence, processing fast outputs first (parallel)...')

    // 先处理序列帧输出（并行，不等待 APNG）
    // WEBP 使用原来的 apng2webp（它会检测 originalFileList 并跳过 apngdis）
    item.options.outputFormat.forEach((el) => {
      if (el === TYPE.PNG_SEQ) {
        // 临时恢复原始文件列表（apng2pngs 需要它）
        if (originalFileList && originalFileList.length > 0) {
          const savedFileList = item.basic.fileList
          item.basic.fileList = originalFileList
          funcArr.push(apng2pngs(item, store, locale).then(() => {
            // 恢复修改后的文件列表
            item.basic.fileList = savedFileList
          }))
        } else {
          funcArr.push(apng2pngs(item, store, locale))
        }
      } else if (el === TYPE.JPG_SEQ) {
        // 临时恢复原始文件列表（apng2jpgs 需要它）
        if (originalFileList && originalFileList.length > 0) {
          const savedFileList = item.basic.fileList
          item.basic.fileList = originalFileList
          funcArr.push(apng2jpgs(item, store, locale).then(() => {
            // 恢复修改后的文件列表
            item.basic.fileList = savedFileList
          }))
        } else {
          funcArr.push(apng2jpgs(item, store, locale))
        }
      }
      // WEBP 不在这里处理，让它走正常流程（apng2webp 会检测 originalFileList）
    })
  }

  // 只在需要 APNG/GIF/WEBP 时才修改 fileList[0]
  // 避免破坏 PNG 序列的文件列表
  const needsApngFile = item.options.outputFormat.some(
    fmt => fmt === TYPE.APNG || fmt === TYPE.GIF || fmt === TYPE.WEBP
  )

  if (needsApngFile) {
    item.basic.fileList[0] = path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')
  }

  // 处理其他格式（APNG/GIF/WEBP）
  item.options.outputFormat.forEach((el, index) => {
    switch (el) {
      case TYPE.APNG:
        fs.copySync(
				path.join(item.basic.tmpOutputDir, item.options.outputName + '.png'),
				path.join(item.basic.outputPath, item.options.outputName + '.png')
			)
        break

      case TYPE.GIF:
        funcArr.push(apng2gif(item, store, locale).then(() => {
          return fs.copy(
					path.join(item.basic.tmpOutputDir, item.options.outputName + '.gif'),
					path.join(item.basic.outputPath, item.options.outputName + '.gif')
				)
        }))
        break

      case TYPE.WEBP:
        // apng2webp 会自动检测 originalFileList 并跳过 apngdis
        funcArr.push(apng2webp(item, store, locale).then(() => {
          fs.copySync(
					path.join(item.basic.tmpOutputDir, item.options.outputName + '.webp'),
					path.join(item.basic.outputPath, item.options.outputName + '.webp')
				)
        }))
        break

      case TYPE.PNG_SEQ:
        // 如果已经在上面处理过（PNG 序列优化），跳过
        if (!(isPNGSequence && hasSequenceOutput)) {
          funcArr.push(apng2pngs(item, store, locale))
        }
        break

      case TYPE.JPG_SEQ:
        // 如果已经在上面处理过（PNG 序列优化），跳过
        if (!(isPNGSequence && hasSequenceOutput)) {
          funcArr.push(apng2jpgs(item, store, locale))
        }
        break
    }
    // MtaH5.clickStat(item.basic.type + "-" + el)  // 腾讯统计 - 已移除
  })
	// copy tempdir file to output dir
  return Promise.all(funcArr).then(() => {
		// delete tmp dir
    // return fs.remove(item.basic.tmpOutputDir)
    // MtaH5.clickStat('1')  // 腾讯统计 - 已移除

    // 检查是否有质量警告
    let successText = locale.convertSuccess + '！'
    if (item.qualityWarning) {
      successText += ' (质量可能未达到目标)'
    }

    store.dispatch('editProcess', {
      index: item.index,
      text: successText,
      schedule: 1
    })
  })
}
