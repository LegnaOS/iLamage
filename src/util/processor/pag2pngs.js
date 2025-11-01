/**
 * PAG → PNG 序列转换器
 *
 * 策略（Linus 式实用主义 - 最终版）：
 * PAG 文件需要使用 PAGViewer 手动导出 PNG 序列
 *
 * 为什么不用 libpag Web SDK：
 * - libpag Web SDK 是为纯浏览器环境设计的
 * - 在 Electron (nodeIntegration: true) 环境中，WebAssembly 类型绑定失败
 * - 错误：Cannot call VectorString.push_back due to unbound types
 * - 官方文档没有提到 Node.js/Electron 支持
 *
 * 最简方案：
 * 1. 提示用户使用 PAGViewer 导出 PNG 序列
 * 2. 提供"打开 PAGViewer"按钮（如果已配置）
 * 3. 用户导出后，重新拖入 PNG 序列继续处理
 *
 * 这是最实用的方案：
 * - 零依赖、零编译、零坑
 * - 利用官方工具，保证兼容性
 * - 用户体验清晰：PAG → PAGViewer → PNG → iSparta
 */

const { shell } = require('@electron/remote')
const { dialog } = require('@electron/remote')
const path = require('path')

/**
 * PAG 文件处理：提示用户使用 PAGViewer
 * @param {Object} item - 任务项
 * @param {Object} store - Vuex store
 * @param {Object} locale - 语言配置
 */
export default async function (item, store, locale) {
  const pagFile = item.basic.fileList[0]
  const pagFileDir = path.dirname(pagFile)

  console.log(`PAG file detected: ${pagFile}`)

  // 显示提示对话框 - 只提供"打开文件位置"选项
  const result = await dialog.showMessageBox({
    type: 'info',
    title: locale.pagNeedManualExport || 'PAG File Detected',
    message: locale.pagNeedManualExportMessage ||
      'PAG files need to be exported to PNG sequence using PAGViewer.\n\n' +
      'Steps:\n' +
      '1. Open the PAG file in PAGViewer\n' +
      '2. Export as PNG sequence (File → Export Image Sequence)\n' +
      '3. Drag the exported PNG files back into iSparta\n\n' +
      'This file will be removed from the queue.',
    buttons: [
      locale.openFileLocation || 'Open File Location',
      locale.ok || 'OK'
    ],
    defaultId: 0,
    cancelId: 1
  })

  if (result.response === 0) {
    // 打开文件所在位置
    shell.showItemInFolder(pagFile)
  }

  // 从队列中移除该任务
  // 由于没有直接移除单个项目的 action，我们需要手动操作
  // 保存当前选中状态
  const currentSelection = store.state.items.map(i => i.isSelected)

  // 只选中当前项目
  store.state.items.forEach((i, idx) => {
    i.isSelected = (idx === item.index)
  })

  // 移除选中的项目
  store.dispatch('remove')

  // 恢复其他项目的选中状态（如果还存在）
  store.state.items.forEach((i, idx) => {
    const originalIdx = idx < item.index ? idx : idx + 1
    if (originalIdx < currentSelection.length && originalIdx !== item.index) {
      i.isSelected = currentSelection[originalIdx]
    }
  })

  console.log('PAG file removed from queue - user needs to manually export using PAGViewer')

  // 返回 rejected Promise，阻止后续处理流程
  // 使用特殊错误标记，让调用方知道这是正常的取消操作
  const error = new Error('PAG_FILE_CANCELLED')
  error.isPAGCancelled = true
  return Promise.reject(error)
}



