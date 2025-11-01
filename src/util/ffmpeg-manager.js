/**
 * FFmpeg 管理工具
 *
 * 功能：
 * 1. 检测系统中的 FFmpeg
 * 2. 自动下载 FFmpeg
 * 3. 自动安装 FFmpeg
 * 4. 配置环境变量
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs-extra'
import path from 'path'
import https from 'https'
import http from 'http'
import AdmZip from 'adm-zip'

const execAsync = promisify(exec)

// 下载控制器（用于暂停/停止下载）
let currentDownload = null

// FFmpeg 下载地址（使用 GitHub Releases）
const FFMPEG_URLS = {
  darwin: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
  win32: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
}

// FFprobe 下载地址
const FFPROBE_URLS = {
  darwin: 'https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip',
  win32: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' // Windows 版本包含 ffprobe
}

/**
 * 检测 FFmpeg
 */
export async function detectFFmpeg() {
  const platform = process.platform
  const result = {
    system: { found: false, path: '' },
    installed: { found: false, path: '' }
  }

  // 检测系统安装的 FFmpeg
  try {
    if (platform === 'darwin') {
      // macOS: 尝试常见路径
      const possiblePaths = [
        '/usr/local/bin/ffmpeg',
        '/opt/homebrew/bin/ffmpeg',
        '/usr/bin/ffmpeg'
      ]

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          result.system.found = true
          result.system.path = p
          break
        }
      }

      // 尝试 which ffmpeg
      if (!result.system.found) {
        try {
          const { stdout } = await execAsync('which ffmpeg')
          const ffmpegPath = stdout.trim()
          if (ffmpegPath && fs.existsSync(ffmpegPath)) {
            result.system.found = true
            result.system.path = ffmpegPath
          }
        } catch (err) {
          // which 命令失败，说明系统没有 ffmpeg
        }
      }
    } else if (platform === 'win32') {
      // Windows: 尝试 where ffmpeg
      try {
        const { stdout } = await execAsync('where ffmpeg')
        const ffmpegPath = stdout.split('\n')[0].trim()
        if (ffmpegPath && fs.existsSync(ffmpegPath)) {
          result.system.found = true
          result.system.path = ffmpegPath
        }
      } catch (err) {
        // where 命令失败，说明系统没有 ffmpeg
      }
    }
  } catch (err) {
    console.error('[FFmpeg] System detection failed:', err)
    // 不抛出错误，继续检测其他路径
  }

  // 检测自动安装的 FFmpeg（检查所有可能的安装位置）
  try {
    const possibleInstalledPaths = getInstalledFFmpegPaths()

    for (const installedPath of possibleInstalledPaths) {
      if (installedPath && fs.existsSync(installedPath)) {
        result.installed.found = true
        result.installed.path = installedPath
        console.log(`[FFmpeg] Found installed FFmpeg: ${installedPath}`)
        break
      }
    }
  } catch (err) {
    console.error('[FFmpeg] Installed detection failed:', err)
    // 不抛出错误，返回空结果
  }

  return result
}

/**
 * 获取所有可能的自动安装 FFmpeg 路径（按优先级排序）
 */
function getInstalledFFmpegPaths() {
  const platform = process.platform
  const appDataDir = getAppDataDir()
  const paths = []

  if (platform === 'darwin') {
    // macOS: 检查用户数据目录和 public/bin
    paths.push(path.join(appDataDir, 'ffmpeg', 'ffmpeg'))  // 自动下载安装的位置
    paths.push(path.join(process.cwd(), 'public', 'bin', 'darwin', 'ffmpeg'))  // 打包时的内置版本
  } else if (platform === 'win32') {
    // Windows: 检查用户数据目录和 public/bin
    paths.push(path.join(appDataDir, 'ffmpeg', 'bin', 'ffmpeg.exe'))
    paths.push(path.join(process.cwd(), 'public', 'bin', 'win32', 'ffmpeg.exe'))
  }

  return paths
}

/**
 * 获取自动安装的 FFmpeg 路径（兼容旧代码）
 */
function getInstalledFFmpegPath() {
  const paths = getInstalledFFmpegPaths()

  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      return p
    }
  }

  return null
}

/**
 * 获取所有可能的自动安装 ffprobe 路径（按优先级排序）
 */
