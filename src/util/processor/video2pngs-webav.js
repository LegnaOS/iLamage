/**
 * 视频/动图 → PNG 序列转换器（混合优化版本）
 *
 * 策略（Linus 式实用主义）：
 * **混合使用 WebAV + FFmpeg，发挥各自优势**
 *
 * 支持格式：
 * - WebM (VP8/VP9 + Alpha) - **直接用 FFmpeg**（MP4Clip 不支持）
 * - MP4 (H.264/H.265) - WebAV 解析 + FFmpeg 提取
 * - VAP (腾讯视频动画，本质是 MP4 + JSON 配置) - WebAV 解析 + FFmpeg 提取
 * - GIF (动图) - WebAV ImgClip + FFmpeg 提取
 * - AVIF (AV1 图像格式) - WebAV ImgClip + FFmpeg 提取
 * - MOV (QuickTime) - WebAV 解析 + FFmpeg 提取
 * - MPEG (MPEG-1/2) - WebAV 解析 + FFmpeg 提取
 * - FLV (Flash Video) - WebAV 解析 + FFmpeg 提取
 *
 * 性能优化策略：
 * 1. **WebM**：直接用 FFmpeg（最快、最稳定）
 * 2. **其他格式**：
 *    - 元数据解析：使用 WebAV（快速、跨平台、零依赖）
 *    - 帧提取：优先使用 FFmpeg（批量处理、速度快 5-10 倍）
 *    - 降级方案：FFmpeg 不可用时，使用 WebAV 逐帧解码
 *
 * 为什么混合使用：
 * - WebAV 解析元数据快（无需启动外部进程）
 * - FFmpeg 批量提取帧快（一次性处理所有帧）
 * - WebM 直接用 FFmpeg（避免 MP4Clip 兼容性问题）
 * - 结合两者优势，性能最优
 */

import fs from 'fs-extra'
import path from 'path'
import { MP4Clip, ImgClip } from '@webav/av-cliper'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * 检测系统 FFmpeg
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
 * 使用 FFmpeg 批量提取帧（快速）
 */
async function extractFramesWithFFmpeg(videoFile, tmpDir, frameRate, totalFrames, store, item, locale) {
  const ffmpegPath = await detectFFmpeg()
  if (!ffmpegPath) {
    throw new Error('FFmpeg not available')
  }

  // 使用固定 6 位数字（支持最多 999,999 帧）
  const outputPattern = path.join(tmpDir, `apng%06d.png`)

  // FFmpeg 命令：批量提取所有帧
  // -vsync 0: 禁用帧同步，避免帧混合导致残影
  // fps:round=down: 向下取整，避免帧插值
  const command = `"${ffmpegPath}" -i "${videoFile}" -vf "fps=${frameRate}:round=down" -vsync 0 -pix_fmt rgba -c:v png "${outputPattern}"`

  console.log(`[FFmpeg] Extracting ${totalFrames} frames with command:`, command)

  store.dispatch('editProcess', {
    index: item.index,
    text: `Extracting ${totalFrames} frames (FFmpeg)...`,
    schedule: 0.3
  })

  // 执行 FFmpeg（批量处理，速度快）
  await execAsync(command)

  console.log(`[FFmpeg] Extraction complete, verifying frames...`)

  // 验证帧并获取实际提取的帧数（FFmpeg 可能提取的帧数与预期不同）
  const fs = require('fs-extra')
  const framePaths = []

  // 读取目录中实际生成的帧文件
  const files = await fs.readdir(tmpDir)
  const extractedFrames = files.filter(f => f.startsWith('apng') && f.endsWith('.png'))
  extractedFrames.sort()

  console.log(`[FFmpeg] Expected ${totalFrames} frames, found ${extractedFrames.length} frames`)

  if (extractedFrames.length === 0) {
    throw new Error('FFmpeg failed to extract any frames')
  }

  // 如果提取的帧数与预期不同，发出警告但继续（使用实际帧数）
  if (extractedFrames.length !== totalFrames) {
    console.warn(`[FFmpeg] Frame count mismatch: expected ${totalFrames}, got ${extractedFrames.length}`)
    console.warn(`[FFmpeg] This is normal for some video formats (e.g., GIF with variable frame timing)`)
  }

  // 使用实际提取的帧
  for (const frameFile of extractedFrames) {
    framePaths.push(path.join(tmpDir, frameFile))
  }

  console.log(`[FFmpeg] Successfully extracted ${framePaths.length} frames`)
  return framePaths
}

/**
 * 使用 WebAV 提取视频帧（混合优化版本）
 * @param {Object} item - 任务项
 * @param {Object} store - Vuex store
 * @param {Object} locale - 语言配置
 */
