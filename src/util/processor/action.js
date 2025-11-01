import os from 'os'
import path from 'path'
import Process from 'child_process'
import logger from '../logger'

const ipc = require('electron').ipcRenderer

// 延迟初始化 basePath，避免在模块加载时立即调用 remote
let basePath = null

function getBasePath() {
  if (basePath === null) {
    if (process.env.NODE_ENV === 'development') {
      basePath = process.cwd()
      logger.info('action.js', '[getBasePath] Development mode, using cwd:', basePath)
    } else {
      // 打包后使用 @electron/remote
      try {
        const remote = require('@electron/remote')
        basePath = remote.app.getAppPath()
        logger.info('action.js', '[getBasePath] Production mode, got app path:', basePath)
      } catch (err) {
        logger.error('action.js', '[getBasePath] Failed to get app path from @electron/remote:', err.message)

        // 降级：使用 __dirname（打包后指向 app.asar）
        try {
          basePath = path.join(__dirname, '..', '..', '..')
          logger.warn('action.js', '[getBasePath] Using __dirname fallback:', basePath)
        } catch (err2) {
          logger.error('action.js', '[getBasePath] __dirname also failed, using cwd:', err2.message)
          basePath = process.cwd()
        }
      }
    }
    logger.info('action.js', '[getBasePath] Final basePath:', basePath)
  }
  return basePath
}

const tmpDir = path.join(os.tmpdir(), 'iLamage')

// 全局进程管理器 - 使用 Set 存储所有正在运行的进程
const runningProcesses = new Set()

export default class Action {
  constructor(state) {
    
    this.state = state
    this.format(state)
  }
  format(store) {
    // this.items = []

    var selectedItem = _.filter(store.state.items, {
      isSelected: true
    })
    this.items = JSON.parse(JSON.stringify(selectedItem))
    // console.log(this.items)
    for (var i = 0; i < this.items.length; i++) {
      var item = this.items[i]
      item.index = i
      item.basic.tmpDir = path.join(tmpDir, Math.random().toString().replace('0.', ''))
      item.basic.tmpOutputDir = item.basic.tmpDir
    }
  }

  // util

  static bin(exec) {
    logger.info('action.bin', `Looking for binary: ${exec}`)

    var pf = getOsInfo()
    logger.info('action.bin', `Platform: ${pf}`)

    let bin
    if (process.env.NODE_ENV === 'development') {
      // 开发模式：使用 public/bin/
      bin = path.join(process.cwd(), 'public', 'bin', pf, exec)
      logger.info('action.bin', `Development mode, using: ${bin}`)
    } else {
      // 打包后：使用 getBasePath() 延迟获取路径
      const appPath = getBasePath()
      logger.info('action.bin', `App path: ${appPath}`)

      // 尝试多个可能的路径
      const possiblePaths = [
        path.join(appPath, 'bin', pf, exec),  // app/bin/
        path.join(appPath, '..', 'bin', pf, exec),  // Resources/bin/
        path.join(path.dirname(appPath), 'bin', pf, exec)  // 与 app 同级的 bin/
      ]

      logger.info('action.bin', `Trying paths:`, possiblePaths)

      const fs = require('fs-extra')
      for (const testPath of possiblePaths) {
        const testExec = pf === 'win32' || pf === 'win64' ? testPath + '.exe' : testPath
        logger.info('action.bin', `Checking: ${testExec}`)

        if (fs.existsSync(testExec)) {
          bin = testPath
          logger.info('action.bin', `Found binary at: ${testExec}`)
          break
        } else {
          logger.warn('action.bin', `Not found: ${testExec}`)
        }
      }

      if (!bin) {
        logger.error('action.bin', `Binary not found: ${exec}`)
        logger.error('action.bin', `Tried paths:`, possiblePaths)
        bin = path.join(appPath, 'bin', pf, exec)  // 降级到默认路径
        logger.warn('action.bin', `Using fallback path: ${bin}`)
      }
    }

    // chmod 只在 Unix 系统上执行（macOS/Linux）
    if (pf !== 'win32' && pf !== 'win64') {
      try {
        Process.exec("chmod -R +x " + bin)
      } catch (err) {
        console.warn('[action.bin] chmod failed:', err.message)
      }
    }

    if (pf === 'win32' || pf === 'win64') {
      bin = bin + '.exe'
    }

    bin = "\"" + bin + "\""
    console.log('[action.bin] Final path:', bin)

    return bin
  }
  // add 0 to num
  static pad(num, n) {
    var len = num.toString().length
    while (len < n) {
      num = '0' + num
      len++
    }
    return num
  }
  static exec(command, args, item, store, locale, callback) {
    return new Promise(function(resolve, reject) {
      var execCommand = args
      execCommand.unshift(command)
      execCommand = execCommand.join(' ')

      if (callback) {
        const childProcess = Process.exec(execCommand, callback)
        runningProcesses.add(childProcess)
        console.log(`[Process Manager] Started process (total: ${runningProcesses.size}):`, execCommand.substring(0, 100))
      } else {
        const childProcess = Process.exec(execCommand, function(err, stdout, stderr) {
          // 清理进程记录
          runningProcesses.delete(childProcess)
          console.log(`[Process Manager] Process finished (remaining: ${runningProcesses.size})`)

          if (err) {
            // 检查是否是用户取消
            if (err.killed || err.signal === 'SIGTERM' || err.signal === 'SIGKILL') {
              console.log('[Process Manager] Process cancelled by user:', execCommand.substring(0, 100))
              // 不更新状态，因为 cancelAllTasks 已经更新了
              reject({
                command: execCommand,
                err: err,
                cancelled: true
              })
              return
            }

            console.log('this command error:' + execCommand);
            console.log('stdout: ' + stdout)
            console.log('stderr: ' + stderr)
            console.warn(err)
            store.dispatch('editProcess', {
              index: item.index,
              text: locale.convertFail,
              schedule: -1
            })
            reject({
              command: execCommand,
              err: err
            })
          } else {
            resolve({
              command: execCommand
            })
          }
        })

        // 保存进程引用
        runningProcesses.add(childProcess)
        console.log(`[Process Manager] Started process (total: ${runningProcesses.size}):`, execCommand.substring(0, 100))
      }
    })
  }

  // 取消所有正在运行的进程
  static cancelAllTasks() {
    const count = runningProcesses.size
    console.log(`[Process Manager] Killing ${count} running processes`)

    runningProcesses.forEach((childProcess) => {
      try {
        childProcess.kill('SIGTERM')
        console.log(`[Process Manager] Sent SIGTERM to process ${childProcess.pid}`)
      } catch (err) {
        console.warn(`[Process Manager] Failed to kill process:`, err)
      }
    })

    runningProcesses.clear()
    return count
  }
}

function getOsInfo() {
  var _pf = navigator.platform
  var appVer = navigator.userAgent
  var _bit = ''
  if (_pf == 'Win32' || _pf == 'Windows') {
    if (appVer.indexOf('WOW64') > -1 || appVer.indexOf('Win64') > -1) {
      _bit = 'win64'
    } else {
      _bit = 'win32'
    }
    return _bit
  }
  if (_pf.indexOf('Mac') != -1) {
    return 'mac'
  } else if (_pf == 'X11') {
    return 'unix'
  } else if (String(_pf).indexOf('Linux') > -1) {
    return 'linux'
  } else {
    return 'unknown'
  }
}