function getInstalledFFprobePaths() {
  const platform = process.platform
  const appDataDir = getAppDataDir()
  const paths = []

  if (platform === 'darwin') {
    // macOS: 检查用户数据目录和 public/bin
    paths.push(path.join(appDataDir, 'ffmpeg', 'ffprobe'))  // 与 ffmpeg 同目录
    paths.push(path.join(process.cwd(), 'public', 'bin', 'darwin', 'ffprobe'))
  } else if (platform === 'win32') {
    // Windows: 检查用户数据目录和 public/bin
    paths.push(path.join(appDataDir, 'ffmpeg', 'bin', 'ffprobe.exe'))
    paths.push(path.join(process.cwd(), 'public', 'bin', 'win32', 'ffprobe.exe'))
  }

  return paths
}

/**
 * 获取自动安装的 ffprobe 路径
 */
function getInstalledFFprobePath() {
  const paths = getInstalledFFprobePaths()

  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      return p
    }
  }

  return null
}

/**
 * 获取应用数据目录
 * 使用 Electron 的 userData 路径，确保有完整权限
 */
function getAppDataDir() {
  try {
    // 优先使用 Electron 的 app.getPath('userData')
    const { app } = require('@electron/remote')
    if (app && app.getPath) {
      return app.getPath('userData')
    }
  } catch (err) {
    console.warn('[FFmpeg] Failed to get userData path, using fallback:', err.message)
  }

  // 降级方案：使用临时目录（与 store/index.js 一致）
  const os = require('os')
  return path.join(os.tmpdir(), 'iLamage')
}

/**
 * 下载 FFmpeg 和 FFprobe（支持暂停/停止）
 */
export async function downloadFFmpeg(onProgress) {
  const platform = process.platform

  if (!FFMPEG_URLS[platform]) {
    const error = new Error(`不支持的平台: ${platform}`)
    console.error('[FFmpeg]', error.message)
    throw error
  }

  const appDataDir = getAppDataDir()
  const downloadDir = path.join(appDataDir, 'downloads')

  try {
    fs.ensureDirSync(downloadDir)
  } catch (err) {
    console.error('[FFmpeg] Failed to create download directory:', err)
    throw new Error(`无法创建下载目录: ${err.message}`)
  }

  // macOS: 需要分别下载 ffmpeg 和 ffprobe
  // Windows: 一个压缩包包含两者
  if (platform === 'darwin') {
    console.log('[FFmpeg] Downloading ffmpeg and ffprobe for macOS...')

    // 下载 ffmpeg
    const ffmpegPath = path.join(downloadDir, 'ffmpeg.zip')
    await downloadFile(FFMPEG_URLS.darwin, ffmpegPath, (progress) => {
      if (onProgress) onProgress(progress * 0.5) // 前 50%
    })

    // 下载 ffprobe
    const ffprobePath = path.join(downloadDir, 'ffprobe.zip')
    await downloadFile(FFPROBE_URLS.darwin, ffprobePath, (progress) => {
      if (onProgress) onProgress(0.5 + progress * 0.5) // 后 50%
    })

    console.log('[FFmpeg] Both ffmpeg and ffprobe downloaded')
    return { ffmpeg: ffmpegPath, ffprobe: ffprobePath }
  } else {
    // Windows: 一个压缩包包含两者
    const downloadPath = path.join(downloadDir, 'ffmpeg.zip')
    await downloadFile(FFMPEG_URLS.win32, downloadPath, onProgress)
    return { ffmpeg: downloadPath, ffprobe: null }
  }
}

/**
 * 下载单个文件（内部函数）
 */
