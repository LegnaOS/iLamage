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

  logger.info('apng2gif', 'Executing apng2gif binary...')
  logger.info('apng2gif', 'Working dir:', fileDir)
  logger.info('apng2gif', 'Input:', fileName)
  logger.info('apng2gif', 'Output:', item.options.outputName + '.gif')

  return action.exec(cdCommand + ' && ' + action.bin('apng2gif'), [
    fileName,
    item.options.outputName + '.gif'
  ], item, store, locale).then(() => {
    logger.info('apng2gif', 'apng2gif binary completed successfully')

    const outputFile = path.join(item.basic.tmpOutputDir, item.options.outputName + '.gif')
    const fileExists = fs.existsSync(outputFile)
    logger.info('apng2gif', 'Output file exists:', fileExists)

    if (fileExists) {
      const fileSize = fs.statSync(outputFile).size
      logger.info('apng2gif', 'Output file size:', fileSize, 'bytes')
    }

    logger.info('apng2gif', '=== APNG to GIF Complete ===')
  }).catch(err => {
    logger.error('apng2gif', 'apng2gif binary failed')
    logger.error('apng2gif', 'Error object:', JSON.stringify(err, null, 2))

    if (err.command) {
      logger.error('apng2gif', 'Command:', err.command)
    }
    if (err.err) {
      logger.error('apng2gif', 'Error details:', err.err)
    }

    throw err
  })
}
