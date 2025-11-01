/**
 * WebM → PNG 序列转换器
 *
 * 策略：使用 ffmpeg 提取 WebM 视频帧为 PNG 序列
 *
 * 透明度处理（关键）：
 * - WebM 支持 VP8/VP9 + Alpha 通道
 * - 必须使用 `-pix_fmt rgba` 保留透明度
 * - 不指定会导致 #FFFFFF 和 #000000 被当作透明色（致命问题）
 *
 * 要求：
 * - 系统已安装 ffmpeg（或在 public/bin/{platform}/ 目录中）
 * - WebM 文件必须是有效的视频文件
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

  const webmFile = item.basic.fileList[0]

  // 创建临时目录
  const tmpDir = item.basic.tmpDir
  fs.ensureDirSync(tmpDir)

  // 检测 ffmpeg
  return detectFFmpeg(store).then((ffmpegPath) => {
    console.log(`Using ffmpeg: ${ffmpegPath}`)

    // 获取视频信息
    return getVideoInfo(ffmpegPath, webmFile)
  }).then((videoInfo) => {
    console.log(`WebM video: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.frames} frames @ ${videoInfo.fps}fps, duration: ${videoInfo.duration}s, alpha: ${videoInfo.hasAlpha}`)

    // 保存 Alpha 通道信息到 item，供后续 APNG 组装使用
    item.basic.hasAlpha = videoInfo.hasAlpha

    // 计算文件名填充长度
    const numLen = videoInfo.frames.toString().length

    // 提取帧
    return extractFrames(item, store, locale, webmFile, tmpDir, numLen, videoInfo)
  }).then(({ totalFrames, numLen, frameRate }) => {
    console.log(`Extracted ${totalFrames} frames from WebM`)

    // 更新 fileList 为 PNG 序列（使用固定 6 位数字）
    item.basic.fileList = []
    for (let i = 1; i <= totalFrames; i++) {
      const frameNumber = String(i).padStart(6, '0')
      item.basic.fileList.push(
        path.join(tmpDir, `apng${frameNumber}.png`)
      )
    }

    // 设置帧延迟
    const frameDelay = 1 / frameRate
    item.options.delays = new Array(totalFrames).fill(frameDelay)
    console.log(`Set frame delay: ${frameDelay}s (${frameRate}fps) for ${totalFrames} frames`)

    // 更新类型为 PNGs，后续流程会自动处理
    item.basic.type = 'PNGs'

    return Promise.resolve()
  }).catch((err) => {
    console.error('WebM conversion failed:', err)
    
    // 如果是 ffmpeg 未找到的错误，给出友好提示
    if (err.message.includes('ffmpeg not found')) {
      store.dispatch('editProcess', {
        index: item.index,
        text: 'FFmpeg 未安装，请先安装 FFmpeg',
        schedule: -1
      })
    } else {
      store.dispatch('editProcess', {
        index: item.index,
        text: locale.convertFail,
        schedule: -1
      })
    }
    
    throw err
  })
}

/**
 * 检测 ffmpeg 路径
 * 优先级：
 * 1. Vuex store 中配置的路径（用户自定义或已检测的）
 * 2. public/bin/{platform}/ffmpeg
 * 3. 系统 PATH 中的 ffmpeg
 */
