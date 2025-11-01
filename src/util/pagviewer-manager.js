/**
 * PAGViewer 管理工具
 *
 * 功能：
 * 1. 检测系统中的 PAGViewer
 * 2. 自动下载 PAGViewer
 * 3. 自动安装 PAGViewer
 * 4. 配置环境变量
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs-extra'
import path from 'path'
import https from 'https'
import http from 'http'

const execAsync = promisify(exec)

// 下载控制器（用于暂停/停止下载）
let currentDownload = null

const PAGVIEWER_URLS = {
  darwin: 'https://pag.qq.com/update/libpag/PAGViewer.dmg',
  win32: 'https://pag.qq.com/update/libpag/PAGViewer_Installer.exe'
}

/**
 * 检测 PAGViewer
 */
export async function detectPAGViewer() {
  const platform = process.platform
  const result = {
    system: { found: false, path: '' },
    installed: { found: false, path: '' }
  }

  // 检测系统安装的 PAGViewer
  try {
    if (platform === 'darwin') {
      // macOS: 检查 /Applications/PAGViewer.app
      const systemPath = '/Applications/PAGViewer.app'
      if (fs.existsSync(systemPath)) {
        result.system.found = true
        result.system.path = systemPath
      }
    } else if (platform === 'win32') {
      // Windows: 检查常见安装路径
      const possiblePaths = [
        'C:\\Program Files\\PAGViewer\\PAGViewer.exe',
        'C:\\Program Files (x86)\\PAGViewer\\PAGViewer.exe',
        path.join(process.env.LOCALAPPDATA || '', 'PAGViewer', 'PAGViewer.exe')
      ]

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          result.system.found = true
          result.system.path = p
          break
        }
      }
    }
  } catch (err) {
    console.error('[PAGViewer] System detection failed:', err)
    // 不抛出错误，继续检测其他路径
  }

  // 检测自动安装的 PAGViewer（检查所有可能的安装位置）
  try {
    const possibleInstalledPaths = getInstalledPAGViewerPaths()

    for (const installedPath of possibleInstalledPaths) {
      if (installedPath && fs.existsSync(installedPath)) {
        result.installed.found = true
        result.installed.path = installedPath
        console.log(`[PAGViewer] Found installed PAGViewer: ${installedPath}`)
        break
      }
    }
  } catch (err) {
    console.error('[PAGViewer] Installed detection failed:', err)
    // 不抛出错误，返回空结果
  }

  return result
}

/**
 * 获取所有可能的自动安装 PAGViewer 路径（按优先级排序）
 */
function getInstalledPAGViewerPaths() {
  const platform = process.platform
  const appDataDir = getAppDataDir()
  const paths = []

  if (platform === 'darwin') {
    // macOS: 检查系统目录和用户数据目录
    paths.push('/Applications/PAGViewer.app')  // 系统安装位置（优先）
    paths.push(path.join(appDataDir, 'PAGViewer', 'PAGViewer.app'))  // 用户数据目录（修复路径）
  } else if (platform === 'win32') {
    // Windows: 检查 Program Files 和用户数据目录
    paths.push('C:\\Program Files\\PAGViewer\\PAGViewer.exe')
    paths.push('C:\\Program Files (x86)\\PAGViewer\\PAGViewer.exe')
    paths.push(path.join(process.env.LOCALAPPDATA || '', 'PAGViewer', 'PAGViewer.exe'))
    paths.push(path.join(appDataDir, 'PAGViewer', 'PAGViewer.exe'))
  }

  return paths
}

/**
 * 获取自动安装的 PAGViewer 路径（兼容旧代码）
 */
function getInstalledPAGViewerPath() {
  const paths = getInstalledPAGViewerPaths()

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
    console.warn('[PAGViewer] Failed to get userData path, using fallback:', err.message)
  }

  // 降级方案：使用临时目录（与 store/index.js 一致）
  const os = require('os')
  return path.join(os.tmpdir(), 'iLamage')
}

/**
 * 下载 PAGViewer（支持暂停/停止）
 */
