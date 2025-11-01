import fs from 'fs-extra'
import path from 'path'
import action from './action'
import apngCompress from './apngCompress'
import TYPE 		from '../../store/enum/type'

/**
 * 检查并修复帧尺寸不一致的问题
 * @param {Array} fileList - PNG 文件列表
 * @param {String} tmpDir - 临时目录
 * @returns {Promise<Array|null>} - 修复后的文件列表，如果不需要修复则返回 null
 */
async function checkAndFixFrameSizes(fileList, tmpDir) {
  const PNG = require('pngjs').PNG

  try {
    // 读取所有帧的尺寸（带重试）
    const sizes = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]

      // 重试读取文件（最多 3 次，处理临时文件锁定）
      let data = null
      let retries = 3
      while (retries > 0) {
        try {
          // 检查文件是否存在
          const exists = await fs.pathExists(file)
          if (!exists) {
            console.error(`[apng2webp] File does not exist (attempt ${4 - retries}/3): ${file}`)
            if (retries === 1) {
              throw new Error(`Frame file not found: ${path.basename(file)}`)
            }
            await new Promise(resolve => setTimeout(resolve, 100)) // 等待 100ms
            retries--
            continue
          }

          data = await fs.readFile(file)
          break // 成功读取
        } catch (err) {
          console.warn(`[apng2webp] Failed to read frame ${i + 1} (attempt ${4 - retries}/3):`, err.message)
          retries--
          if (retries === 0) {
            throw err
          }
          await new Promise(resolve => setTimeout(resolve, 100)) // 等待 100ms 后重试
        }
      }

      const png = PNG.sync.read(data)
      sizes.push({ width: png.width, height: png.height })
    }

    // 检查是否所有帧尺寸一致
    const firstWidth = sizes[0].width
    const firstHeight = sizes[0].height
    let needsFix = false

    for (let i = 1; i < sizes.length; i++) {
      if (sizes[i].width !== firstWidth || sizes[i].height !== firstHeight) {
        console.log(`[apng2webp] Frame size mismatch: frame 1 is ${firstWidth}x${firstHeight}, frame ${i + 1} is ${sizes[i].width}x${sizes[i].height}`)
        needsFix = true
        break
      }
    }

    if (!needsFix) {
      console.log(`[apng2webp] All frames have consistent size: ${firstWidth}x${firstHeight}`)
      return null
    }

    // 找出最大尺寸
    let maxWidth = 0
    let maxHeight = 0
    sizes.forEach(size => {
      maxWidth = Math.max(maxWidth, size.width)
      maxHeight = Math.max(maxHeight, size.height)
    })

    console.log(`[apng2webp] Max frame size: ${maxWidth}x${maxHeight}, padding all frames...`)

    // 创建修复后的文件目录
    const fixedDir = path.join(tmpDir, 'webp_fixed')
    fs.ensureDirSync(fixedDir)

    // 修复所有帧
    const fixedFiles = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const size = sizes[i]
      const fixedFile = path.join(fixedDir, path.basename(file))

      // 如果尺寸已经匹配，直接复制
      if (size.width === maxWidth && size.height === maxHeight) {
        await fs.copy(file, fixedFile)
        fixedFiles.push(fixedFile)
        continue
      }

      // 读取并填充
      const data = await fs.readFile(file)
      const srcPng = PNG.sync.read(data)

      // 创建新的 PNG，尺寸为最大尺寸
      const dstPng = new PNG({ width: maxWidth, height: maxHeight })

      // 计算居中位置
      const offsetX = Math.floor((maxWidth - srcPng.width) / 2)
      const offsetY = Math.floor((maxHeight - srcPng.height) / 2)

      // 复制像素（居中）
      PNG.bitblt(srcPng, dstPng, 0, 0, srcPng.width, srcPng.height, offsetX, offsetY)

      // 写入文件
      const buffer = PNG.sync.write(dstPng)
      await fs.writeFile(fixedFile, buffer)
      fixedFiles.push(fixedFile)
    }

    console.log(`[apng2webp] All ${fileList.length} frames padded to ${maxWidth}x${maxHeight}`)
    return fixedFiles
  } catch (err) {
    // 如果是文件不存在错误，直接抛出（不能继续）
    if (err.code === 'ENOENT' || err.message.includes('not found')) {
      console.error('[apng2webp] Frame files are missing, cannot continue')
      throw err
    }

    // 其他错误（例如：PNG 解析失败），警告并使用原始文件列表
    console.warn('[apng2webp] Failed to check/fix frame sizes:', err.message)
    return null // 失败时返回 null，使用原始文件列表
  }
}

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.outputing+' WEBP...',
    schedule: 0.8
  })

  var tmpDir = item.basic.tmpDir

  // 优化：如果已经有 PNG 序列（originalFileList），直接使用，跳过 apngdis
  const hasOriginalPNGs = item.basic.originalFileList && item.basic.originalFileList.length > 0

  if (hasOriginalPNGs) {
    console.log(`[apng2webp] Using existing PNG sequence (${item.basic.originalFileList.length} frames), skipping apngdis...`)
    console.log(`[apng2webp] First 5 files:`, item.basic.originalFileList.slice(0, 5))
    console.log(`[apng2webp] Last 5 files:`, item.basic.originalFileList.slice(-5))

    // 检查帧尺寸是否一致
    return checkAndFixFrameSizes(item.basic.originalFileList, tmpDir).then((fixedFiles) => {
      // 使用修复后的文件列表（如果有修复）
      const fileList = fixedFiles || item.basic.originalFileList

      console.log(`[apng2webp] Using fileList (${fileList.length} frames)`)
      console.log(`[apng2webp] Verifying all files exist...`)

      // 验证所有文件存在
      const fs = require('fs-extra')
      let missingFiles = []
      for (let i = 0; i < fileList.length; i++) {
        const exists = fs.existsSync(fileList[i])
        if (!exists) {
          missingFiles.push({ index: i + 1, path: fileList[i] })
        }
      }

      if (missingFiles.length > 0) {
        console.error(`[apng2webp] Missing ${missingFiles.length} files:`)
        missingFiles.slice(0, 10).forEach(f => {
          console.error(`  - Frame ${f.index}: ${path.basename(f.path)}`)
        })
        throw new Error(`${missingFiles.length} frame files are missing`)
      }

      console.log(`[apng2webp] All ${fileList.length} files verified to exist`)

      // 构造 frames 数据结构（模拟 apngdis 的输出）
      const frames = fileList.map((file, index) => {
        const delay = item.basic.originalDelays && item.basic.originalDelays[index]
          ? item.basic.originalDelays[index]
          : (1 / (item.options.frameRate || 24))

        return {
          src: path.basename(file),
          srcPath: file,
          delay_num: Math.round(delay * 1000),
          delay_den: 1000,
          x: 0,
          y: 0,
          dispose_op: 1,  // 1 = APNG_DISPOSE_OP_BACKGROUND (清除上一帧，避免残影)
          blend_op: 0     // 0 = APNG_BLEND_OP_SOURCE (替换，不混合)
        }
      })

      return convertFramesToWebP(frames, item, store, locale, tmpDir)
    })
  }

  // 传统路径：使用 apngdis 分解 APNG
  return action.exec(action.bin('apngdis'), [
    item.basic.fileList[0]
  ], item, store, locale).then(() => {
    var data = fs.readFileSync(path.join(tmpDir, 'apngframe_metadata.json'), {encoding: 'utf-8'})
    var animation = JSON.parse(data)
    var frames = animation['frames']

    console.log(`Converting ${frames.length} frames to WebP in parallel...`)

    return convertFramesToWebP(frames, item, store, locale, tmpDir)
  })
}

