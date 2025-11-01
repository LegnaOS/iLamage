import fs from 'fs-extra'
import path from 'path'
import action from './action'
import apngCompress from './apngCompress'
import { exec } from 'child_process'
import { promisify } from 'util'
import logger from '../logger'

const execAsync = promisify(exec)

/**
 * 检测 FFmpeg 是否可用
 */
async function detectFFmpeg() {
  const ffmpegPath = window.storage.getItem('ffmpegPath')

  // 1. 优先使用用户配置的路径
  if (ffmpegPath && ffmpegPath.trim() !== '') {
    try {
      await execAsync(`"${ffmpegPath}" -version`)
      console.log('[FFmpeg] Using configured path:', ffmpegPath)
      return ffmpegPath
    } catch (err) {
      console.warn('[FFmpeg] Configured path not working:', ffmpegPath)
    }
  }

  // 2. 尝试系统 FFmpeg
  try {
    await execAsync('ffmpeg -version')
    console.log('[FFmpeg] Found system ffmpeg')
    return 'ffmpeg'
  } catch (err) {
    // 3. macOS Homebrew 路径
    try {
      await execAsync('/opt/homebrew/bin/ffmpeg -version')
      console.log('[FFmpeg] Found Homebrew ffmpeg')
      return '/opt/homebrew/bin/ffmpeg'
    } catch (err2) {
      console.log('[FFmpeg] Not found')
      return null
    }
  }
}

/**
 * 使用 FFmpeg 组装 APNG（快速）
 */
async function assembleWithFFmpeg(item, tmpDir, frameCount, frameRate, store, locale) {
  logger.info('pngs2apng', 'Attempting FFmpeg assembly...')

  const ffmpegPath = await detectFFmpeg()
  if (!ffmpegPath) {
    logger.error('pngs2apng', 'FFmpeg not available')
    throw new Error('FFmpeg not available')
  }

  logger.info('pngs2apng', 'FFmpeg path:', ffmpegPath)

  const outputPath = path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')
  // 使用固定 6 位数字（支持最多 999,999 帧）
  const inputPattern = path.join(tmpDir, `apng%06d.png`)

  logger.info('pngs2apng', 'Output path:', outputPath)
  logger.info('pngs2apng', 'Input pattern:', inputPattern)

  // FFmpeg 命令：组装 APNG
  // -framerate: 输入帧率
  // -i: 输入文件模式
  // -plays: 循环次数（0 = 无限循环）
  // -f apng: 强制输出格式为 APNG
  // -pix_fmt rgba: 保留透明度（仅当原视频有 Alpha 时）
  const loopCount = item.options.loop === 0 ? 0 : item.options.loop

  // 检查原视频是否有 Alpha 通道
  const hasAlpha = item.basic.hasAlpha === true

  // 关键：只在原视频有 Alpha 时使用 -pix_fmt rgba
  let command
  if (hasAlpha) {
    console.log('[FFmpeg] Source has alpha channel, using -pix_fmt rgba')
    command = `"${ffmpegPath}" -framerate ${frameRate} -i "${inputPattern}" -pix_fmt rgba -plays ${loopCount} -f apng "${outputPath}"`
  } else {
    console.log('[FFmpeg] Source has no alpha channel, using default pixel format')
    command = `"${ffmpegPath}" -framerate ${frameRate} -i "${inputPattern}" -plays ${loopCount} -f apng "${outputPath}"`
  }

  console.log(`[FFmpeg] Assembling APNG with command:`, command)

  store.dispatch('editProcess', {
    index: item.index,
    text: `Assembling ${frameCount} frames (FFmpeg)...`,
    schedule: 0.5
  })

  const startTime = Date.now()
  logger.info('pngs2apng', 'Executing FFmpeg command...')

  try {
    await execAsync(command)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    logger.info('pngs2apng', `FFmpeg APNG assembled in ${elapsed}s`)
    return outputPath
  } catch (err) {
    logger.error('pngs2apng', 'FFmpeg assembly failed:', err.message)
    throw err
  }
}

