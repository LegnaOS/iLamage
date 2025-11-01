import fs from 'fs-extra'
import path from 'path'
import action from './action'
// import apngCompress from './apngCompress'
import PNGs2apng from './pngs2apng'

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing+'...',
    schedule: 0.4
  })

  var tmpDir = item.basic.tmpDir
  var webpDir = path.join(item.basic.tmpDir, 'webp')

  var webpDir = path.join(tmpDir, 'webp')
  var tmpFile = path.join(item.basic.tmpOutputDir, item.options.outputName + '.webp')
  fs.ensureDirSync(tmpDir)
  fs.ensureDirSync(webpDir)
  if (tmpFile != item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile

  return new Promise(function (resolve, reject) {
    // 第一步：获取帧信息（帧数、尺寸、偏移）
    getFrameInfo(item.basic.fileList[0]).then((frameInfo) => {
      const frameCount = frameInfo.frames.length
      console.log(`WebP has ${frameCount} frames, canvas size: ${frameInfo.canvasWidth}x${frameInfo.canvasHeight}`)
      console.log(`Frame info:`, frameInfo.frames.map(f => `${f.width}x${f.height} @ (${f.x},${f.y})`).join(', '))

      // 第二步：并行提取所有帧
      const extractPromises = []
      for (let i = 1; i <= frameCount; i++) {
        extractPromises.push(
          action.exec(action.bin('webpmux'), [
            '-get frame ' + i,
            item.basic.fileList[0],
            '-o ' + path.join(webpDir, i + '.webp')
          ], item, store, locale)
        )
      }

      return Promise.all(extractPromises).then(() => frameInfo)
    }).then((frameInfo) => {
      const frameCount = frameInfo.frames.length
      // 第三步：串行解码所有帧，并应用 dispose 逻辑（必须串行，因为需要累积上一帧）
      console.log(`Decoding ${frameCount} frames and applying dispose logic to ${frameInfo.canvasWidth}x${frameInfo.canvasHeight} canvas...`)

      // 串行处理帧（因为每帧依赖上一帧的状态）
      return decodeAndComposeFrames(frameInfo, webpDir, item, store, locale)
    }).then((frameCount) => {
      // 保存原始 PNG 序列文件列表（在调用 PNGs2apng 之前）
      const originalFileList = [...item.basic.fileList]
      console.log(`[webp2apng] Saving original fileList: ${originalFileList.length} frames`)

      // 第四步：转换为 APNG
      return convertToGifDirectly(item, webpDir, frameCount, store, locale).then(() => {
        // PNGs2apng 会重置 fileList 为 [APNG文件]
        // 恢复原始文件列表，供后续处理使用
        item.basic.originalFileList = originalFileList
        console.log(`[webp2apng] Restored originalFileList: ${item.basic.originalFileList.length} frames`)
      })
    }).then(() => {
      resolve()
    }).catch((err) => {
      reject(err)
    })
  })
}
// 转换 PNG 序列为 APNG（帧已经在解码时统一尺寸）
function convertToGifDirectly(item, webpDir, frameCount, store, locale) {
  console.log(`[webp2apng] convertToGifDirectly called with ${frameCount} frames, fileList length: ${item.basic.fileList.length}`)
  console.log('[webp2apng] Frames already normalized to canvas size during decoding, proceeding with apngasm...')

  // 帧已经在 applyFrameOffset 中统一到画布尺寸，直接组装 APNG
  return PNGs2apng(item, store, locale)
}



/**
 * 获取 WebP 的帧信息（帧数、尺寸、偏移）
 * @returns {Promise<{frames: Array, canvasWidth: number, canvasHeight: number}>}
 */
