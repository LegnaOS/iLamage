// 依赖库
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
// 正则匹配
const reg = {
  'PNGs': /.*\.png$/i,
  'WEBP': /.*\.webp$/i,
  'GIF': /.*\.gif$/i,
  'MP4': /.*\.mp4$/i,
  'LOTTIE': /.*\.(json|lottie)$/i,
  'SVGA': /.*\.svga$/i,
  'WEBM': /.*\.webm$/i,
  'PAG': /.*\.pag$/i,
  'AVIF': /.*\.avif$/i,
  'MOV': /.*\.mov$/i,
  'MPEG': /.*\.(mpeg|mpg)$/i,
  'FLV': /.*\.flv$/i
  // 注意：VAP 不需要正则，因为它是 .mp4 文件，通过检测同名 .json 来识别
}

// 记录每次操作的文件
var recordPng = []

// 文件深度
var maxDeep = 5
var deep

// store
var items = []

// 获取所有的文件夹
class actionFiles {
  getAllFiles (root) {
        // 拉取文件夹
    if (root.split(deep)[1].split('/').length < maxDeep) {
      let stats = fs.lstatSync(root)
      if (stats.isDirectory()) {
        var files = fs.readdirSync(root)
        files.forEach((file) => {
          var res = [],
            pathname = root + '/' + file,
            stat = fs.lstatSync(pathname)
          if (stat.isDirectory()) {
            res = res.concat(this.getAllFiles(pathname))
          }
          if (stat.isFile()) {
            this.getImageFormat(pathname)
          }
        })
      }
            // 拉取图片
      if (stats.isFile()) {
        this.getImageFormat(root)
      }
    } else {
      alert('最深支持5层~')
    }
  }
  getImageFormat (files) {
    console.log('getImageFormat called with:', files)
    var isApng
    let tempPng = []
    let pathname = path.dirname(files)
    let matched = false
    for (var i in reg) {
      console.log(`Testing ${i} regex (${reg[i]}) against ${files}:`, reg[i].test(files))
      if (reg[i].test(files)) {
        matched = true
        console.log(`MATCHED ${i}!`)
        if (i == 'PNGs') {
          var buffer = fs.readFileSync(files)
          var byte = buffer.slice(33, 41).toString('ascii')
          if (byte.match('acTL')) {
            console.log('Detected APNG')
            this.writeBasic('APNG', pathname, [files])
          } else {
            console.log('Detected static PNG, adding to recordPng')
            recordPng.push(files)
          }
        } else if (i == 'LOTTIE') {
          // 验证是否是有效的 Lottie JSON
          try {
            const data = fs.readJSONSync(files)
            // 检查是否包含 Lottie 必需的字段
            if (data.v && data.fr && data.layers) {
              console.log('Detected valid Lottie file')
              this.writeBasic('LOTTIE', pathname, [files])
            } else {
              console.log('JSON file is not a valid Lottie animation')
            }
          } catch (err) {
            console.log('Failed to parse JSON file:', err.message)
          }
        } else if (i == 'SVGA') {
          // SVGA 是二进制格式，直接添加
          console.log('Detected SVGA file')
          this.writeBasic('SVGA', pathname, [files])
        } else if (i == 'WEBM') {
          // WebM 视频格式
          console.log('Detected WebM file')
          this.writeBasic('WEBM', pathname, [files])
        } else if (i == 'MP4') {
          // MP4 文件：需要检测是否为 VAP 格式
          // VAP 格式特征：同目录下存在同名的 .json 文件
          const baseName = path.basename(files, '.mp4')
          const jsonPath = path.join(pathname, baseName + '.json')

          if (fs.existsSync(jsonPath)) {
            console.log('Detected VAP file (mp4 + json):', files, jsonPath)
            this.writeBasic('VAP', pathname, [files, jsonPath])
          } else {
            console.log('Detected MP4 file')
            this.writeBasic('MP4', pathname, [files])
          }
        } else if (i == 'PAG') {
          // PAG 动画格式（腾讯）
          console.log('Detected PAG file')
          this.writeBasic('PAG', pathname, [files])
        } else {
          console.log(`Calling writeBasic with type: ${i}`)
          this.writeBasic(i, pathname, [files])
        }
      }
    }
    if (!matched) {
      console.log('NO REGEX MATCHED for file:', files)
    }
  }

