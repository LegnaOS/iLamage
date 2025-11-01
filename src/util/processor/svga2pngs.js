/**
 * SVGA → PNG 序列转换器
 *
 * 策略：使用 svgaplayerweb 在当前渲染进程中渲染 SVGA，然后保存为 PNG 序列
 * 这个方案：
 * - ✅ 不需要 node-canvas（避免编译问题）
 * - ✅ 不需要 puppeteer（太重）
 * - ✅ 在渲染进程中运行（不需要创建新窗口）
 * - ✅ 100% 兼容 svgaplayerweb
 * - ✅ 跨平台（Windows/macOS/Linux）
 */

import fs from 'fs-extra'
import path from 'path'
import action from './action'
import SVGA from 'svgaplayerweb'
import logger from '../logger'

export default function (item, store, locale) {
  logger.info('svga2pngs', '=== SVGA Processing Start ===')
  logger.info('svga2pngs', 'File:', item.basic.fileList[0])
  logger.info('svga2pngs', 'Output formats:', item.options.outputFormat)

  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing + '...',
    schedule: 0.2
  })

  const svgaFile = item.basic.fileList[0]
  logger.info('svga2pngs', 'SVGA file exists:', fs.existsSync(svgaFile))

  // 创建临时目录
  const tmpDir = item.basic.tmpDir
  fs.ensureDirSync(tmpDir)
  logger.info('svga2pngs', 'Temp dir:', tmpDir)

  // 创建一个 DIV 容器用于渲染（SVGA Player 需要 DIV，会自己创建 Canvas）
  // 注意：Canvas 必须在 DOM 中且不能完全透明才能正确渲染！
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '-10000px'  // 移到屏幕外
  container.style.left = '-10000px'
  container.style.width = '2000px'  // 给足够空间
  container.style.height = '2000px'
  document.body.appendChild(container)

  // 创建 SVGA Player 和 Parser
  const player = new SVGA.Player(container)
  const parser = new SVGA.Parser()

  // 加载 SVGA 文件
  // 方法：读取文件 → Blob → Blob URL → parser.load
  return fs.readFile(svgaFile).then((buffer) => {
    logger.info('svga2pngs', 'File read, size:', buffer.length, 'bytes')

    // 创建 Blob
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    const blobUrl = URL.createObjectURL(blob)

    logger.info('svga2pngs', 'Created Blob URL:', blobUrl)

    return new Promise((resolve, reject) => {
      parser.load(blobUrl, (videoItem) => {
        logger.info('svga2pngs', 'SVGA loaded successfully')
        URL.revokeObjectURL(blobUrl)  // 清理 Blob URL
        resolve(videoItem)
      }, (error) => {
        logger.error('svga2pngs', 'SVGA load failed:', error)
        URL.revokeObjectURL(blobUrl)  // 清理 Blob URL
        reject(error)
      })
    })
  }).then((videoItem) => {
    logger.info('svga2pngs', 'SVGA animation loaded, frames:', videoItem.frames, 'FPS:', videoItem.FPS)

    // 获取动画信息
    const frameRate = item.options.frameRate || videoItem.FPS || 24
    const totalFrames = videoItem.frames || 60
    const width = videoItem.videoSize.width || 512
    const height = videoItem.videoSize.height || 512

    console.log(`SVGA animation: ${width}x${height}, ${totalFrames} frames @ ${frameRate}fps`)

    // 设置容器尺寸（Player 会自动创建 Canvas）
    container.style.width = width + 'px'
    container.style.height = height + 'px'

    // 设置 VideoItem
    player.setVideoItem(videoItem)
    player.loops = 0  // 不循环
    player.clearsAfterStop = false
    player.fillMode = 'Forward'  // 停止后保持在最后一帧

    // 等待图片资源加载完成（重要！）
    return new Promise((resolve) => {
      // 检查是否已经准备好（使用 requestAnimationFrame 代替 setTimeout）
      const checkPrepared = () => {
        if (player._renderer._prepared) {
          console.log('SVGA images loaded and ready')
          resolve()
        } else {
          requestAnimationFrame(checkPrepared)
        }
      }
      checkPrepared()
    })
  }).then(() => {
    const videoItem = player._videoItem
    const totalFrames = videoItem.frames || 60
    const frameRate = item.options.frameRate || videoItem.FPS || 24

    // 获取 Player 内部的绘图 Canvas（这才是真正渲染的地方！）
    const drawingCanvas = player._drawingCanvas
    if (!drawingCanvas) {
      throw new Error('SVGA Player did not create drawing canvas')
    }

    console.log(`Using SVGA Player's internal canvas: ${drawingCanvas.width}x${drawingCanvas.height}`)

    // 渲染所有帧 - 使用播放动画 + onFrame 回调的方式
    return new Promise((resolve, reject) => {
      const frameBuffers = {}  // 存储每一帧的 Buffer

      // 捕获帧的函数
      const captureFrame = (frameIndex) => {
        try {
          const dataURL = drawingCanvas.toDataURL('image/png')
          const base64Data = dataURL.split(',')[1]
          const buffer = Buffer.from(base64Data, 'base64')
          frameBuffers[frameIndex] = buffer

          // 更新进度
          if (frameIndex % 10 === 0) {
            store.dispatch('editProcess', {
              index: item.index,
              text: locale.analysing + `... (${frameIndex}/${totalFrames})`,
              schedule: 0.2 + (frameIndex / totalFrames) * 0.3
            })
          }
        } catch (err) {
          console.error(`Failed to capture frame ${frameIndex}:`, err)
        }
      }

      // 手动捕获第 0 帧（SVGA Player 的 onFrame 不会触发第 0 帧）
      player.stepToFrame(0, false)
      requestAnimationFrame(() => {
        console.log('Manually capturing frame 0')
        captureFrame(0)
      })

      // 设置 onFrame 回调 - 在每一帧渲染后调用（从第 1 帧开始）
      player.onFrame((frameIndex) => {
        // 调试信息
        if (frameIndex % 20 === 0) {
          console.log(`Capturing SVGA frame ${frameIndex}/${totalFrames}`)
        }

        captureFrame(frameIndex)
      })

      // 设置 onFinished 回调 - 动画播放完成后调用
      player.onFinished(() => {
        const capturedCount = Object.keys(frameBuffers).length
        console.log(`SVGA animation finished, captured ${capturedCount} frames, expected ${totalFrames}`)

        // 检查是否所有帧都被捕获
        if (capturedCount !== totalFrames) {
          console.warn(`Warning: Only captured ${capturedCount} frames, expected ${totalFrames}`)
        }

        // 并行写入所有文件（快速！）
        const writePromises = Object.entries(frameBuffers).map(([frameIndex, buffer]) => {
          // 使用固定 6 位数字（支持最多 999,999 帧）
          // frameIndex 从 0 开始，但文件名从 1 开始（与其他模块一致）
          const frameNumber = String(parseInt(frameIndex) + 1).padStart(6, '0')
          const framePath = path.join(tmpDir, `apng${frameNumber}.png`)
          return fs.writeFile(framePath, buffer)
        })

        Promise.all(writePromises).then(() => {
          console.log(`All ${capturedCount} frames written successfully`)
          resolve({ totalFrames: capturedCount, frameRate })
        }).catch(reject)
      })

      // 开始播放动画并捕获
      player.loops = 1  // 只播放一次
      player.clearsAfterStop = false
      player.startAnimation()

      console.log(`Started SVGA animation playback for frame capture`)
    })
  }).then(({ totalFrames, frameRate }) => {  // ✅ 接收 frameRate
    // 清理 DOM
    document.body.removeChild(container)
    player.clear()

    logger.info('svga2pngs', `Rendered ${totalFrames} frames from SVGA`)

    // 更新 fileList 为 PNG 序列
    // 注意：SVGA Player 的 onFrame frameIndex 从 0 开始，但文件名从 1 开始（与其他模块一致）
    item.basic.fileList = []
    for (let i = 1; i <= totalFrames; i++) {
      const frameNumber = String(i).padStart(6, '0')
      item.basic.fileList.push(
        path.join(tmpDir, `apng${frameNumber}.png`)
      )
    }

    logger.info('svga2pngs', 'Generated fileList:', item.basic.fileList.length, 'files')
    logger.info('svga2pngs', 'First file:', item.basic.fileList[0])
    logger.info('svga2pngs', 'Last file:', item.basic.fileList[item.basic.fileList.length - 1])

    // 更新类型为 PNGs，这样后续流程会自动处理
    item.basic.type = 'PNGs'

    // 设置帧延迟（重要！否则 APNG 只显示第一帧）
    // 延迟 = 1000ms / frameRate
    const frameDelay = 1 / frameRate  // 秒
    item.options.delays = new Array(totalFrames).fill(frameDelay)

    logger.info('svga2pngs', `Set frame delay: ${frameDelay}s (${frameRate}fps) for ${totalFrames} frames`)
    logger.info('svga2pngs', '=== SVGA Processing Complete ===')

    return Promise.resolve()
  }).catch((err) => {
    logger.error('svga2pngs', 'SVGA processing failed:', err.message)
    logger.error('svga2pngs', 'Stack:', err.stack)

    // 清理 DOM
    if (container.parentNode) {
      document.body.removeChild(container)
    }
    player.clear()
    throw err
  })
}