function getFrameInfo(webpPath) {
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec(`${action.bin('webpmux')} -info "${webpPath}"`, { encoding: 'utf8' }, (err, stdout) => {
      if (err) {
        reject(err)
        return
      }

      // 解析输出获取帧信息
      // 输出格式：
      // Canvas size: 320 x 240
      // Features present: animation
      // No.: width height alpha x_offset y_offset duration   dispose blend image_size  compression
      //   1:   240    240    no        0        0       40       none    yes      1234  lossy
      //   2:   180    180    no       30       30       40       none    yes      1234  lossy

      const lines = stdout.split('\n')

      // 解析画布尺寸
      let canvasWidth = 0
      let canvasHeight = 0
      const canvasMatch = stdout.match(/Canvas size:\s*(\d+)\s*x\s*(\d+)/i)
      if (canvasMatch) {
        canvasWidth = parseInt(canvasMatch[1])
        canvasHeight = parseInt(canvasMatch[2])
      }

      // 解析每帧信息
      const frames = []
      for (const line of lines) {
        // 匹配帧信息行：数字: width height alpha x_offset y_offset duration dispose blend ...
        // 示例：  1:   240    240    no        0        0       40       none    yes      1234  lossy
        // 示例：  2:   180    180    no       30       30       40    background yes      1234  lossy
        const match = line.match(/^\s*(\d+):\s+(\d+)\s+(\d+)\s+\w+\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\w+)\s+(\w+)/)
        if (match) {
          const disposeStr = match[7] // 'none' 或 'background'
          const dispose = disposeStr === 'background' ? 1 : 0

          frames.push({
            index: parseInt(match[1]),
            width: parseInt(match[2]),
            height: parseInt(match[3]),
            x: parseInt(match[4]),
            y: parseInt(match[5]),
            duration: parseInt(match[6]),
            dispose: dispose  // 0 = NONE (保留), 1 = BACKGROUND (清除)
          })

          // 如果没有画布尺寸，使用最大帧尺寸
          if (canvasWidth === 0 || canvasHeight === 0) {
            canvasWidth = Math.max(canvasWidth, parseInt(match[2]) + parseInt(match[4]))
            canvasHeight = Math.max(canvasHeight, parseInt(match[3]) + parseInt(match[5]))
          }
        }
      }

      if (frames.length > 0) {
        resolve({ frames, canvasWidth, canvasHeight })
      } else {
        reject(new Error('Could not parse frame info from webpmux output'))
      }
    })
  })
}

/**
 * 解码并合成所有帧（处理 WEBP dispose 逻辑）
 * WEBP 动画的 dispose 模式：
 * - dispose: 0 (NONE) - 保留当前帧，下一帧叠加在上面
 * - dispose: 1 (BACKGROUND) - 显示当前帧后，清除当前帧占据的矩形区域（恢复到透明）
 */
async function decodeAndComposeFrames(frameInfo, webpDir, item, store, locale) {
  const PNG = require('pngjs').PNG
  const frameCount = frameInfo.frames.length
  const canvasWidth = frameInfo.canvasWidth
  const canvasHeight = frameInfo.canvasHeight

  // 创建累积画布
  let canvas = new PNG({ width: canvasWidth, height: canvasHeight })

  console.log('[webp2apng] Frame dispose modes:', frameInfo.frames.map((f, i) => `${i+1}:${f.dispose === 0 ? 'NONE' : 'BG'}`).join(' '))

  // 串行处理每一帧
  for (let i = 1; i <= frameCount; i++) {
    const frameData = frameInfo.frames[i - 1]
    const prevFrameData = i > 1 ? frameInfo.frames[i - 2] : null

    // 如果上一帧的 dispose 是 BACKGROUND，清除上一帧占据的矩形区域
    if (prevFrameData && prevFrameData.dispose === 1) {
      console.log(`[webp2apng] Frame ${i}: Clearing prev frame region (${prevFrameData.width}x${prevFrameData.height} @ ${prevFrameData.x},${prevFrameData.y})`)

      // 清除上一帧的矩形区域（设置为透明）
      for (let y = prevFrameData.y; y < prevFrameData.y + prevFrameData.height && y < canvasHeight; y++) {
        for (let x = prevFrameData.x; x < prevFrameData.x + prevFrameData.width && x < canvasWidth; x++) {
          const idx = (canvasWidth * y + x) << 2
          canvas.data[idx] = 0     // R
          canvas.data[idx + 1] = 0 // G
          canvas.data[idx + 2] = 0 // B
          canvas.data[idx + 3] = 0 // A (透明)
        }
      }
    }

    // 解码当前帧
    await action.exec(action.bin('dwebp'), [
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

    console.log(`[webp2apng] Frame ${i}/${frameCount} composed and saved: ${path.basename(outputPath)}`)

    item.basic.fileList[i - 1] = outputPath
  }

  console.log(`[webp2apng] Composed ${frameCount} frames with dispose logic`)
  console.log(`[webp2apng] Final fileList:`, item.basic.fileList.map(f => path.basename(f)))
  return frameCount
}