export async function downloadPAGViewer(onProgress) {
  const platform = process.platform
  const url = PAGVIEWER_URLS[platform]

  if (!url) {
    const error = new Error(`不支持的平台: ${platform}`)
    console.error('[PAGViewer]', error.message)
    throw error
  }

  const appDataDir = getAppDataDir()
  const downloadDir = path.join(appDataDir, 'downloads')

  try {
    fs.ensureDirSync(downloadDir)
  } catch (err) {
    console.error('[PAGViewer] Failed to create download directory:', err)
    throw new Error(`无法创建下载目录: ${err.message}`)
  }

  const fileName = platform === 'darwin' ? 'PAGViewer.dmg' : 'PAGViewer_Installer.exe'
  const downloadPath = path.join(downloadDir, fileName)

  console.log(`[PAGViewer] Downloading from ${url} to ${downloadPath}`)

  return new Promise((resolve, reject) => {
    let request = null
    let fileStream = null
    let cancelled = false

    // 保存下载控制器
    currentDownload = {
      cancel: () => {
        console.log('[PAGViewer] Download cancelled by user')
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
          console.error('[PAGViewer] Failed to clean up partial download:', err)
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
              console.error('[PAGViewer] Invalid redirect URL:', redirectUrl, err)
              reject(new Error(`无效的重定向地址: ${redirectUrl}`))
              return
            }
          }

          console.log(`[PAGViewer] Redirecting to ${redirectUrl}`)

          // 递归处理重定向
          try {
            const redirectProtocol = redirectUrl.startsWith('https') ? https : http
            redirectProtocol.get(redirectUrl, handleResponse).on('error', (err) => {
              if (!cancelled) {
                console.error('[PAGViewer] Redirect request failed:', err)
                reject(new Error(`重定向请求失败: ${err.message}`))
              }
            })
          } catch (err) {
            console.error('[PAGViewer] Failed to follow redirect:', err)
            reject(new Error(`无法跟随重定向: ${err.message}`))
          }
          return
        }

        handleResponse(response)
      })

      request.on('error', (err) => {
        if (!cancelled) {
          console.error('[PAGViewer] Download request failed:', err)
          reject(new Error(`下载请求失败: ${err.message}`))
        }
      })

      request.setTimeout(30000, () => {
        if (!cancelled) {
          console.error('[PAGViewer] Download request timeout')
          request.destroy()
          reject(new Error('下载请求超时（30秒）'))
        }
      })
    } catch (err) {
      console.error('[PAGViewer] Failed to create download request:', err)
      reject(new Error(`无法创建下载请求: ${err.message}`))
      return
    }

    function handleResponse(response) {
      if (cancelled) return

      if (response.statusCode !== 200) {
        const error = new Error(`下载失败，HTTP 状态码: ${response.statusCode}`)
        console.error('[PAGViewer]', error.message)
        reject(error)
        return
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10)
      let downloadedSize = 0

      console.log(`[PAGViewer] Download started, total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)

      try {
        fileStream = fs.createWriteStream(downloadPath)
      } catch (err) {
        console.error('[PAGViewer] Failed to create file stream:', err)
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
            console.error('[PAGViewer] Progress callback error:', err)
          }
        }
      })

      response.pipe(fileStream)

      fileStream.on('finish', () => {
        if (cancelled) return

        fileStream.close(() => {
          console.log(`[PAGViewer] Download complete: ${downloadPath}`)
          currentDownload = null
          resolve(downloadPath)
        })
      })

      fileStream.on('error', (err) => {
        if (cancelled) return

        console.error('[PAGViewer] File stream error:', err)

        try {
          if (fs.existsSync(downloadPath)) {
            fs.unlinkSync(downloadPath)
          }
        } catch (cleanupErr) {
          console.error('[PAGViewer] Failed to clean up failed download:', cleanupErr)
        }

        reject(new Error(`文件写入失败: ${err.message}`))
      })

      response.on('error', (err) => {
        if (cancelled) return

        console.error('[PAGViewer] Response stream error:', err)
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
 * 安装 PAGViewer
 * @param {string} downloadedPath - 下载的文件路径
 * @param {boolean} installToSystem - 是否安装到系统目录（macOS: /Applications, Windows: Program Files）
 */
export async function installPAGViewer(downloadedPath, installToSystem = true) {
  const platform = process.platform

  if (!downloadedPath || !fs.existsSync(downloadedPath)) {
    const error = new Error('安装文件不存在')
    console.error('[PAGViewer]', error.message, downloadedPath)
    throw error
  }

  try {
    if (platform === 'darwin') {
      return await installPAGViewerMacOS(downloadedPath, installToSystem)
    } else if (platform === 'win32') {
      return await installPAGViewerWindows(downloadedPath, installToSystem)
    } else {
      throw new Error(`不支持的平台: ${platform}`)
    }
  } catch (err) {
    console.error('[PAGViewer] Installation failed:', err)
    throw new Error(`安装失败: ${err.message}`)
  }
}

/**
 * 安装 PAGViewer (macOS)
 * @param {string} dmgPath - DMG 文件路径
 * @param {boolean} installToSystem - 是否安装到 /Applications（true）或应用数据目录（false）
 */
async function installPAGViewerMacOS(dmgPath, installToSystem = true) {
  console.log(`[PAGViewer] Installing from ${dmgPath} (installToSystem: ${installToSystem})`)

  let mountPoint = null

  try {
    // 挂载 DMG
    console.log('[PAGViewer] Mounting DMG...')
    const { stdout: mountOutput } = await execAsync(`hdiutil attach "${dmgPath}" -nobrowse -noverify`, {
      timeout: 60000 // 60秒超时
    })

    // 解析挂载点
    const mountMatch = mountOutput.match(/\/Volumes\/[^\n]+/)
    if (!mountMatch) {
      throw new Error('无法找到 DMG 挂载点')
    }
    mountPoint = mountMatch[0]
    console.log(`[PAGViewer] Mounted at: ${mountPoint}`)

    // 查找 .app 文件
    let appFiles
    try {
      appFiles = fs.readdirSync(mountPoint).filter(f => f.endsWith('.app'))
    } catch (err) {
      throw new Error(`无法读取挂载点内容: ${err.message}`)
    }

    if (appFiles.length === 0) {
      throw new Error('DMG 中未找到 .app 文件')
    }

    const appName = appFiles[0]
    const sourcePath = path.join(mountPoint, appName)

    // 根据选项决定安装位置
    let targetPath
    if (installToSystem) {
      // 安装到 /Applications 目录
      targetPath = path.join('/Applications', appName)
    } else {
      // 安装到应用数据目录
      const appDataDir = getAppDataDir()
      const pagviewerDir = path.join(appDataDir, 'PAGViewer')
      try {
        fs.ensureDirSync(pagviewerDir)
      } catch (err) {
        throw new Error(`无法创建安装目录: ${err.message}`)
      }
      targetPath = path.join(pagviewerDir, appName)
    }

    console.log(`[PAGViewer] Copying ${sourcePath} to ${targetPath}`)

    // 删除旧版本
    if (fs.existsSync(targetPath)) {
      try {
        if (installToSystem) {
          // 需要管理员权限删除 /Applications 下的文件
          await execAsync(`osascript -e 'do shell script "rm -rf \\"${targetPath}\\"" with administrator privileges'`, { timeout: 60000 })
        } else {
          // 应用数据目录不需要管理员权限
          await execAsync(`rm -rf "${targetPath}"`, { timeout: 30000 })
        }
      } catch (err) {
        console.warn('[PAGViewer] Failed to remove old version:', err)
        // 如果用户取消授权，尝试不使用 sudo
        if (installToSystem) {
          try {
            await execAsync(`rm -rf "${targetPath}"`, { timeout: 30000 })
          } catch (err2) {
            console.warn('[PAGViewer] Failed to remove old version without sudo:', err2)
            // 继续安装，不抛出错误
          }
        }
      }
    }

    // 复制新版本
    try {
      if (installToSystem) {
        // 需要管理员权限复制到 /Applications
        await execAsync(`osascript -e 'do shell script "cp -R \\"${sourcePath}\\" \\"${targetPath}\\"" with administrator privileges'`, { timeout: 120000 })
      } else {
        // 应用数据目录不需要管理员权限
        await execAsync(`cp -R "${sourcePath}" "${targetPath}"`, { timeout: 120000 })
      }
    } catch (err) {
      console.error('[PAGViewer] Failed to copy:', err)
      // 如果用户取消授权，尝试不使用 sudo
      if (installToSystem) {
        try {
          await execAsync(`cp -R "${sourcePath}" "${targetPath}"`, { timeout: 120000 })
        } catch (err2) {
          throw new Error(`复制文件失败: ${err2.message}`)
        }
      } else {
        throw new Error(`复制文件失败: ${err.message}`)
      }
    }

    console.log(`[PAGViewer] PAGViewer installed to: ${targetPath}`)
    return targetPath

  } catch (err) {
    console.error('[PAGViewer] Installation failed:', err)
    throw err

  } finally {
    // 确保卸载 DMG
    if (mountPoint) {
      try {
        console.log('[PAGViewer] Unmounting DMG...')
        await execAsync(`hdiutil detach "${mountPoint}"`, { timeout: 30000 })
      } catch (err) {
        console.error('[PAGViewer] Failed to unmount DMG:', err)
        // 不抛出错误，因为安装可能已经成功
      }
    }
  }
}

/**
 * 安装 PAGViewer (Windows)
 * @param {string} exePath - 安装程序路径
 * @param {boolean} installToSystem - 是否安装到系统目录（Windows 安装程序会自己处理）
 */
async function installPAGViewerWindows(exePath, installToSystem = true) {
  console.log(`[PAGViewer] Installing from ${exePath} (installToSystem: ${installToSystem})`)

  // Windows 安装程序通常需要用户交互
  // 我们启动安装程序，但让用户完成安装
  const { shell } = require('@electron/remote')
  const { dialog } = require('@electron/remote')

  return new Promise((resolve, reject) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'PAGViewer 安装',
      message: '即将启动 PAGViewer 安装程序',
      detail: '请按照安装向导完成安装。\n\n建议安装到默认位置，以便自动检测。\n\n安装完成后，请点击"完成"按钮。',
      buttons: ['取消', '启动安装程序']
    }).then((result) => {
      if (result.response === 1) {
        // 启动安装程序
        shell.openPath(exePath).then(() => {
          // 等待用户完成安装
          dialog.showMessageBox({
            type: 'question',
            title: 'PAGViewer 安装',
            message: '安装完成了吗？',
            detail: '请在完成 PAGViewer 安装后点击"完成"按钮。',
            buttons: ['取消', '完成']
          }).then((result2) => {
            if (result2.response === 1) {
              // 检查常见安装路径
              const possiblePaths = [
                'C:\\Program Files\\PAGViewer\\PAGViewer.exe',
                'C:\\Program Files (x86)\\PAGViewer\\PAGViewer.exe',
                path.join(process.env.LOCALAPPDATA || '', 'PAGViewer', 'PAGViewer.exe')
              ]

              for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                  console.log(`[PAGViewer] Found installed PAGViewer at: ${p}`)
                  resolve(p)
                  return
                }
              }

              reject(new Error('未找到已安装的 PAGViewer，请手动配置路径'))
            } else {
              reject(new Error('用户取消安装'))
            }
          }).catch((err) => {
            console.error('[PAGViewer] Dialog error:', err)
            reject(new Error(`对话框错误: ${err.message}`))
          })
        }).catch((err) => {
          console.error('[PAGViewer] Failed to open installer:', err)
          reject(new Error(`无法启动安装程序: ${err.message}`))
        })
      } else {
        reject(new Error('用户取消安装'))
      }
    }).catch((err) => {
      console.error('[PAGViewer] Dialog error:', err)
      reject(new Error(`对话框错误: ${err.message}`))
    })
  })
}

/**
 * 获取当前配置的 PAGViewer 路径
 */
export function getCurrentPAGViewerPath() {
  try {
    // 优先级：自定义 > 自动安装 > 系统
    const customPath = window.storage?.getItem('pagviewerPath')
    if (customPath && fs.existsSync(customPath)) {
      return customPath
    }

    const installedPath = getInstalledPAGViewerPath()
    if (installedPath && fs.existsSync(installedPath)) {
      return installedPath
    }

    // 检测系统路径（同步版本）
    const platform = process.platform
    if (platform === 'darwin') {
      const systemPath = '/Applications/PAGViewer.app'
      if (fs.existsSync(systemPath)) {
        return systemPath
      }
    } else if (platform === 'win32') {
      const possiblePaths = [
        'C:\\Program Files\\PAGViewer\\PAGViewer.exe',
        'C:\\Program Files (x86)\\PAGViewer\\PAGViewer.exe',
        path.join(process.env.LOCALAPPDATA || '', 'PAGViewer', 'PAGViewer.exe')
      ]

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          return p
        }
      }
    }

    return null
  } catch (err) {
    console.error('[PAGViewer] Failed to get current path:', err)
    return null
  }
}