function detectFFmpeg(store) {
  return new Promise((resolve, reject) => {
    // 1. 检查 Vuex store 中的配置
    const configuredPath = store.getters.getterFFmpegPath
    if (configuredPath && fs.existsSync(configuredPath)) {
      console.log('Using configured ffmpeg:', configuredPath)
      return resolve(`"${configuredPath}"`)
    }

    // 2. 检查项目内置的 ffmpeg
    const builtinFFmpeg = action.bin('ffmpeg')

    // 移除引号
    const ffmpegPath = builtinFFmpeg.replace(/"/g, '')

    if (fs.existsSync(ffmpegPath)) {
      console.log('Found built-in ffmpeg:', ffmpegPath)
      return resolve(builtinFFmpeg) // 保留引号
    }

    // 3. 检查系统 ffmpeg
    const command = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg'

    exec(command, (err, stdout) => {
      if (err || !stdout.trim()) {
        return reject(new Error('ffmpeg not found. Please configure FFmpeg in settings (click the gear icon)'))
      }

      const systemFFmpeg = stdout.trim().split('\n')[0]
      console.log('Found system ffmpeg:', systemFFmpeg)
      resolve(`"${systemFFmpeg}"`) // 添加引号
    })
  })
}

/**
 * 获取视频信息
 */
function getVideoInfo(ffmpegPath, videoFile) {
  return new Promise((resolve, reject) => {
    // 使用 ffprobe 获取视频信息（包括元数据）
    const ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe')

    // 添加 codec_type 和 codec_name 用于检测视频流
    // 添加 -show_entries stream_tags 来获取 alpha_mode 元数据
    const command = `${ffprobePath} -v error -select_streams v:0 -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,pix_fmt:stream_tags=alpha_mode:format=duration -of json "${videoFile}"`

    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.warn('[webm2pngs] ffprobe exec error:', err.message)
        console.warn('[webm2pngs] ffprobe stderr:', stderr)
        // ffprobe 可能不存在，尝试使用 ffmpeg
        return getVideoInfoWithFFmpeg(ffmpegPath, videoFile).then(resolve).catch(reject)
      }

      try {
        console.log('[webm2pngs] ffprobe raw stdout:', stdout)
        console.log('[webm2pngs] ffprobe stderr:', stderr)

        const info = JSON.parse(stdout)
        console.log('[webm2pngs] Parsed JSON:', JSON.stringify(info, null, 2))

        // 检查 streams 是否存在
        if (!info.streams || info.streams.length === 0) {
          console.warn('[webm2pngs] ffprobe returned no streams, falling back to ffmpeg')
          return getVideoInfoWithFFmpeg(ffmpegPath, videoFile).then(resolve).catch(reject)
        }

        console.log('[webm2pngs] Found', info.streams.length, 'streams')
        info.streams.forEach((s, i) => {
          console.log(`[webm2pngs] Stream ${i}:`, s.codec_type, s.codec_name, s.width, s.height)
        })

        // 查找视频流（codec_type === 'video'）
        const videoStream = info.streams.find(s => s.codec_type === 'video')

        if (!videoStream) {
          // 没有视频流，检查是否是纯音频文件
          const audioStream = info.streams.find(s => s.codec_type === 'audio')
          console.error('[webm2pngs] No video stream found!')
          console.error('[webm2pngs] All streams:', info.streams.map(s => s.codec_type))
          if (audioStream) {
            return reject(new Error('This file contains only audio, no video stream found. Please select a video file.'))
          }
          return reject(new Error('No video stream found in this file.'))
        }

        console.log('[webm2pngs] Using video stream:', videoStream.codec_name, videoStream.width, videoStream.height)

        const stream = videoStream
        const format = info.format

        // 解析帧率
        const fpsStr = stream.r_frame_rate || '24/1'
        const [num, den] = fpsStr.split('/').map(Number)
        const fps = num / den

        // 计算总帧数
        let frames = parseInt(stream.nb_frames)
        if (!frames || isNaN(frames)) {
          // 如果没有 nb_frames，使用 duration * fps
          // 使用 Math.floor 向下取整，与 FFmpeg 的 fps:round=down 一致
          const duration = parseFloat(format.duration || 0)
          frames = Math.floor(duration * fps)
          console.log(`[Video Info] nb_frames not available, calculated from duration: ${duration}s * ${fps}fps = ${frames} frames`)
        }

        // 检测是否有 Alpha 通道
        // 方法 1: 像素格式包含 alpha
        const pixFmt = stream.pix_fmt || ''
        const hasAlphaPixFmt = /yuva420p|yuva444p|rgba|argb|bgra|abgr/i.test(pixFmt)

        // 方法 2: VP8/VP9 的 alpha_mode 元数据
        const alphaMode = stream.tags?.alpha_mode || '0'
        const hasAlphaMetadata = alphaMode === '1'

        const hasAlpha = hasAlphaPixFmt || hasAlphaMetadata

        console.log(`[Video Info] ${stream.width}x${stream.height}, ${fps}fps, ${frames} frames, pix_fmt: ${pixFmt}, alpha_mode: ${alphaMode}, alpha: ${hasAlpha}`)

        resolve({
          width: stream.width,
          height: stream.height,
          fps: fps,
          frames: frames,
          duration: parseFloat(format.duration || 0),
          hasAlpha: hasAlpha
        })
      } catch (parseErr) {
        reject(new Error('Failed to parse video info: ' + parseErr.message))
      }
    })
  })
}

/**
 * 使用 ffmpeg 获取视频信息（备用方案）
 */
