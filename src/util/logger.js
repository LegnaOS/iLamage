/**
 * 日志工具 - 支持打包后输出到文件
 */
import fs from 'fs-extra'
import path from 'path'
import os from 'os'

const isDev = process.env.NODE_ENV === 'development'
const logDir = path.join(os.tmpdir(), 'iLamage-logs')
const logFile = path.join(logDir, `app-${Date.now()}.log`)

// 确保日志目录存在
if (!isDev) {
  try {
    fs.ensureDirSync(logDir)
    console.log('[Logger] Log file:', logFile)
  } catch (err) {
    console.error('[Logger] Failed to create log directory:', err)
  }
}

/**
 * 写入日志（开发环境用console，打包后写文件）
 */
function log(level, tag, ...args) {
  const timestamp = new Date().toISOString()
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2)
      } catch (e) {
        return String(arg)
      }
    }
    return String(arg)
  }).join(' ')

  const logLine = `[${timestamp}] [${level}] [${tag}] ${message}\n`

  // 开发环境：输出到控制台
  if (isDev) {
    const consoleMethod = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
    consoleMethod(`[${tag}]`, ...args)
  } else {
    // 打包后：写入文件
    try {
      fs.appendFileSync(logFile, logLine)
    } catch (err) {
      console.error('[Logger] Failed to write log:', err)
    }
  }
}

export default {
  info: (tag, ...args) => log('INFO', tag, ...args),
  warn: (tag, ...args) => log('WARN', tag, ...args),
  error: (tag, ...args) => log('ERROR', tag, ...args),
  getLogFile: () => logFile,
  getLogDir: () => logDir
}