  writeBasic (format, address, fileList) {
    // 检查视频/动图格式是否需要解码器（WebAV 优先，FFmpeg 降级）
    const videoFormats = ['WEBM', 'MP4', 'VAP', 'GIF', 'AVIF', 'MOV', 'MPEG', 'FLV']
    if (videoFormats.includes(format)) {
      const preferWebAV = window.storage.getItem('preferWebAV') !== 'false' // 默认 true
      const ffmpegPath = window.storage.getItem('ffmpegPath')

      // 如果优先使用 WebAV，检查 WebCodecs API 是否可用
      if (preferWebAV && typeof VideoDecoder !== 'undefined') {
        console.log(`${format} will be processed with WebAV (WebCodecs API available)`)
        // WebAV 可用，直接添加到处理队列
      } else if (ffmpegPath && ffmpegPath.trim() !== '') {
        console.log(`${format} will be processed with FFmpeg (fallback)`)
        // FFmpeg 可用，直接添加到处理队列
      } else {
        // 既没有 WebAV 也没有 FFmpeg
        const { dialog } = require('@electron/remote')
        const fileName = path.basename(fileList[0])
        dialog.showMessageBox({
          type: 'warning',
          title: '需要配置解码器',
          message: `处理 ${format} 格式需要视频解码器`,
          detail: `文件：${fileName}\n\n当前浏览器不支持 WebCodecs API，需要配置 FFmpeg 作为降级方案。\n\n请在右侧设置面板中配置 FFmpeg 路径后再试。\n\n您可以：\n1. 安装系统 FFmpeg（推荐）\n2. 下载独立 FFmpeg 并配置路径`,
          buttons: ['知道了']
        })
        console.warn(`${format} format requires decoder, but neither WebAV nor FFmpeg is available`)
        return // 不添加到处理队列
      }
    }

    // 检查 PAG 格式是否需要 PAGViewer
    if (format === 'PAG') {
      // PAG 文件总是需要 PAGViewer 手动导出
      // 但我们仍然添加到队列，在处理时会显示提示对话框
      console.log('PAG file detected, will prompt user to use PAGViewer')
    }

    let temp = {}
    let globalSetting = JSON.parse(window.storage.getItem('globalSetting'))
    temp.basic = {}
    temp.options = globalSetting.options
    //去除文件名空格
    temp.options.outputName = path.basename(fileList[0]).split('.')[0].replace(/[ ]/g,"") + '_'+globalSetting.options.outputSuffix
    temp.basic.type = format
    temp.basic.inputPath = address + '/' + path.basename(fileList[0]).split('.')[0]

    // 对于 PNG 序列帧，输出路径应该是父目录（避免输出到序列帧文件夹内）
    if (format === 'PNGs') {
      temp.basic.outputPath = path.dirname(address)
      console.log(`[writeBasic] PNG sequence detected, output to parent dir: ${temp.basic.outputPath}`)
    } else {
      temp.basic.outputPath = address
    }

    temp.basic.fileList = fileList
    items.push(temp)
  }

  writePngBasic (PNGs) {
    // console.warn(PNGs)
    let tempPrefix = {}
    for (var i = 0; i < PNGs.length; i++) {
      let prefixpath = path.dirname(PNGs[i])
      let prefixname = path.basename(PNGs[i]).replace(/\d+\.png$/i, '')
      let prefix = prefixpath + prefixname
      // console.log(path.basename(PNGs[i]))
      if (!tempPrefix[prefix]) {
        tempPrefix[prefix] = []
        tempPrefix[prefix].push(PNGs[i])
      } else {
        tempPrefix[prefix].push(PNGs[i])
      }
      if (i == PNGs.length - 1) {}
    }

    for (var i in tempPrefix) {
      if (tempPrefix[i].length > 1) {
        // 修复：按文件名中的数字排序
        // 例如：frame1.png, frame2.png, frame10.png, frame20.png
        tempPrefix[i].sort((a, b) => {
          const aMatch = path.basename(a).match(/(\d+)\.png$/i)
          const bMatch = path.basename(b).match(/(\d+)\.png$/i)
          if (aMatch && bMatch) {
            return parseInt(aMatch[1]) - parseInt(bMatch[1])
          }
          // 如果没有数字，按字母顺序排序
          return path.basename(a).localeCompare(path.basename(b))
        })
        console.log(`Sorted ${tempPrefix[i].length} PNG files:`, tempPrefix[i].map(f => path.basename(f)))
        this.writeBasic('PNGs', path.dirname(tempPrefix[i][0]), tempPrefix[i])
      }
    }
  }
}

// 文件处理
export const f = {

  readerFiles (dir) {
    return new Promise(function (resolve, reject) {
            //
      items = [], recordPng = []

      let operateFiles = new actionFiles()

      for (var i = 0; i < dir.length; i++) {
        if (dir[i].path) {
                    // 拖拽文件
          deep = dir[i].path
          operateFiles.getAllFiles(dir[i].path)
        } else {
                    // 选择文件/文件夹（通过 dialog.showOpenDialog）
          let filePath = dir[i]
          // 检查是文件还是文件夹
          let stats = fs.lstatSync(filePath)
          if (stats.isDirectory()) {
            // 文件夹：deep 设置为文件夹本身
            deep = filePath
          } else {
            // 文件：deep 设置为文件的父目录
            deep = path.dirname(filePath)
          }
          operateFiles.getAllFiles(filePath)
        }
      }

      operateFiles.writePngBasic(recordPng)
      resolve(items)
    })
  },
  basicFIle () {

  }

}