async function downloadFile(url, downloadPath, onProgress) {
  console.log(`[FFmpeg] Downloading from ${url} to ${downloadPath}`)

  return new Promise((resolve, reject) => {
    let request = null
    let fileStream = null
    let cancelled = false

    // 保存下载控制器
    currentDownload = {
      cancel: () => {
        console.log('[FFmpeg] Download cancelled by user')
        cancelled = true

        if (request) {
          request.destroy()
        }

        if (fileStream) {
          fileStream.close()
        }

        // 清理未完成的文件
        try {
          if (fs.existsSync(downloadPath)) {
            fs.unlinkSync(downloadPath)
          }
        } catch (err) {
          console.error('[FFmpeg] Failed to clean up partial download:', err)
        }

        reject(new Error('下载已取消'))
      }
    }

    const protocol = url.startsWith('https') ? https : http

    try {
      request = protocol.get(url, (response) => {
        if (cancelled) return

        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          let redirectUrl = response.headers.location

          if (!redirectUrl) {
            reject(new Error('重定向地址为空'))
            return
          }

          // 处理相对路径重定向
          if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
            try {
              const originalUrl = new URL(url)
              redirectUrl = new URL(redirectUrl, originalUrl).href
            } catch (err) {
              console.error('[FFmpeg] Invalid redirect URL:', redirectUrl, err)
              reject(new Error(`无效的重定向地址: ${redirectUrl}`))
              return
            }
          }

          console.log(`[FFmpeg] Redirecting to ${redirectUrl}`)

          // 递归处理重定向
          try {
            const redirectProtocol = redirectUrl.startsWith('https') ? https : http
            redirectProtocol.get(redirectUrl, handleResponse).on('error', (err) => {
              if (!cancelled) {
                console.error('[FFmpeg] Redirect request failed:', err)
                reject(new Error(`重定向请求失败: ${err.message}`))
              }
            })
          } catch (err) {
            console.error('[FFmpeg] Failed to follow redirect:', err)
            reject(new Error(`无法跟随重定向: ${err.message}`))
          }
          return
        }

        handleResponse(response)
      })

      request.on('error', (err) => {
        if (!cancelled) {
          console.error('[FFmpeg] Download request failed:', err)
          reject(new Error(`下载请求失败: ${err.message}`))
        }
      })

      request.setTimeout(30000, () => {
        if (!cancelled) {
          console.error('[FFmpeg] Download request timeout')
          request.destroy()
          reject(new Error('下载请求超时（30秒）'))
        }
      })
    } catch (err) {
      console.error('[FFmpeg] Failed to create download request:', err)
      reject(new Error(`无法创建下载请求: ${err.message}`))
      return
    }

    function handleResponse(response) {
      if (cancelled) return

      if (response.statusCode !== 200) {
        const error = new Error(`下载失败，HTTP 状态码: ${response.statusCode}`)
        console.error('[FFmpeg]', error.message)
        reject(error)
        return
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10)
      let downloadedSize = 0

      console.log(`[FFmpeg] Download started, total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)

      try {
        fileStream = fs.createWriteStream(downloadPath)
      } catch (err) {
        console.error('[FFmpeg] Failed to create file stream:', err)
        reject(new Error(`无法创建文件: ${err.message}`))
        return
      }

      response.on('data', (chunk) => {
        if (cancelled) return

        downloadedSize += chunk.length
        if (totalSize > 0 && onProgress) {
          try {
            onProgress(downloadedSize / totalSize)
          } catch (err) {
            console.error('[FFmpeg] Progress callback error:', err)
          }
        }
      })

      response.pipe(fileStream)

      fileStream.on('finish', () => {
        if (cancelled) return

        fileStream.close(() => {
          console.log(`[FFmpeg] Download complete: ${downloadPath}`)
          currentDownload = null
          resolve(downloadPath)
        })
      })

      fileStream.on('error', (err) => {
        if (cancelled) return

        console.error('[FFmpeg] File stream error:', err)

        try {
          if (fs.existsSync(downloadPath)) {
            fs.unlinkSync(downloadPath)
          }
        } catch (cleanupErr) {
          console.error('[FFmpeg] Failed to clean up failed download:', cleanupErr)
        }

        reject(new Error(`文件写入失败: ${err.message}`))
      })

      response.on('error', (err) => {
        if (cancelled) return

        console.error('[FFmpeg] Response stream error:', err)
        reject(new Error(`下载流错误: ${err.message}`))
      })
    }
  })
}

/**
 * 取消当前下载
 */
export function cancelDownload() {
  if (currentDownload && currentDownload.cancel) {
    currentDownload.cancel()
    return true
  }
  return false
}

/**
 * 检查是否有正在进行的下载
 */
export function isDownloading() {
  return currentDownload !== null
}

/**
 * 安装 FFmpeg 和 FFprobe
 * @param {Object|string} downloadedPath - 下载的文件路径（对象或字符串）
 */
export async function installFFmpeg(downloadedPath) {
  const platform = process.platform

  // 兼容旧版本（字符串路径）和新版本（对象）
  let ffmpegPath, ffprobePath
  if (typeof downloadedPath === 'string') {
    ffmpegPath = downloadedPath
    ffprobePath = null
  } else {
    ffmpegPath = downloadedPath.ffmpeg
    ffprobePath = downloadedPath.ffprobe
  }

  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    const error = new Error('FFmpeg 安装文件不存在')
    console.error('[FFmpeg]', error.message, ffmpegPath)
    throw error
  }

  console.log(`[FFmpeg] Installing from ${ffmpegPath}`)
  if (ffprobePath) {
    console.log(`[FFmpeg] Installing ffprobe from ${ffprobePath}`)
  }

  const appDataDir = getAppDataDir()
  const ffmpegDir = path.join(appDataDir, 'ffmpeg')

  // 删除旧版本
  if (fs.existsSync(ffmpegDir)) {
    try {
      fs.removeSync(ffmpegDir)
    } catch (err) {
      console.error('[FFmpeg] Failed to remove old version:', err)
      throw new Error(`无法删除旧版本: ${err.message}`)
    }
  }

  try {
    fs.ensureDirSync(ffmpegDir)
  } catch (err) {
    console.error('[FFmpeg] Failed to create installation directory:', err)
    throw new Error(`无法创建安装目录: ${err.message}`)
  }

  try {
    // 解压 ffmpeg ZIP 文件
    console.log('[FFmpeg] Extracting ffmpeg archive...')
    let zip
    try {
      zip = new AdmZip(ffmpegPath)
    } catch (err) {
      console.error('[FFmpeg] Failed to open ffmpeg archive:', err)
      throw new Error(`无法打开 ffmpeg 压缩文件: ${err.message}`)
    }

    const zipEntries = zip.getEntries()

    if (platform === 'darwin') {
      // macOS: 提取 ffmpeg 可执行文件
      const ffmpegEntry = zipEntries.find(entry => entry.entryName === 'ffmpeg' || entry.entryName.endsWith('/ffmpeg'))

      if (!ffmpegEntry) {
        throw new Error('压缩包中未找到 FFmpeg 可执行文件')
      }

      const ffmpegTargetPath = path.join(ffmpegDir, 'ffmpeg')

      try {
        // 提取 ffmpeg
        zip.extractEntryTo(ffmpegEntry, ffmpegDir, false, true)
        console.log('[FFmpeg] Extracted ffmpeg')
      } catch (err) {
        console.error('[FFmpeg] Failed to extract ffmpeg:', err)
        throw new Error(`解压 ffmpeg 失败: ${err.message}`)
      }

      // 添加 ffmpeg 执行权限
      try {
        await execAsync(`chmod +x "${ffmpegTargetPath}"`, { timeout: 10000 })
        console.log('[FFmpeg] Set executable permission for ffmpeg')
      } catch (err) {
        console.error('[FFmpeg] Failed to set executable permission for ffmpeg:', err)
        throw new Error(`设置 ffmpeg 执行权限失败: ${err.message}`)
      }

      // 如果有单独的 ffprobe 压缩包，解压它
      if (ffprobePath && fs.existsSync(ffprobePath)) {
        console.log('[FFmpeg] Extracting ffprobe archive...')
        let ffprobeZip
        try {
          ffprobeZip = new AdmZip(ffprobePath)
        } catch (err) {
          console.error('[FFmpeg] Failed to open ffprobe archive:', err)
          console.warn('[FFmpeg] ffprobe 安装失败，部分功能可能受限')
        }

        if (ffprobeZip) {
          const ffprobeEntries = ffprobeZip.getEntries()
          const ffprobeEntry = ffprobeEntries.find(entry => entry.entryName === 'ffprobe' || entry.entryName.endsWith('/ffprobe'))

          if (ffprobeEntry) {
            const ffprobeTargetPath = path.join(ffmpegDir, 'ffprobe')

            try {
              ffprobeZip.extractEntryTo(ffprobeEntry, ffmpegDir, false, true)
              console.log('[FFmpeg] Extracted ffprobe')

              // 添加 ffprobe 执行权限
              await execAsync(`chmod +x "${ffprobeTargetPath}"`, { timeout: 10000 })
              console.log('[FFmpeg] Set executable permission for ffprobe')
            } catch (err) {
              console.error('[FFmpeg] Failed to extract/chmod ffprobe:', err)
              console.warn('[FFmpeg] ffprobe 安装失败，部分功能可能受限')
            }
          } else {
            console.warn('[FFmpeg] ffprobe 压缩包中未找到 ffprobe 可执行文件')
          }
        }
      } else {
        console.warn('[FFmpeg] 未提供 ffprobe 压缩包，部分功能可能受限')
      }

      console.log(`[FFmpeg] FFmpeg installed to: ${ffmpegTargetPath}`)
      const ffprobeTargetPath = path.join(ffmpegDir, 'ffprobe')
      if (fs.existsSync(ffprobeTargetPath)) {
        console.log(`[FFmpeg] ffprobe installed to: ${ffprobeTargetPath}`)
      }
      return ffmpegTargetPath

    } else if (platform === 'win32') {
      // Windows: 提取整个 bin 目录
      try {
        zip.extractAllTo(ffmpegDir, true)
      } catch (err) {
        console.error('[FFmpeg] Failed to extract archive:', err)
        throw new Error(`解压文件失败: ${err.message}`)
      }

      // 查找文件的通用函数
      const findFile = (dir, filename) => {
        try {
          const files = fs.readdirSync(dir)
          for (const file of files) {
            const fullPath = path.join(dir, file)
            const stat = fs.statSync(fullPath)

            if (stat.isDirectory()) {
              const result = findFile(fullPath, filename)
              if (result) return result
            } else if (file === filename) {
              return fullPath
            }
          }
        } catch (err) {
          console.error('[FFmpeg] Error searching directory:', dir, err)
        }
        return null
      }

      const ffmpegExe = findFile(ffmpegDir, 'ffmpeg.exe')
      const ffprobeExe = findFile(ffmpegDir, 'ffprobe.exe')

      if (!ffmpegExe) {
        throw new Error('压缩包中未找到 ffmpeg.exe')
      }
      if (!ffprobeExe) {
        console.warn('[FFmpeg] 压缩包中未找到 ffprobe.exe，部分功能可能受限')
      }

      // 移动到标准位置
      const binDir = path.join(ffmpegDir, 'bin')
      try {
        fs.ensureDirSync(binDir)
      } catch (err) {
        console.error('[FFmpeg] Failed to create bin directory:', err)
        throw new Error(`无法创建 bin 目录: ${err.message}`)
      }

      const ffmpegTarget = path.join(binDir, 'ffmpeg.exe')
      const ffprobeTarget = path.join(binDir, 'ffprobe.exe')

      // 复制 ffmpeg.exe
      if (ffmpegExe !== ffmpegTarget) {
        try {
          fs.copyFileSync(ffmpegExe, ffmpegTarget)
          console.log('[FFmpeg] Copied ffmpeg.exe to bin directory')
        } catch (err) {
          console.error('[FFmpeg] Failed to copy ffmpeg.exe:', err)
          throw new Error(`复制 ffmpeg.exe 失败: ${err.message}`)
        }
      }

      // 复制 ffprobe.exe（如果存在）
      if (ffprobeExe && ffprobeExe !== ffprobeTarget) {
        try {
          fs.copyFileSync(ffprobeExe, ffprobeTarget)
          console.log('[FFmpeg] Copied ffprobe.exe to bin directory')
        } catch (err) {
          console.warn('[FFmpeg] Failed to copy ffprobe.exe:', err)
        }
      }

      console.log(`[FFmpeg] FFmpeg installed to: ${ffmpegTarget}`)
      if (ffprobeExe) {
        console.log(`[FFmpeg] ffprobe installed to: ${ffprobeTarget}`)
      }
      return ffmpegTarget
    }
  } catch (err) {
    console.error('[FFmpeg] Installation failed:', err)
    throw err
  }
}

/**
 * 获取当前配置的 FFmpeg 路径
 */
export function getCurrentFFmpegPath() {
  try {
    // 优先级：自定义 > 自动安装 > 系统
    const customPath = window.storage?.getItem('ffmpegPath')
    if (customPath && fs.existsSync(customPath)) {
      return customPath
    }

    const installedPath = getInstalledFFmpegPath()
    if (installedPath && fs.existsSync(installedPath)) {
      return installedPath
    }

    // 检测系统路径（同步版本）
    const platform = process.platform
    if (platform === 'darwin') {
      const possiblePaths = [
        '/usr/local/bin/ffmpeg',
        '/opt/homebrew/bin/ffmpeg',
        '/usr/bin/ffmpeg'
      ]

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          return p
        }
      }
    }

    return null
  } catch (err) {
    console.error('[FFmpeg] Failed to get current path:', err)
    return null
  }
}