export default async function (item, store, locale) {
  // 检查是否已取消
  if (store.state.cancelled) {
    console.log('[video2pngs-webav] Task cancelled before start')
    return Promise.reject({ cancelled: true })
  }

  const videoFile = item.basic.fileList[0]
  const videoType = item.basic.type // 'WEBM', 'MP4', 'VAP', 'GIF', 'AVIF', 'MOV', 'MPEG', 'FLV'

  console.log(`Processing ${videoType} file with WebAV: ${videoFile}`)

  // MIME type 映射
  const mimeTypeMap = {
    'WEBM': 'video/webm',
    'MP4': 'video/mp4',
    'VAP': 'video/mp4', // VAP 本质是 MP4
    'GIF': 'image/gif',
    'AVIF': 'image/avif',
    'MOV': 'video/quicktime',
    'MPEG': 'video/mpeg',
    'FLV': 'video/x-flv'
  }

  // 检查 WebCodecs API 是否可用
  if (typeof VideoDecoder === 'undefined') {
    console.warn('WebCodecs API not available, falling back to FFmpeg')
    return fallbackToFFmpeg(item, store, locale)
  }

  // WebM 和 FLV 格式直接用 FFmpeg（MP4Clip 不支持或支持不好）
  if (videoType === 'WEBM') {
    console.log('[WebAV] WebM format detected, using FFmpeg directly for better compatibility')
    return fallbackToFFmpeg(item, store, locale)
  }

  if (videoType === 'FLV') {
    console.log('[WebAV] FLV format detected, using FFmpeg directly (WebAV does not support FLV well)')
    return fallbackToFFmpeg(item, store, locale)
  }

  const tmpDir = item.basic.tmpDir
  fs.ensureDirSync(tmpDir)

  try {
    // 更新进度
    store.dispatch('editProcess', {
      index: item.index,
      text: locale.analysing + '... (WebAV)',
      schedule: 0.1
    })

    // 读取文件并创建 ReadableStream
    const videoBuffer = await fs.readFile(videoFile)
    console.log(`[WebAV] Video file loaded: ${videoFile}, size: ${videoBuffer.length} bytes, type: ${videoType}`)

    // 将 Buffer 转换为 ReadableStream<Uint8Array>
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(videoBuffer))
        controller.close()
      }
    })

    // 根据格式选择合适的 Clip 类
    let clip
    const isAnimatedImage = ['GIF', 'AVIF'].includes(videoType)

    if (isAnimatedImage) {
      // 使用 ImgClip 处理动图
      const mimeType = mimeTypeMap[videoType]
      clip = new ImgClip({
        type: mimeType,
        stream: stream
      })
    } else {
      // 使用 MP4Clip 处理视频
      clip = new MP4Clip(stream)
    }

    // 等待 clip 准备就绪，添加超时保护
    const readyTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('WebAV clip ready timeout (30s)')), 30000)
    })

    try {
      await Promise.race([clip.ready, readyTimeout])
    } catch (err) {
      console.error('[WebAV] Clip ready failed:', err)
      throw new Error(`WebAV 初始化失败: ${err.message}`)
    }

    // 获取媒体信息
    const meta = await clip.meta
    const duration = meta.duration // 微秒
    const width = meta.width
    const height = meta.height

    // 估算帧率（从 VAP JSON 读取或使用默认值）
    let frameRate = 30 // 默认 30fps

    if (videoType === 'VAP' && item.basic.fileList[1]) {
      // VAP 格式：从 JSON 配置文件读取帧率
      try {
        const vapConfig = await fs.readJSON(item.basic.fileList[1])
        if (vapConfig.fps) {
          frameRate = vapConfig.fps
        }
      } catch (err) {
        console.warn('Failed to read VAP config, using default fps:', err)
      }
    }

    const totalFrames = Math.ceil((duration / 1000000) * frameRate)
    const frameDuration = 1000000 / frameRate // 微秒

    console.log(`[WebAV] Video info: ${width}x${height}, ${totalFrames} frames @ ${frameRate}fps, duration: ${duration}µs`)

    // ========================================
    // 混合策略：优先使用 FFmpeg 批量提取帧
    // ========================================
    let framePaths

    try {
      console.log('[Hybrid] Attempting to use FFmpeg for fast frame extraction...')
      framePaths = await extractFramesWithFFmpeg(videoFile, tmpDir, frameRate, totalFrames, store, item, locale)

      // FFmpeg 成功，清理 WebAV 资源
      try {
        clip.destroy()
      } catch (cleanupError) {
        // 忽略 OPFS 清理错误（不影响功能）
        console.warn('[Hybrid] WebAV cleanup warning (ignored):', cleanupError.message)
      }

      console.log(`[Hybrid] Successfully extracted ${totalFrames} frames using FFmpeg (fast batch mode)`)

    } catch (ffmpegError) {
      console.warn('[Hybrid] FFmpeg extraction failed, falling back to WebAV:', ffmpegError.message)

      // FFmpeg 失败，降级到 WebAV 逐帧解码
      store.dispatch('editProcess', {
        index: item.index,
        text: `Extracting frames (WebAV fallback)...`,
        schedule: 0.2
      })

      // 创建离屏 Canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { alpha: true })

      // 逐帧提取（优化版：批量写入）
      framePaths = []
      const frameWritePromises = []

      console.log(`[WebAV] Starting frame extraction: ${totalFrames} frames`)

      for (let i = 0; i < totalFrames; i++) {
      // 检查是否已取消
      if (store.state.cancelled) {
        console.log('[video2pngs-webav] Task cancelled during frame extraction')
        clip.destroy()
        return Promise.reject({ cancelled: true })
      }

      const timestamp = i * frameDuration // 微秒

      // 使用 tick 方法获取当前时间的帧
      const { video } = await clip.tick(timestamp)

      if (video) {
        // 清空 Canvas
        ctx.clearRect(0, 0, width, height)

        // 绘制视频帧到 Canvas
        ctx.drawImage(video, 0, 0, width, height)

        // 关闭 VideoFrame 释放资源
        video.close()
      }

      // 导出为 PNG（异步，不等待）
      // 使用固定 6 位数字（支持最多 999,999 帧）
      const frameNumber = String(i + 1).padStart(6, '0')
      const framePath = path.join(tmpDir, `apng${frameNumber}.png`)
      framePaths.push(framePath)

      // 使用 toBlob（异步）替代 toDataURL（同步）
      const writePromise = new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          try {
            const buffer = Buffer.from(await blob.arrayBuffer())
            await fs.writeFile(framePath, buffer)
            resolve()
          } catch (err) {
            reject(err)
          }
        }, 'image/png')
      })

      frameWritePromises.push(writePromise)

      // 每 10 帧更新一次进度（减少 UI 更新频率）
      if (i % 10 === 0 || i === totalFrames - 1) {
        const progress = 0.2 + (i / totalFrames) * 0.5
        store.dispatch('editProcess', {
          index: item.index,
          text: `Extracting ${i + 1}/${totalFrames} frames (WebAV)...`,
          schedule: progress
        })
      }
      }

      // 等待所有帧写入完成
      console.log(`[WebAV] Waiting for ${frameWritePromises.length} frames to be written...`)
      store.dispatch('editProcess', {
        index: item.index,
        text: `Writing ${totalFrames} frames to disk...`,
        schedule: 0.7
      })

      await Promise.all(frameWritePromises)
      console.log(`[WebAV] All frames written to disk`)

      // 清理资源
      clip.destroy()

      console.log(`[WebAV] Extracted ${totalFrames} frames using fallback mode`)
    }

    // 更新 item.basic 为 PNGs 类型
    item.basic.type = 'PNGs'
    item.basic.fileList = framePaths
    item.basic.delay = 1 / frameRate // 帧延迟（秒）

    // 更新进度
    store.dispatch('editProcess', {
      index: item.index,
      text: `Extracted ${totalFrames} frames (WebAV)`,
      schedule: 0.9
    })

    return Promise.resolve()
  } catch (error) {
    console.error('[WebAV] Decoding failed:', error.message)
    console.error('[WebAV] Error stack:', error.stack)
    console.log('[WebAV] Falling back to FFmpeg for reliable processing...')

    // 降级到 FFmpeg
    try {
      return await fallbackToFFmpeg(item, store, locale)
    } catch (ffmpegError) {
      console.error('[FFmpeg] Fallback also failed:', ffmpegError)
      throw new Error(`视频解码失败: WebAV 和 FFmpeg 都无法处理此文件`)
    }
  }
}

/**
 * 降级到 FFmpeg
 */
async function fallbackToFFmpeg(item, store, locale) {
  const videoType = item.basic.type

  console.log(`Falling back to FFmpeg for ${videoType}`)

  // 动态导入 FFmpeg 版本
  const webm2pngsFFmpeg = await import('./webm2pngs')
  
  // 所有视频格式都使用相同的 FFmpeg 处理逻辑
  // webm2pngs.js 实际上可以处理任何 FFmpeg 支持的视频格式
  return webm2pngsFFmpeg.default(item, store, locale)
}

