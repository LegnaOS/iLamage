import path from 'path'
import Action from './action'
import fs from 'fs-extra'

/**
 * APNG 转 PNG 序列帧
 * 输出到文件所在路径，使用文件名作为文件夹名
 *
 * 优化：如果 item.basic.type 是 'PNGs'，直接复制序列帧，跳过 APNG 分解
 */
export default async function (item, store, locale) {
  console.log('[apng2pngs] Starting PNG sequence export...')
  console.log('[apng2pngs] item.basic.type:', item.basic.type)
  console.log('[apng2pngs] item.basic.fileList length:', item.basic.fileList?.length)
  console.log('[apng2pngs] item.basic.outputPath:', item.basic.outputPath)
  console.log('[apng2pngs] item.options.outputName:', item.options.outputName)

  store.dispatch('editProcess', {
    index: item.index,
    text: locale.outputing + ' PNG 序列帧...',
    schedule: 0.8
  })

  // 创建输出文件夹：文件所在路径/文件名_frames_png
  const outputDir = path.join(item.basic.outputPath, item.options.outputName + '_frames_png')
  console.log('[apng2pngs] Output directory:', outputDir)
  fs.ensureDirSync(outputDir)
  console.log('[apng2pngs] Output directory created')

  // 优化：如果已经是 PNG 序列，直接复制
  if (item.basic.type === 'PNGs' && item.basic.fileList && item.basic.fileList.length > 0) {
    console.log(`[apng2pngs] Source is already PNG sequence (${item.basic.fileList.length} frames), copying directly...`)
    console.log('[apng2pngs] First file:', item.basic.fileList[0])

    try {
      // 并行复制所有帧
      console.log('[apng2pngs] Starting parallel copy...')
      await Promise.all(item.basic.fileList.map(async (file, index) => {
        // 使用固定 6 位数字（支持最多 999,999 帧）
        const frameNum = String(index + 1).padStart(6, '0')
        const newName = `${item.options.outputName}_${frameNum}.png`
        const targetPath = path.join(outputDir, newName)

        // 检查源文件是否存在
        const fileExists = await fs.pathExists(file)
        if (!fileExists) {
          console.error(`[apng2pngs] Source file does not exist: ${file}`)
          throw new Error(`Source file does not exist: ${file}`)
        }

        console.log(`[apng2pngs] Copying frame ${index + 1}: ${file} -> ${targetPath}`)

        try {
          await fs.copy(file, targetPath, { overwrite: true })
        } catch (err) {
          console.error(`[apng2pngs] Failed to copy frame ${index + 1}:`, err)
          throw err
        }
      }))

      console.log(`[apng2pngs] Copied ${item.basic.fileList.length} PNG frames to ${outputDir}`)

      store.dispatch('editProcess', {
        index: item.index,
        text: `已输出 ${item.basic.fileList.length} 帧 PNG`,
        schedule: 1
      })

      return
    } catch (error) {
      console.error('[apng2pngs] Error during copy:', error)
      throw error
    }
  }

  // 原有逻辑：从 APNG 分解
  const tmpFile = path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')

  // 确保临时文件存在
  fs.ensureDirSync(item.basic.tmpOutputDir)
  if (tmpFile !== item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  // 使用 apngdis 分解 APNG
  const fileName = path.basename(tmpFile)
  const fileDir = path.dirname(tmpFile)
  const isWindows = process.platform === 'win32'
  const cdCommand = isWindows ? `cd /d "${fileDir}"` : `cd "${fileDir}"`

  try {
    // apngdis 会生成 apngframe1.png, apngframe2.png, ...
    await Action.exec(cdCommand + ' && ' + Action.bin('apngdis'), [
      fileName
    ], item, store, locale)

    // 查找生成的帧文件
    const files = fs.readdirSync(fileDir)
    const frameFiles = files.filter(f => f.startsWith('apngframe') && f.endsWith('.png'))
    
    if (frameFiles.length === 0) {
      throw new Error('No frames extracted from APNG')
    }

    // 重命名并移动到输出目录
    // 格式：文件名_000001.png, 文件名_000002.png, ...（固定 6 位数字）
    frameFiles.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0])
      const numB = parseInt(b.match(/\d+/)[0])
      return numA - numB
    })

    frameFiles.forEach((file, index) => {
      const frameNum = String(index + 1).padStart(6, '0')
      const newName = `${item.options.outputName}_${frameNum}.png`
      fs.moveSync(
        path.join(fileDir, file),
        path.join(outputDir, newName),
        { overwrite: true }
      )
    })

    console.log(`[apng2pngs] Exported ${frameFiles.length} PNG frames to ${outputDir}`)

    store.dispatch('editProcess', {
      index: item.index,
      text: `已输出 ${frameFiles.length} 帧 PNG`,
      schedule: 1
    })

  } catch (error) {
    console.error('[apng2pngs] Error:', error)
    throw error
  }
}

