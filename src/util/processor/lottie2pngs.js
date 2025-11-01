/**
 * Lottie → PNG 序列转换器
 *
 * 策略：使用 html2canvas 在当前渲染进程中渲染 Lottie，然后保存为 PNG 序列
 * 这个方案：
 * - ✅ 不需要 node-canvas（避免编译问题）
 * - ✅ 不需要 puppeteer（太重）
 * - ✅ 在渲染进程中运行（不需要创建新窗口）
 * - ✅ 100% 兼容 lottie-web
 * - ✅ 跨平台（Windows/macOS/Linux）
 */

import fs from 'fs-extra'
import path from 'path'
import action from './action'
import lottie from 'lottie-web'

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing + '...',
    schedule: 0.2
  })

  const lottieFile = item.basic.fileList[0]
  const lottieData = fs.readJSONSync(lottieFile)

  // 获取动画信息
  const frameRate = item.options.frameRate || lottieData.fr || 24
  const totalFrames = Math.floor((lottieData.op || lottieData.outPoint || 60) - (lottieData.ip || lottieData.inPoint || 0))
  const width = lottieData.w || 512
  const height = lottieData.h || 512

  console.log(`Lottie animation: ${width}x${height}, ${totalFrames} frames @ ${frameRate}fps`)

  // 创建临时目录
  const tmpDir = item.basic.tmpDir
  fs.ensureDirSync(tmpDir)

  // 创建容器（Lottie 会在容器内创建 Canvas）
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '-9999px'
  container.style.left = '-9999px'
  container.style.width = width + 'px'
  container.style.height = height + 'px'
  document.body.appendChild(container)

  // 加载 Lottie 动画（使用 Canvas 渲染器）
  const anim = lottie.loadAnimation({
    container: container,
    renderer: 'canvas',  // 关键：使用 Canvas 渲染器，比 SVG 快 3-5 倍
    loop: false,
    autoplay: false,
    animationData: lottieData
  })

  // 等待动画加载完成
  return new Promise((resolve) => {
    anim.addEventListener('DOMLoaded', resolve)
  }).then(() => {
    console.log('Lottie animation loaded, starting frame capture...')

    // 获取 Lottie 创建的 Canvas（重要！）
    const canvas = container.querySelector('canvas')
    if (!canvas) {
      throw new Error('Lottie did not create a canvas element')
    }
    console.log(`Found Lottie canvas: ${canvas.width}x${canvas.height}`)

    // 渲染单个帧的函数（优化版：批量处理 + 异步写入）
    const renderFrame = (frameIndex) => {
      return new Promise((resolve, reject) => {
        // 使用固定 6 位数字（支持最多 999,999 帧）
        const frameNumber = String(frameIndex + 1).padStart(6, '0')
        const framePath = path.join(tmpDir, `apng${frameNumber}.png`)

        // 跳转到指定帧
        anim.goToAndStop(frameIndex, true)

        // 使用 requestAnimationFrame 确保渲染完成（比 setTimeout 更精确）
        requestAnimationFrame(() => {
          try {
            // 直接从 Canvas 导出 PNG（无需 SVG → Image → Canvas 的转换）
            const dataURL = canvas.toDataURL('image/png')
            const base64Data = dataURL.split(',')[1]
            const buffer = Buffer.from(base64Data, 'base64')

            // 异步写入文件（不阻塞渲染）
            fs.writeFile(framePath, buffer).then(() => {
              resolve()
            }).catch(reject)
          } catch (err) {
            reject(err)
          }
        })
      })
    }

    // 批量处理帧（每批 10 帧，减少进度更新开销）
    const batchSize = 10
    let promise = Promise.resolve()

    for (let batchStart = 0; batchStart < totalFrames; batchStart += batchSize) {
      promise = promise.then(() => {
        const batchEnd = Math.min(batchStart + batchSize, totalFrames)
        const batchPromises = []

        // 串行渲染当前批次的帧
        let batchPromise = Promise.resolve()
        for (let i = batchStart; i < batchEnd; i++) {
          batchPromise = batchPromise.then(() => renderFrame(i))
        }

        // 批次完成后更新进度
        return batchPromise.then(() => {
          store.dispatch('editProcess', {
            index: item.index,
            text: locale.analysing + `... (${batchEnd}/${totalFrames})`,
            schedule: 0.2 + (batchEnd / totalFrames) * 0.3
          })
        })
      })
    }

    return promise
  }).then(() => {
    // 清理 DOM
    document.body.removeChild(container)
    anim.destroy()

    console.log(`Rendered ${totalFrames} frames from Lottie`)

    // 更新 fileList 为 PNG 序列
    item.basic.fileList = []
    for (let i = 0; i < totalFrames; i++) {
      const frameNumber = String(i + 1).padStart(6, '0')
      item.basic.fileList.push(
        path.join(tmpDir, `apng${frameNumber}.png`)
      )
    }

    // 更新类型为 PNGs，这样后续流程会自动处理
    item.basic.type = 'PNGs'

    // 设置帧延迟（重要！否则 APNG 只显示第一帧）
    // 延迟 = 1000ms / frameRate
    const frameDelay = 1 / frameRate  // 秒
    item.options.delays = new Array(totalFrames).fill(frameDelay)

    console.log(`Set frame delay: ${frameDelay}s (${frameRate}fps) for ${totalFrames} frames`)

    return Promise.resolve()
  }).catch((err) => {
    // 清理 DOM
    if (container.parentNode) {
      document.body.removeChild(container)
    }
    anim.destroy()
    throw err
  })
}

