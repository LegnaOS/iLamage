import path from 'path'
import action from './action'
import fs from 'fs-extra'
import logger from '../logger'

export default function (item, store, locale) {
  logger.info('apng2gif', '=== APNG to GIF Start ===')
  logger.info('apng2gif', 'Input file:', item.basic.fileList[0])

  store.dispatch('editProcess', {
    index: item.index,
    text: locale.outputing+' GIF...',
    schedule: 0.8
  })

  var tmpDir = item.basic.tmpDir
  var tmpFile = path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')

  fs.ensureDirSync(tmpDir)
  if (tmpFile != item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile

  var fileName = path.basename(item.basic.fileList[0])

  // Windows 使用 /d 参数支持跨盘符 cd
  const isWindows = process.platform === 'win32'
  const fileDir = path.dirname(item.basic.fileList[0])
  const cdCommand = isWindows ? `cd /d "${fileDir}"` : `cd "${fileDir}"`

  return action.exec(cdCommand + ' && ' + action.bin('apng2gif'), [
    fileName,
    item.options.outputName + '.gif'
  ], item, store, locale)
}