function getVideoInfoWithFFmpeg(ffmpegPath, videoFile) {
  return new Promise((resolve, reject) => {
    const command = `${ffmpegPath} -i "${videoFile}" 2>&1`

    exec(command, (err, stdout, stderr) => {
      const output = stdout + stderr

      // 检查是否只有音频流
      const hasVideoStream = /Stream #\d+:\d+.*: Video:/.test(output)
      const hasAudioStream = /Stream #\d+:\d+.*: Audio:/.test(output)

      if (!hasVideoStream && hasAudioStream) {
        return reject(new Error('This file contains only audio, no video stream found. Please select a video file.'))
      }

      // 解析尺寸
      const sizeMatch = output.match(/(\d+)x(\d+)/)
      if (!sizeMatch) {
        return reject(new Error('Could not detect video size. This may not be a valid video file.'))
      }

      const width = parseInt(sizeMatch[1])
      const height = parseInt(sizeMatch[2])

      // 解析帧率
      const fpsMatch = output.match(/(\d+(?:\.\d+)?)\s*fps/)
      const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 24

      // 解析时长
      const durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
      let duration = 0
      if (durationMatch) {
        const hours = parseInt(durationMatch[1])
        const minutes = parseInt(durationMatch[2])
        const seconds = parseFloat(durationMatch[3])
        duration = hours * 3600 + minutes * 60 + seconds
      }

      // 使用 Math.floor 向下取整，与 FFmpeg 的 fps:round=down 一致
      const frames = Math.floor(duration * fps)

      // 检测是否有 Alpha 通道
      // 方法 1: 像素格式包含 alpha (yuva420p, rgba 等)
      // 方法 2: VP8/VP9 的 alpha_mode 元数据
      const hasAlphaPixFmt = /yuva420p|yuva444p|rgba|argb|bgra|abgr/i.test(output)
      const hasAlphaMetadata = /alpha_mode\s*:\s*1/i.test(output)
      const hasAlpha = hasAlphaPixFmt || hasAlphaMetadata

      console.log(`[Video Info] ${width}x${height}, ${fps}fps, ${frames} frames, alpha: ${hasAlpha} (pix_fmt: ${hasAlphaPixFmt}, metadata: ${hasAlphaMetadata})`)

      resolve({ width, height, fps, frames, duration, hasAlpha })
    })
  })
}

/**
 * 提取视频帧
 */
function extractFrames(item, store, locale, videoFile, tmpDir, numLen, videoInfo) {
  return new Promise((resolve, reject) => {
    detectFFmpeg(store).then((ffmpegPath) => {
      // ffmpeg 命令：提取所有帧为 PNG
      // -i input.webm: 输入文件
      // -vf "fps=fps": 保持原始帧率
      // -pix_fmt rgba: 强制使用 RGBA 像素格式（仅当视频有 Alpha 通道时）
      // -c:v png: 使用 PNG 编码器
      // apng%06d.png: 输出文件名模式（固定 6 位数字，支持最多 999,999 帧）
      const outputPattern = path.join(tmpDir, `apng%06d.png`)

      // 关键：只在视频真正有 Alpha 通道时使用 -pix_fmt rgba
      // yuv420p (无 Alpha) → 使用默认格式
      // yuva420p (有 Alpha) → 使用 rgba
      console.log(`[Extract] Video alpha detection: ${videoInfo.hasAlpha}`)

      let command
      if (videoInfo.hasAlpha) {
        console.log('[Extract] Video has alpha channel (yuva420p), using -pix_fmt rgba')
        // -vsync 0: 禁用帧同步，避免帧混合导致残影
        // fps:round=down: 向下取整，避免帧插值
        command = `"${ffmpegPath}" -i "${videoFile}" -vf "fps=${videoInfo.fps}:round=down" -vsync 0 -pix_fmt rgba -c:v png "${outputPattern}"`
      } else {
        console.log('[Extract] Video has no alpha channel (yuv420p), using default pixel format')
        // -vsync 0: 禁用帧同步，避免帧混合导致残影
        // fps:round=down: 向下取整，避免帧插值
        command = `"${ffmpegPath}" -i "${videoFile}" -vf "fps=${videoInfo.fps}:round=down" -vsync 0 -c:v png "${outputPattern}"`
      }

      console.log('Extracting frames with command:', command)

      store.dispatch('editProcess', {
        index: item.index,
        text: locale.analysing + `... (提取帧${videoInfo.hasAlpha ? '，保留透明度' : ''})`,
        schedule: 0.3
      })

      exec(command, (err, stdout, stderr) => {
        if (err) {
          console.error('FFmpeg error:', stderr)
          return reject(err)
        }

        console.log(`Frame extraction complete (alpha: ${videoInfo.hasAlpha})`)

        // 验证实际提取的帧数
        const extractedFiles = fs.readdirSync(tmpDir).filter(f => f.startsWith('apng') && f.endsWith('.png'))
        const actualFrameCount = extractedFiles.length

        console.log(`[Extract] Expected ${videoInfo.frames} frames, actually extracted ${actualFrameCount} frames`)

        if (actualFrameCount === 0) {
          return reject(new Error('No frames extracted from video'))
        }

        if (actualFrameCount < videoInfo.frames) {
          console.warn(`[Extract] Frame count mismatch: expected ${videoInfo.frames}, got ${actualFrameCount}`)
        }

        resolve({
          totalFrames: actualFrameCount,  // 使用实际提取的帧数
          numLen: numLen,
          frameRate: videoInfo.fps
        })
      })
    }).catch(reject)
  })
}

