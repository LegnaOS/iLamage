import fs from 'fs-extra'
import path from 'path'
import Action from './action'

/**
 * WEBP 转 PNG 序列帧（快速路径，跳过 APNG 组装）
 * 直接提取并解码 WEBP 帧，不组装 APNG
 */
export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing + '...',
    schedule: 0.3
  })

  const tmpDir = item.basic.tmpDir
  const webpDir = path.join(tmpDir, 'webp')
  const tmpFile = path.join(item.basic.tmpOutputDir, item.options.outputName + '.webp')

  fs.ensureDirSync(tmpDir)
  fs.ensureDirSync(webpDir)

  if (tmpFile !== item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile

  return new Promise(function (resolve, reject) {
    // 第一步：获取帧信息
    getFrameInfo(item.basic.fileList[0]).then((frameInfo) => {
      const frameCount = frameInfo.frames.length
      console.log(`[webp2pngs] WebP has ${frameCount} frames, canvas size: ${frameInfo.canvasWidth}x${frameInfo.canvasHeight}`)

      // 第二步：并行提取所有帧
      const extractPromises = []
      for (let i = 1; i <= frameCount; i++) {
        extractPromises.push(
          Action.exec(Action.bin('webpmux'), [
            '-get frame ' + i,
            item.basic.fileList[0],
            '-o ' + path.join(webpDir, i + '.webp')
          ], item, store, locale)
        )
      }

      return Promise.all(extractPromises).then(() => frameInfo)
    }).then((frameInfo) => {
      const frameCount = frameInfo.frames.length
      console.log(`[webp2pngs] Decoding ${frameCount} frames and applying dispose logic...`)

      // 第三步：解码所有帧（应用 dispose 逻辑）
      return decodeAndComposeFrames(frameInfo, webpDir, item, store, locale)
    }).then((frameCount) => {
      console.log(`[webp2pngs] Decoded ${frameCount} frames, fileList length: ${item.basic.fileList.length}`)

      // 修改类型为 PNGs，让后续流程知道这是序列帧
      item.basic.type = 'PNGs'

      // 保存 delays（从 frameInfo 提取）
      // item.options.delays 已经在 decodeAndComposeFrames 中设置

      resolve()
    }).catch((err) => {
      reject(err)
    })
  })
}

/**
 * 获取 WEBP 帧信息（帧数、尺寸、偏移、延迟、dispose）
 */
function getFrameInfo(webpFile) {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec(`${Action.bin('webpmux')} -info "${webpFile}"`, { encoding: 'utf8' }, (err, stdout) => {
      if (err) {
        console.error('[webp2pngs] webpmux error:', err)
        reject(err)
        return
      }

      console.log('[webp2pngs] webpmux -info output:', stdout)

      // 解析 webpmux -info 输出
      // 示例输出：
      // Canvas size: 1920 x 1080
      // Features present: animation transparency
      // Number of frames: 728
      // No.: width height alpha x_offset y_offset duration   dispose blend image_size  compression
      //   1:  1920  1080    no        0        0       40       none   yes      123456         lossy
      //   2:  1920  1080    no        0        0       40  background   yes      123456         lossy

      const lines = stdout.split('\n')
      let canvasWidth = 0
      let canvasHeight = 0
      const frames = []

      for (const line of lines) {
        // 解析画布尺寸
        const canvasMatch = line.match(/Canvas size:\s*(\d+)\s*x\s*(\d+)/)
        if (canvasMatch) {
          canvasWidth = parseInt(canvasMatch[1])
          canvasHeight = parseInt(canvasMatch[2])
          console.log('[webp2pngs] Parsed canvas size:', canvasWidth, 'x', canvasHeight)
          continue
        }

        // 解析帧信息（跳过表头）
        const frameMatch = line.match(/^\s*(\d+):\s+(\d+)\s+(\d+)\s+\w+\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w+)/)
        if (frameMatch) {
          frames.push({
            index: parseInt(frameMatch[1]),
            width: parseInt(frameMatch[2]),
            height: parseInt(frameMatch[3]),
            x: parseInt(frameMatch[4]),
            y: parseInt(frameMatch[5]),
            duration: parseInt(frameMatch[6]),
            dispose: frameMatch[7] === 'background' ? 1 : 0 // 0=NONE, 1=BACKGROUND
          })
        }
      }

      console.log('[webp2pngs] Parsed frames:', frames.length)

      if (frames.length === 0) {
        console.error('[webp2pngs] Failed to parse WEBP frame info. Output was:', stdout)
        reject(new Error('Failed to parse WEBP frame info. Check console for webpmux output.'))
        return
      }

      resolve({ canvasWidth, canvasHeight, frames })
    })
  })
}

/**
 * 解码并合成所有帧（处理 WEBP dispose 逻辑）
 * 优化：如果所有帧都是 dispose=0（NONE），并行解码（快速）
 */
