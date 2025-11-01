## iLamage 1.0.0

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/LegnaOS/iLamage)
[![Electron](https://img.shields.io/badge/electron-22.3.27-blue.svg)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/vue-2.7.16-green.svg)](https://vuejs.org/)

> **Language**: [English](README_EN.md) | 简体中文

**iLamage** 是一款强大的动画图片和视频格式转换工具，基于 [iSparta](https://github.com/iSparta/iSparta) 开发，隶属于 **LegnaOS** 项目。

支持 APNG、WebP、GIF、Lottie、SVGA、PAG 等多种动画格式的相互转换，并新增视频格式支持（MP4、MOV、AVI、FLV 等）。

### 🌟 与 iSparta 的区别

iLamage 在 iSparta 的基础上进行了大量优化和功能扩展：

- ✅ **新增视频格式支持**：支持 MP4、MOV、AVI、FLV 等视频格式转换为 GIF/APNG/WebP
- ✅ **新增动画格式支持**：支持 Lottie、SVGA、PAG 格式的导入和转换
- ✅ **序列帧导出**：支持导出 PNG/JPG 序列帧
- ✅ **内置 FFmpeg 管理**：自动下载和管理 FFmpeg，无需手动安装
- ✅ **WebAV 加速**：使用 WebCodecs API 加速视频解码（Chrome 94+）
- ✅ **性能优化**：Lottie 渲染速度提升 3-5 倍（Canvas 渲染器）
- ✅ **修复大量 Bug**：修复 GIF/WebP 转换中的帧丢失、背景错误等问题

# 📸 截图

<img src="https://raw.githubusercontent.com/iSparta/iSparta/master/public/screenshot/iSparta3.1.png" alt="screenshot" width="600">

# 📥 下载

iLamage 支持 macOS、Windows 和 Linux 系统。

- **GitHub Releases**: [https://github.com/LegnaOS/iLamage/releases](https://github.com/LegnaOS/iLamage/releases)
- **原 iSparta 官网**: [http://isparta.github.io/](http://isparta.github.io/)

# 🌍 语言

iLamage 支持以下语言：

- 简体中文（Simplified Chinese）
- 繁體中文（Traditional Chinese）
- English
- 日本語（Japanese）
- 한국어（Korean）
- Русский（Russian）
- Français（French）
- Deutsch（German）
- Italiano（Italian）

# ✨ 功能特性

## 核心功能（继承自 iSparta）

- **PNGs → APNG**
  将多张 PNG 合并成一个 APNG 动图，可设置帧频率、循环次数等参数。要求 PNG 在同一目录下，并保持文件名标准化（`apng000001.png`, `apng000002.png`...）

- **单独设置帧频**
  可以给每一帧单独设置帧频，满足个性化需求

- **PNG/GIF → WebP**
  将 PNG、GIF 转换为 WebP 格式，可设置无损、压缩比等参数

- **APNG → Animated WebP**
  将 APNG 动图转换为 Animated WebP 动图，可设置循环次数、无损等参数

- **PNG/GIF 无损压缩**
  将 PNG 和 GIF 进行无损压缩，减少图片大小

## 🆕 新增功能（iLamage 独有）

### 1. 视频格式支持

- **视频 → GIF/APNG/WebP**
  支持 MP4、MOV、AVI、FLV、MKV 等常见视频格式转换为动画图片

- **WebAV 加速**
  使用 WebCodecs API 加速视频解码（Chrome 94+），转换速度提升 5-10 倍

- **FFmpeg 回退**
  WebAV 解码失败时自动回退到 FFmpeg，确保兼容性

### 2. 动画格式支持

- **Lottie → GIF/APNG/WebP**
  支持 Lottie JSON 动画转换，使用 Canvas 渲染器（性能提升 3-5 倍）

- **SVGA → GIF/APNG/WebP**
  支持 SVGA 动画格式转换

- **PAG → GIF/APNG/WebP**
  支持腾讯 PAG 动画格式转换（需安装 PAGViewer）

### 3. 序列帧导出

- **PNG 序列帧导出**
  将动画导出为 PNG 序列帧（`_frames_png` 目录）

- **JPG 序列帧导出**
  将动画导出为 JPG 序列帧（`_frames_jpg` 目录），使用 FFmpeg 批量转换（性能优化 10 倍）

### 4. 内置工具管理

- **FFmpeg 自动下载**
  自动下载和安装 FFmpeg + ffprobe，无需手动配置

- **PAGViewer 自动下载**
  自动下载和安装 PAGViewer，支持系统目录和用户数据目录

- **工具管理界面**
  可视化管理内置工具，支持删除、重新下载、打开安装目录

### 5. Bug 修复和优化

- **GIF → APNG 闪烁修复**
  修复 GIF 转 APNG 时因帧尺寸不一致导致的闪烁问题

- **WebP → GIF 背景丢失修复**
  修复 WebP 转 GIF 时背景元素消失的问题（dispose 逻辑优化）

- **WEBP → GIF 只输出 1 帧修复**
  修复 WebP 转 GIF 时只输出第一帧的问题

- **帧编号标准化**
  统一所有格式的帧编号为 6 位数字（`%06d`）

- **下载管理优化**
  支持取消/暂停下载，取消时不显示错误提示


# 🛠️ 开发

iLamage 使用 [Electron](https://www.electronjs.org/) + [Vue.js](https://vuejs.org/) 框架开发，需要安装 [Node.js](https://nodejs.org/)。

## 环境要求

- **Node.js**: >= 14.0.0
- **npm**: >= 6.0.0
- **系统**: macOS / Windows / Linux

## 安装依赖

### macOS

```bash
# 安装 Node.js（使用 Homebrew）
brew install node

# 克隆项目
git clone https://github.com/LegnaOS/iLamage.git
cd iLamage

# 安装依赖
npm install
```

### Windows

```bash
# 下载并安装 Node.js
# https://nodejs.org/

# 克隆项目
git clone https://github.com/LegnaOS/iLamage.git
cd iLamage

# 安装依赖
npm install
```

### Linux

```bash
# 安装 Node.js（使用包管理器）
sudo apt-get install nodejs npm

# 安装 libpng16 依赖
sudo apt-get install libpng16-dev

# 克隆项目
git clone https://github.com/LegnaOS/iLamage.git
cd iLamage

# 安装依赖
npm install
```

## 运行开发服务器

```bash
npm run dev
```

应用会在 `http://localhost:8080` 启动，并自动打开 Electron 窗口。

# 📦 构建打包

iLamage 支持打包为 macOS、Windows 和 Linux 平台的应用。

## 打包命令

```bash
# 打包所有平台（macOS + Windows + Linux）
npm run build

# 只打包 macOS（需要在 macOS 上运行）
npm run build:mac

# 只打包 Windows
npm run build:windows

# 只打包 Linux
npm run build:linux
```

## 打包输出

打包完成后，文件在 `dist_electron/` 目录：

```
dist_electron/
├── mac/
│   └── iLamage-3.2.1.dmg          # macOS 安装包
├── iLamage Setup 3.2.1.exe        # Windows 安装程序
├── iLamage-3.2.1.zip              # Windows 绿色版
└── linux/
    └── iLamage-3.2.1.AppImage     # Linux 安装包
```

## 加速打包（国内用户）

```bash
# 设置 Electron 镜像
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# 执行打包
npm run build
```



# 🗺️ 技术栈

- **框架**: [Electron](https://www.electronjs.org/) 22.3.27
- **前端**: [Vue.js](https://vuejs.org/) 2.7.16 + [Element UI](https://element.eleme.io/)
- **视频处理**: [FFmpeg](https://ffmpeg.org/) + [WebAV](https://github.com/bilibili/WebAV)
- **动画渲染**: [Lottie-web](https://github.com/airbnb/lottie-web) + [SVGA Player](https://github.com/svga/SVGAPlayer-Web)
- **图片处理**: [pngjs](https://github.com/lukeapage/pngjs) + [AdmZip](https://github.com/cthackers/adm-zip)

# 📝 更新日志

## v1.0.0 (2025-01-01)

### 新增功能
- ✅ 视频格式支持（MP4、MOV、AVI、FLV 等）
- ✅ Lottie、SVGA、PAG 动画格式支持
- ✅ PNG/JPG 序列帧导出
- ✅ FFmpeg 自动下载和管理
- ✅ PAGViewer 自动下载和管理
- ✅ WebAV 加速视频解码

### 性能优化
- ⚡ Lottie 渲染速度提升 3-5 倍（Canvas 渲染器）
- ⚡ JPG 序列帧导出速度提升 10 倍（FFmpeg 批量转换）
- ⚡ WebAV 视频解码速度提升 5-10 倍

### Bug 修复
- 🐛 修复 GIF → APNG 闪烁问题
- 🐛 修复 WebP → GIF 背景丢失问题
- 🐛 修复 WebP → GIF 只输出 1 帧问题
- 🐛 修复 Lottie → WEBP 转换错误
- 🐛 修复帧编号不一致问题
- 🐛 修复下载取消时的错误提示

# 📋 To-Do List

- [ ] 增加热更新支持
- [x] ~~增加视频转 APNG~~ ✅ 已完成
- [ ] 增加批量转换支持
- [ ] 增加预览功能优化
- [ ] 增加更多视频格式支持

# 👥 作者

## iLamage 维护者
- **LegnaOS** - [GitHub](https://github.com/LegnaOS)

## iSparta 原作者
- [jeakey](https://github.com/jeakey)
- [ccJUN](https://github.com/ccJUN)
- [yikfun](https://github.com/yikfun)

## 贡献者
- [DreamPiggy](https://github.com/dreampiggy)

# 🙏 致谢

## 图片处理工具
- [apngasm](http://apngasm.sourceforge.net/) - APNG 组装工具
- [apngopt](https://sourceforge.net/projects/apng/files/APNG_Optimizer/) - APNG 优化工具
- [apng2webp](https://github.com/Benny-/apng2webp) - APNG 转 WebP 工具
- [pngout](http://advsys.net/ken/utils.htm) - PNG 优化工具
- [pngquant](https://pngquant.org/) - PNG 压缩工具
- [webp](https://developers.google.com/speed/webp/) - WebP 编解码库

## 视频和动画工具
- [FFmpeg](https://ffmpeg.org/) - 视频处理工具
- [WebAV](https://github.com/bilibili/WebAV) - Web 视频处理库
- [Lottie-web](https://github.com/airbnb/lottie-web) - Lottie 动画渲染库
- [SVGA Player](https://github.com/svga/SVGAPlayer-Web) - SVGA 动画播放器
- [PAG](https://pag.io/) - 腾讯 PAG 动画框架

## 开源项目
- [iSparta](https://github.com/iSparta/iSparta) - 原始项目
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架

# 📄 许可证

MIT License

Copyright (c) 2025 LegnaOS

基于 [iSparta](https://github.com/iSparta/iSparta) 项目开发。

---

**⭐ 如果这个项目对你有帮助，请给个 Star！**