export default function (item, store, locale) {
  logger.info('pngs2apng', '=== PNGs to APNG Start ===')
  logger.info('pngs2apng', 'Input files:', item.basic.fileList.length, 'frames')
  logger.info('pngs2apng', 'First file:', item.basic.fileList[0])
  logger.info('pngs2apng', 'Frame rate:', item.options.frameRate)
  logger.info('pngs2apng', 'Has delays:', !!item.options.delays)

  // 检查是否已取消
  if (store.state.cancelled) {
    logger.warn('pngs2apng', 'Task cancelled before start')
    return Promise.reject({ cancelled: true })
  }

  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing + '...',
    schedule: 0.4
  })

	// 优化：检查文件是否已经在正确位置，避免不必要的复制
  var tmpDir = item.basic.tmpDir
  // 使用固定 6 位数字（支持最多 999,999 帧）
  fs.ensureDirSync(tmpDir)
  var firstPNG = 'apng000001.png'

  // 检查文件是否需要复制
  const needsCopy = item.basic.fileList.some((file, index) => {
    const frameNumber = String(index + 1).padStart(6, '0')
    const targetPath = path.join(tmpDir, `apng${frameNumber}.png`)
    return file !== targetPath
  })

  let copyPromise
  if (needsCopy) {
    console.log(`[pngs2apng] Copying ${item.basic.fileList.length} frames to temp dir...`)
    console.log(`[pngs2apng] First file: ${item.basic.fileList[0]}`)
    console.log(`[pngs2apng] Target dir: ${tmpDir}`)
    console.log(`[pngs2apng] Has delays: ${!!item.options.delays}`)

    // 并行复制所有文件
    const copyPromises = item.basic.fileList.map((file, index) => {
      const frameNumber = String(index + 1).padStart(6, '0')
      const targetPath = path.join(tmpDir, `apng${frameNumber}.png`)

      // 检查源和目标是否相同，避免 "Source and destination must not be the same" 错误
      const fileCopyPromise = (file === targetPath)
        ? Promise.resolve()
        : fs.copy(file, targetPath).catch(err => {
            console.error(`[pngs2apng] Failed to copy frame ${index + 1}:`, err.message)
            throw err
          })

      // 如果有延时配置，也异步写入
      if (item.options.delays && item.options.delays[index]) {
        const delayPath = path.join(tmpDir, `apng${frameNumber}.txt`)
        const delayContent = "delay=" + item.options.delays[index]*1000+"/1000"
        return Promise.all([
          fileCopyPromise,
          fs.writeFile(delayPath, delayContent).catch(err => {
            console.error(`[pngs2apng] Failed to write delay file ${index + 1}:`, err.message)
            throw err
          })
        ])
      }

      return fileCopyPromise
    })

    copyPromise = Promise.all(copyPromises).then(() => {
      console.log(`[pngs2apng] Successfully copied ${item.basic.fileList.length} frames`)
    }).catch(err => {
      console.error(`[pngs2apng] Copy failed:`, err)
      throw err
    })
  } else {
    console.log(`[pngs2apng] Files already in correct location, skipping copy`)

    // 仍然需要写入延时配置文件
    if (item.options.delays) {
      const delayPromises = item.basic.fileList.map((file, index) => {
        if (item.options.delays[index]) {
          const frameNumber = String(index + 1).padStart(6, '0')
          const delayPath = path.join(tmpDir, `apng${frameNumber}.txt`)
          const delayContent = "delay=" + item.options.delays[index]*1000+"/1000"
          return fs.writeFile(delayPath, delayContent)
        }
        return Promise.resolve()
      })
      copyPromise = Promise.all(delayPromises)
    } else {
      copyPromise = Promise.resolve()
    }
  }

  // 等待所有文件复制/延时配置完成
  return copyPromise.then(() => {
    // 检查是否已取消
    if (store.state.cancelled) {
      console.log('[pngs2apng] Task cancelled after copying')
      return Promise.reject({ cancelled: true })
    }

    const frameCount = item.basic.fileList.length
    console.log(`[pngs2apng] Prepared ${frameCount} frames`)

    // 更新进度：准备组装
    store.dispatch('editProcess', {
      index: item.index,
      text: `${locale.analysing}... (组装 ${frameCount} 帧)`,
      schedule: 0.5
    })

    // ========================================
    // 混合策略：优先使用 FFmpeg 组装 APNG
    // ========================================
    return assembleWithFFmpeg(item, tmpDir, frameCount, item.options.frameRate, store, locale)
      .catch((ffmpegError) => {
        console.warn('[pngs2apng] FFmpeg assembly failed, falling back to apngasm:', ffmpegError.message)

        // FFmpeg 失败，降级到 apngasm
        // apngasm 优化：
        // -z0: 最快的压缩（不压缩，后续由 apngopt 处理）
        // -kc: 保留颜色类型
        // Windows 使用 /d 参数支持跨盘符 cd
        const isWindows = process.platform === 'win32'
        const cdCommand = isWindows ? `cd /d "${tmpDir}"` : `cd "${tmpDir}"`

        console.log(`[pngs2apng] Assembling ${frameCount} frames with apngasm (fallback)...`)
        const startTime = Date.now()

        return action.exec(cdCommand + ' && ' + action.bin('apngasm'), [
          path.join(item.basic.tmpOutputDir, item.options.outputName + '.png'),
          firstPNG,  // 使用相对路径，因为已经 cd 到 tmpDir
          '1',
          item.options.frameRate.toString(),
          '-l' + item.options.loop,
          '-kc',
          '-z0'  // 使用最快的压缩（不压缩），后续由 apngopt 优化
        ], item, store, locale).then((result) => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
          console.log(`[pngs2apng] Assembly completed in ${elapsed}s`)
          return result
        })
      })
    }).then(() => {
    // 检查是否已取消
    if (store.state.cancelled) {
      console.log('[pngs2apng] Task cancelled after assembly')
      return Promise.reject({ cancelled: true })
    }

    console.log('APNG assembly completed')

    // 更新进度：准备压缩
    store.dispatch('editProcess', {
      index: item.index,
      text: `${locale.analysing}... (优化中)`,
      schedule: 0.7
    })

		// reset fileList
    item.basic.fileList = [
      path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')
    ]
    return apngCompress(item, 0, store, locale)
  }).catch((err) => {
    // 如果是取消错误，直接传递
    if (err && err.cancelled) {
      throw err
    }
    // 其他错误也传递
    throw err
  })
}
