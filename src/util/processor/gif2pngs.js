/**
 * GIF → PNG 序列转换器
 *
 * 策略：使用 ffmpeg 直接提取 GIF 帧为 PNG 序列
 * 这比 gif2apng → apngdis 快得多
 */

import fs from 'fs-extra'
import path from 'path'
import action from './action'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing + '...',
    schedule: 0.2
  })

  const gifFile = item.basic.fileList[0]

  // 创建临时目录
  const tmpDir = item.basic.tmpDir
  fs.ensureDirSync(tmpDir)

  console.log(`[gif2pngs] Processing GIF: ${gifFile}`)

  // 使用 FFmpeg 提取帧
  return detectFFmpeg().then(async (ffmpegPath) => {
    if (!ffmpegPath) {
      throw new Error('FFmpeg not found. Please install FFmpeg or enable WebAV.')
    }

    store.dispatch('editProcess', {
      index: item.index,
      text: locale.analysing + '...',
      schedule: 0.3
    })

    // 先获取 GIF 信息（帧数、帧率）
    const probeCommand = `"${ffmpegPath}" -i "${gifFile}" 2>&1`
    const probeOutput = await execAsync(probeCommand).catch(err => err.stdout || err.stderr || '')

    // 从 ffmpeg 输出中提取帧率（如果有）
    let frameRate = item.options.frameRate || 10  // GIF 默认 10fps
    const fpsMatch = probeOutput.match(/(\d+(?:\.\d+)?)\s*fps/)
    if (fpsMatch) {
      frameRate = parseFloat(fpsMatch[1])
      console.log(`[gif2pngs] Detected frame rate: ${frameRate} fps`)
    }

    // 先获取 GIF 的尺寸信息
    const sizeMatch = probeOutput.match(/Stream.*?(\d+)x(\d+)/)
    let gifWidth = 0
    let gifHeight = 0
    if (sizeMatch) {
      gifWidth = parseInt(sizeMatch[1])
      gifHeight = parseInt(sizeMatch[2])
      console.log(`[gif2pngs] GIF size: ${gifWidth}x${gifHeight}`)
    }

    // 提取所有帧，并强制统一尺寸（避免帧抖动）
    // 使用固定 6 位数字（支持最多 999,999 帧）
    const outputPattern = path.join(tmpDir, 'apng%06d.png')

    // 使用 scale 滤镜确保所有帧尺寸一致
    // -vf "scale=iw:ih:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2"
    // 更简单的方法：使用 GIF 的原始尺寸
    let command
    if (gifWidth > 0 && gifHeight > 0) {
      // 强制所有帧使用相同尺寸（GIF 的画布尺寸）
      command = `"${ffmpegPath}" -i "${gifFile}" -vf "scale=${gifWidth}:${gifHeight}:force_original_aspect_ratio=decrease,pad=${gifWidth}:${gifHeight}:(ow-iw)/2:(oh-ih)/2" -vsync 0 "${outputPattern}"`
      console.log(`[gif2pngs] Extracting frames with unified size ${gifWidth}x${gifHeight}`)
    } else {
      // 降级：不强制尺寸
      command = `"${ffmpegPath}" -i "${gifFile}" -vsync 0 "${outputPattern}"`
      console.log(`[gif2pngs] Extracting frames (size detection failed, may have inconsistent sizes)`)
    }

    console.log(`[gif2pngs] Command: ${command}`)

    await execAsync(command)

    // 查找生成的帧文件
    const files = fs.readdirSync(tmpDir)
    const frameFiles = files.filter(f => f.startsWith('apng') && f.endsWith('.png'))
    frameFiles.sort()

    if (frameFiles.length === 0) {
      throw new Error('No frames extracted from GIF')
    }

    console.log(`[gif2pngs] Extracted ${frameFiles.length} frames from GIF`)

    // 验证帧尺寸是否一致
    const frameSizesConsistent = await checkFrameSizes(tmpDir, frameFiles)
    if (!frameSizesConsistent) {
      console.warn('[gif2pngs] Frame sizes are inconsistent, this may cause visual artifacts')
      // 可以在这里添加修复逻辑，类似 webp2apng 的 fixFrameSizes
    }

    // 更新 fileList 为 PNG 序列
    item.basic.fileList = frameFiles.map(f => path.join(tmpDir, f))

    // 更新类型为 PNGs
    item.basic.type = 'PNGs'

    // 设置帧延迟
    const frameDelay = 1 / frameRate
    item.options.delays = new Array(frameFiles.length).fill(frameDelay)

    console.log(`[gif2pngs] Set frame delay: ${frameDelay}s (${frameRate}fps) for ${frameFiles.length} frames`)

    store.dispatch('editProcess', {
      index: item.index,
      text: locale.analysing + '...',
      schedule: 0.5
    })

    return Promise.resolve()
  })
}

/**
 * 检查帧尺寸是否一致
 */
async function checkFrameSizes(tmpDir, frameFiles) {
  const PNG = require('pngjs').PNG

  try {
    // 读取第一帧的尺寸
    const firstFramePath = path.join(tmpDir, frameFiles[0])
    const firstData = await fs.readFile(firstFramePath)
    const firstPng = PNG.sync.read(firstData)
    const expectedWidth = firstPng.width
    const expectedHeight = firstPng.height

    console.log(`[gif2pngs] First frame size: ${expectedWidth}x${expectedHeight}`)

    // 检查其他帧
    for (let i = 1; i < frameFiles.length; i++) {
      const framePath = path.join(tmpDir, frameFiles[i])
      const data = await fs.readFile(framePath)
      const png = PNG.sync.read(data)

      if (png.width !== expectedWidth || png.height !== expectedHeight) {
        console.warn(`[gif2pngs] Frame ${i + 1} size mismatch: expected ${expectedWidth}x${expectedHeight}, got ${png.width}x${png.height}`)
        return false
      }
    }

    console.log(`[gif2pngs] All ${frameFiles.length} frames have consistent size: ${expectedWidth}x${expectedHeight}`)
    return true
  } catch (err) {
    console.warn('[gif2pngs] Failed to check frame sizes:', err.message)
    return true // 假设一致，避免阻塞流程
  }
}

/**
 * 检测 FFmpeg
 */
async function detectFFmpeg() {
  try {
    const { detectFFmpeg } = await import('../ffmpeg-manager.js')
    return await detectFFmpeg()
  } catch (error) {
    console.warn('[gif2pngs] FFmpeg detection failed:', error)
    return null
  }
}

