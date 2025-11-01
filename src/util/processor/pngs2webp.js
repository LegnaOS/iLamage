/**
 * PNG 序列 → WEBP 转换器
 *
 * 策略：直接从 PNG 序列生成 WEBP，跳过 APNG 中间格式
 * 这比 PNGs → APNG → apngdis → WEBP 快得多
 */

import fs from 'fs-extra'
import path from 'path'
import action from './action'

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.outputing + ' WEBP...',
    schedule: 0.7
  })

  const tmpDir = item.basic.tmpDir
  const frameFiles = item.basic.fileList
  const delays = item.options.delays || []

  console.log(`[pngs2webp] Converting ${frameFiles.length} PNG frames to WEBP...`)

  // 并行转换所有帧为 WebP
  const promises = frameFiles.map((pngFile, index) => {
    const webpFile = path.join(tmpDir, `webp_frame_${index + 1}.webp`)

    // 质量参数
    const qualityArg = item.options.quality.checked ? '-q ' + item.options.quality.value : '-q 75'

    return action.exec(action.bin('cwebp'), [
      qualityArg,
      '-m 4', // 速度模式：4 是速度和质量的平衡点
      pngFile,
      '-o ' + webpFile
    ], item, store, locale).then(() => {
      // 计算帧延迟（毫秒）
      let delay = 100 // 默认 100ms
      if (delays[index]) {
        delay = Math.round(delays[index] * 1000)
      } else if (item.options.frameRate) {
        delay = Math.round(1000 / item.options.frameRate)
      }

      if (delay === 0) {
        delay = 10 // WebP 规范：0 应该被视为 10ms
      }

      // webpmux 参数：-frame "file" +duration+x+y+dispose+blend
      // 对于简单动画，x=0, y=0, dispose=0, blend=+b
      const webpmuxArg = `-frame "${path.basename(webpFile)}" +${delay}+0+0+0+b`
      return webpmuxArg
    })
  })

  return Promise.all(promises).then((args) => {
    console.log(`[pngs2webp] All ${frameFiles.length} frames converted to WebP, assembling...`)

    store.dispatch('editProcess', {
      index: item.index,
      text: locale.outputing + ' WEBP...',
      schedule: 0.9
    })

    // Windows 使用 /d 参数支持跨盘符 cd
    const isWindows = process.platform === 'win32'
    const cdCommand = isWindows ? `cd /d "${tmpDir}"` : `cd "${tmpDir}"`

    return action.exec(cdCommand + ' && ' + action.bin('webpmux'), [
      args.join(' '),
      '-loop ' + item.options.loop,
      '-o ' + path.join(item.basic.tmpOutputDir, item.options.outputName + '.webp')
    ], item, store, locale)
  }).then(() => {
    console.log(`[pngs2webp] WEBP created successfully`)
  })
}