/**
 * 将 PNG 帧转换为 WEBP 并组装
 */
function convertFramesToWebP(frames, item, store, locale, tmpDir) {

  // 并行转换所有帧为 WebP
  var promises = frames.map(function (frame) {
    // 使用 srcPath（如果存在）或者 tmpDir + src
    var png_frame_file = frame.srcPath || path.join(tmpDir, frame['src'])
    var webp_frame_file = path.join(tmpDir, path.basename(frame['src']) + '.webp')

    // 优化 cwebp 参数：添加 -m 4（速度模式，0-6，4 是平衡点）
    const qualityArg = item.options.quality.checked ? '-q ' + item.options.quality.value : '-q 75'

    return action.exec(action.bin('cwebp'), [
      qualityArg,
      '-m 4', // 速度模式：4 是速度和质量的平衡点（默认是 4，但明确指定）
      png_frame_file,
      '-o ' + webp_frame_file
    ], item, store, locale).then(() => {
      var delay = Math.round((frame['delay_num']) / (frame['delay_den']) * 1000)
      if (delay === 0) { // The specs say zero is allowed, but should be treated as 10 ms.
        delay = 10
      }
      var blend_mode = ''
      if (frame['blend_op'] === 0) {
        blend_mode = '-b'
      } else if (frame['blend_op'] === 1) {
        blend_mode = '+b'
      } else {
        throw new Error("Webp can't handle this blend operation")
      }

      // WEBP 要求 x/y 偏移必须是偶数，调整奇数偏移
      var x = frame['x']
      var y = frame['y']
      if (x % 2 !== 0) {
        x = x - 1  // 向下调整到偶数
        console.log(`[apng2webp] Adjusted odd x offset: ${frame['x']} -> ${x}`)
      }
      if (y % 2 !== 0) {
        y = y - 1  // 向下调整到偶数
        console.log(`[apng2webp] Adjusted odd y offset: ${frame['y']} -> ${y}`)
      }

      // WEBP 只支持 dispose_op: 0 和 1
      // 0 = NONE (不处理)
      // 1 = BACKGROUND (清除为背景色)
      // APNG 的 dispose_op: 2 (PREVIOUS, 恢复到上一帧) 在 WEBP 中不支持，转换为 1
      var dispose_op = frame['dispose_op']
      if (dispose_op === 2) {
        dispose_op = 1
        console.log(`[apng2webp] Converted dispose_op: 2 -> 1 (WEBP doesn't support PREVIOUS)`)
      }

      var webpmux_arg = ' -frame "' + path.basename(webp_frame_file) + '" +' + delay + '+' + x + '+' + y + '+' + dispose_op + blend_mode
      return webpmux_arg
    })
  })

  return Promise.all(promises).then(function (args) {
    console.log(`All ${frames.length} frames converted to WebP, assembling...`)
    return Promise.resolve(args.join(' '))
  }).then((args) => {
    return action.exec('cd ' + tmpDir + ' && ' + action.bin('webpmux'), [
      args,
      '-loop ' + item.options.loop,
      '-o ' + path.join(item.basic.tmpOutputDir, item.options.outputName + '.webp')
    ], item, store, locale)
  })
}