async function decodeAndComposeFrames(frameInfo, webpDir, item, store, locale) {
  const PNG = require('pngjs').PNG
  const frameCount = frameInfo.frames.length
  const canvasWidth = frameInfo.canvasWidth
  const canvasHeight = frameInfo.canvasHeight

  // 重置 fileList（将填充解码后的 PNG 路径）
  item.basic.fileList = []

  // 提取 delays
  const delays = frameInfo.frames.map(f => f.duration)
  item.options.delays = delays
  console.log('[webp2pngs] Extracted delays:', delays.slice(0, 10), '...')

  // 检查是否所有帧都是 dispose=0（NONE）
  const allDisposeNone = frameInfo.frames.every(f => f.dispose === 0)
  console.log('[webp2pngs] All frames dispose=NONE:', allDisposeNone)

  if (allDisposeNone) {
    // 快速路径：并行解码所有帧（无需累积画布）
    console.log(`[webp2pngs] Using fast parallel decoding for ${frameCount} frames`)

    store.dispatch('editProcess', {
      index: item.index,
      text: `${locale.analysing} (并行解码 ${frameCount} 帧)...`,
      schedule: 0.3
    })

    // 并行解码所有帧
    const decodePromises = []
    for (let i = 1; i <= frameCount; i++) {
      const frameData = frameInfo.frames[i - 1]
      const outputPath = path.join(webpDir, i + '.png')

      decodePromises.push(
        Action.exec(Action.bin('dwebp'), [
          path.join(webpDir, i + '.webp'),
          '-o ' + outputPath
        ], item, store, locale).then(() => {
          // 验证文件已写入
          return fs.pathExists(outputPath).then(exists => {
            if (!exists) {
              throw new Error(`Failed to write frame ${i} to ${outputPath}`)
            }
            return outputPath
          })
        })
      )
    }

    // 等待所有帧解码完成
    const decodedPaths = await Promise.all(decodePromises)

    // 按顺序填充 fileList
    item.basic.fileList = decodedPaths

    store.dispatch('editProcess', {
      index: item.index,
      text: `${locale.analysing} (已解码 ${frameCount} 帧)`,
      schedule: 0.8
    })

    console.log(`[webp2pngs] Parallel decoded ${frameCount} frames`)
    console.log(`[webp2pngs] Final fileList:`, item.basic.fileList.map(f => path.basename(f)))
    return frameCount
  }

  // 慢速路径：串行处理（需要累积画布）
  console.log(`[webp2pngs] Using serial decoding with dispose logic for ${frameCount} frames`)
  console.log('[webp2pngs] Frame dispose modes:', frameInfo.frames.map((f, i) => `${i + 1}:${f.dispose === 0 ? 'NONE' : 'BG'}`).join(' '))

  // 创建累积画布
  let canvas = new PNG({ width: canvasWidth, height: canvasHeight })

  // 串行处理帧（因为每帧依赖上一帧的状态）
  for (let i = 1; i <= frameCount; i++) {
    const frameData = frameInfo.frames[i - 1]

    store.dispatch('editProcess', {
      index: item.index,
      text: `${locale.analysing} ${i}/${frameCount}...`,
      schedule: 0.3 + (i / frameCount) * 0.5
    })

    // 解码当前帧
    await Action.exec(Action.bin('dwebp'), [
      path.join(webpDir, i + '.webp'),
      '-o ' + path.join(webpDir, i + '_raw.png')
    ], item, store, locale)

    // 读取解码后的帧
    const rawData = await fs.readFile(path.join(webpDir, i + '_raw.png'))
    const framePng = PNG.sync.read(rawData)

    // 将当前帧叠加到画布（使用偏移）
    PNG.bitblt(framePng, canvas, 0, 0, framePng.width, framePng.height, frameData.x, frameData.y)

    // 保存当前合成结果
    const outputPath = path.join(webpDir, i + '.png')
    const buffer = PNG.sync.write(canvas)
    await fs.writeFile(outputPath, buffer)

    // 验证文件已写入
    const exists = await fs.pathExists(outputPath)
    if (!exists) {
      throw new Error(`Failed to write frame ${i} to ${outputPath}`)
    }

    item.basic.fileList.push(outputPath)

    // 应用 dispose 逻辑（为下一帧准备画布）
    if (frameData.dispose === 1) {
      // BACKGROUND: 清除当前帧占据的矩形区域
      for (let y = frameData.y; y < frameData.y + frameData.height; y++) {
        for (let x = frameData.x; x < frameData.x + frameData.width; x++) {
          const idx = (canvasWidth * y + x) << 2
          canvas.data[idx] = 0     // R
          canvas.data[idx + 1] = 0 // G
          canvas.data[idx + 2] = 0 // B
          canvas.data[idx + 3] = 0 // A (透明)
        }
      }
    }
    // dispose === 0 (NONE): 保留画布，下一帧叠加
  }

  console.log(`[webp2pngs] Composed ${frameCount} frames with dispose logic`)
  console.log(`[webp2pngs] Final fileList:`, item.basic.fileList.map(f => path.basename(f)))
  return frameCount
}

