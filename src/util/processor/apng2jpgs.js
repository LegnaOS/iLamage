import path from 'path'
import Action from './action'
import fs from 'fs-extra'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * APNG 转 JPG 序列帧
 * 输出到文件所在路径，使用文件名作为文件夹名
 *
 * 优化：如果 item.basic.type 是 'PNGs'，直接转换序列帧，跳过 APNG 分解
 */
export default async function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.outputing + ' JPG 序列帧...',
    schedule: 0.8
  })

  // 创建输出文件夹：文件所在路径/文件名_frames_jpg
  const outputDir = path.join(item.basic.outputPath, item.options.outputName + '_frames_jpg')
  fs.ensureDirSync(outputDir)

  const quality = item.options.quality.checked ? item.options.quality.value : 90

  // 优化：如果已经是 PNG 序列，直接转换为 JPG
  if (item.basic.type === 'PNGs' && item.basic.fileList && item.basic.fileList.length > 0) {
    console.log(`[apng2jpgs] Source is already PNG sequence (${item.basic.fileList.length} frames), converting directly...`)
    console.log('[apng2jpgs] First file:', item.basic.fileList[0])

    try {

      // 获取 FFmpeg 路径
      const ffmpegPath = await detectFFmpeg()
      if (!ffmpegPath) {
        throw new Error('FFmpeg is required for JPG conversion but not found')
      }

      console.log('[apng2jpgs] FFmpeg path:', ffmpegPath)

      // 逐帧转换函数（降级方案）
      const convertIndividually = async () => {
        const concurrency = 5
        for (let i = 0; i < item.basic.fileList.length; i += concurrency) {
          const batch = item.basic.fileList.slice(i, i + concurrency)
          await Promise.all(batch.map(async (file, batchIndex) => {
            const index = i + batchIndex
            // 使用固定 6 位数字（支持最多 999,999 帧）
            const frameNum = String(index + 1).padStart(6, '0')
            const newName = `${item.options.outputName}_${frameNum}.jpg`
            const outputPath = path.join(outputDir, newName)

            // 检查源文件是否存在
            const fileExists = await fs.pathExists(file)
            if (!fileExists) {
              console.error(`[apng2jpgs] Source file does not exist: ${file}`)
              throw new Error(`Source file does not exist: ${file}`)
            }

            // 使用 FFmpeg 转换 PNG → JPG
            const command = `"${ffmpegPath}" -i "${file}" -q:v ${Math.round((100 - quality) / 10)} "${outputPath}"`

            try {
              await execAsync(command)
            } catch (err) {
              console.error(`[apng2jpgs] Failed to convert frame ${index + 1}:`, err)
              throw err
            }
          }))

          // 更新进度
          store.dispatch('editProcess', {
            index: item.index,
            text: `转换中... (${Math.min(i + concurrency, item.basic.fileList.length)}/${item.basic.fileList.length})`,
            schedule: 0.8 + (Math.min(i + concurrency, item.basic.fileList.length) / item.basic.fileList.length) * 0.2
          })
        }
      }

      // 优化：检查文件是否在同一目录且命名规则一致
      // 如果是，使用 FFmpeg 批量转换（一次调用）
      const firstFile = item.basic.fileList[0]
      const fileDir = path.dirname(firstFile)
      const allInSameDir = item.basic.fileList.every(f => path.dirname(f) === fileDir)

      // 检查文件名是否符合 apng%02d.png 或类似的模式
      const filePattern = /^(.+?)(\d+)\.png$/
      const firstMatch = path.basename(firstFile).match(filePattern)

      if (allInSameDir && firstMatch) {
        // 尝试使用批量转换
        const prefix = firstMatch[1]
        const firstNum = parseInt(firstMatch[2])
        const numDigits = firstMatch[2].length

        // 验证所有文件是否符合连续编号模式
        const isSequential = item.basic.fileList.every((file, index) => {
          const expectedNum = (firstNum + index).toString().padStart(numDigits, '0')
          const expectedName = `${prefix}${expectedNum}.png`
          return path.basename(file) === expectedName
        })

        if (isSequential) {
          console.log(`[apng2jpgs] Files are sequential (${prefix}%0${numDigits}d.png), using batch conversion`)

          // 使用 FFmpeg 批量转换
          const inputPattern = path.join(fileDir, `${prefix}%0${numDigits}d.png`)
          // 使用固定 6 位数字（支持最多 999,999 帧）
          const outputPattern = path.join(outputDir, `${item.options.outputName}_%06d.jpg`)

          const command = `"${ffmpegPath}" -start_number ${firstNum} -i "${inputPattern}" -q:v ${Math.round((100 - quality) / 10)} "${outputPattern}"`
          console.log(`[apng2jpgs] Batch conversion command: ${command}`)

          try {
            await execAsync(command)
            console.log(`[apng2jpgs] Batch conversion complete`)
          } catch (err) {
            console.error(`[apng2jpgs] Batch conversion failed, falling back to individual conversion:`, err)
            // 降级到逐帧转换
            await convertIndividually()
          }
        } else {
          console.log('[apng2jpgs] Files are not sequential, using individual conversion')
          await convertIndividually()
        }
      } else {
        console.log('[apng2jpgs] Files are not in same directory or do not match pattern, using individual conversion')
        await convertIndividually()
      }

      console.log(`[apng2jpgs] Converted ${item.basic.fileList.length} PNG frames to JPG in ${outputDir}`)

      store.dispatch('editProcess', {
        index: item.index,
        text: `已输出 ${item.basic.fileList.length} 帧 JPG`,
        schedule: 1
      })

      return
    } catch (error) {
      console.error('[apng2jpgs] Error during conversion:', error)
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
    // 第一步：apngdis 分解为 PNG 帧
    await Action.exec(cdCommand + ' && ' + Action.bin('apngdis'), [
      fileName
    ], item, store, locale)

    // 查找生成的帧文件
    const files = fs.readdirSync(fileDir)
    const frameFiles = files.filter(f => f.startsWith('apngframe') && f.endsWith('.png'))

    if (frameFiles.length === 0) {
      throw new Error('No frames extracted from APNG')
    }

    // 排序帧文件
    frameFiles.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0])
      const numB = parseInt(b.match(/\d+/)[0])
      return numA - numB
    })

    // 第二步：使用 FFmpeg 转换为 JPG
    for (let i = 0; i < frameFiles.length; i++) {
      const file = frameFiles[i]
      // 使用固定 6 位数字（支持最多 999,999 帧）
      const frameNum = String(i + 1).padStart(6, '0')
      const pngPath = path.join(fileDir, file)
      const jpgName = `${item.options.outputName}_${frameNum}.jpg`
      const jpgPath = path.join(outputDir, jpgName)

      // 使用 Node.js canvas 或 sharp 转换（这里用简单的方法：复制 PNG 然后用工具转）
      // 由于没有现成的 JPG 转换工具，我们使用 FFmpeg
      const ffmpegPath = await detectFFmpeg()
      if (ffmpegPath) {
        // 使用 FFmpeg 转换 PNG -> JPG
        await execAsync(`"${ffmpegPath}" -i "${pngPath}" -q:v ${Math.round((100 - quality) / 10)} "${jpgPath}"`)
      } else {
        // 降级：直接复制 PNG（不推荐，但保证功能可用）
        console.warn('[apng2jpgs] FFmpeg not found, copying PNG instead of converting to JPG')
        fs.copySync(pngPath, jpgPath.replace('.jpg', '.png'))
      }

      // 删除临时 PNG
      fs.removeSync(pngPath)

      // 更新进度
      store.dispatch('editProcess', {
        index: item.index,
        text: `转换 JPG ${i + 1}/${frameFiles.length}...`,
        schedule: 0.8 + (0.2 * (i + 1) / frameFiles.length)
      })
    }

    console.log(`[apng2jpgs] Exported ${frameFiles.length} JPG frames to ${outputDir}`)

    store.dispatch('editProcess', {
      index: item.index,
      text: `已输出 ${frameFiles.length} 帧 JPG`,
      schedule: 1
    })

  } catch (error) {
    console.error('[apng2jpgs] Error:', error)
    throw error
  }
}

/**
 * 检测 FFmpeg 是否可用
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

