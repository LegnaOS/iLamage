import path from 'path'
import action from './action'
import fs from 'fs-extra'

export default function (item, isLossless, store, locale) {
  // 检查是否已取消
  if (store.state.cancelled) {
    console.log('[apngCompress] Task cancelled before start')
    return Promise.reject({ cancelled: true })
  }

  store.dispatch('editProcess', {
    index: item.index,
    text: locale.compressing + '...',
    schedule: 0.6
  })

  var tmpDir = item.basic.tmpDir
  var tmpFile = path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')
  fs.ensureDirSync(tmpDir)
  if (tmpFile != item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile

	// apngquant - 只在质量低于 90 时才使用（高质量时跳过，节省时间）
  if (!item.options.quality.checked || item.options.quality.value >= 90) {
    // 高质量或未启用压缩：完全跳过压缩（最快）
    console.log('Skipping compression (quality >= 90 or disabled) for maximum speed')

    // 直接返回，不运行 apngopt
    store.dispatch('editProcess', {
      index: item.index,
      text: locale.compressing + '... (已跳过)',
      schedule: 0.8
    })

    return Promise.resolve()
  } else {
    // 低质量：使用 apngquant + apngopt
    console.log(`Using apngquant with quality ${item.options.quality.value}`)
    const quantOutput = path.join(item.basic.tmpOutputDir, item.options.outputName + '-quant.png')

    return action.exec(action.bin('apngquant'), [
      item.basic.fileList[0],
      '--output ' + quantOutput,
      '--force',
      item.options.floyd.checked ? ('--floyd=' + item.options.floyd.value) : '',
      // 质量范围：min-max
      // min: 最低可接受质量（低于此值不保存）- 设为目标质量的 50%
      // max: 目标质量
      // 例如：质量 70 → --quality=35-70
      item.options.quality.checked ? ('--quality=' + Math.floor(item.options.quality.value * 0.5) + '-' + item.options.quality.value) : ''
    ], item, store, locale).catch((err) => {
      // apngquant 失败（退出码 99 表示质量目标无法达到）
      // 无论如何都继续流程，但标记警告
      const fs = require('fs-extra')
      if (fs.existsSync(quantOutput)) {
        console.log('apngquant reported error but output file exists, continuing...')
        item.qualityWarning = true  // 标记质量警告
        return Promise.resolve()
      } else {
        console.warn('apngquant failed, skipping quantization (quality may not meet target)')
        item.qualityWarning = true  // 标记质量警告
        return Promise.resolve()
      }
    }).then(() => {
      // 检查量化后的文件是否存在
      const fs = require('fs-extra')
      if (fs.existsSync(quantOutput)) {
        item.basic.fileList[0] = quantOutput
        console.log('Using quantized file')
      } else {
        console.log('Using original file (quantization skipped)')
        // 保持原文件不变
      }
      return apngopt(item, store, locale, false) // false = 正常模式
    })
  }
}

function apngopt (item, store, locale, fastMode = false) {
  // fastMode: true = -z0 (快速), false = -z1 (平衡)
  // 不再使用 -z2（太慢）
  const zLevel = fastMode ? '-z0' : '-z1'
  console.log(`Running apngopt with ${zLevel}`)

  return action.exec(action.bin('apngopt'), [
    item.basic.fileList[0],
    path.join(item.basic.tmpOutputDir, item.options.outputName + '.png'),
    zLevel
  ], item, store, locale)
}
