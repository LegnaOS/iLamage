/**
 * WebM → PNG 序列转换器（WebAV 优先版本）
 *
 * 策略：优先使用 WebAV，自动降级到 FFmpeg
 *
 * 注意：这个文件是为了与 processor/index.js 的导入兼容
 *       实际处理逻辑在 video2pngs-webav.js 中
 */

import video2pngsWebAV from './video2pngs-webav'

export default function (item, store, locale) {
  console.log('WebM format: using WebAV (with FFmpeg fallback)')
  return video2pngsWebAV(item, store, locale)
}

