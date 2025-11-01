## iLamage 1.0.0

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/LegnaOS/iLamage)
[![Electron](https://img.shields.io/badge/electron-22.3.27-blue.svg)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/vue-2.7.16-green.svg)](https://vuejs.org/)

> **Language**: English | [简体中文](README.md)

**iLamage** is a powerful animated image and video format conversion tool, developed based on [iSparta](https://github.com/iSparta/iSparta) and part of the **LegnaOS** project.

It supports mutual conversion between various animation formats including APNG, WebP, GIF, Lottie, SVGA, PAG, and adds support for video formats (MP4, MOV, AVI, FLV, etc.).

### 🌟 Differences from iSparta

iLamage has been extensively optimized and enhanced based on iSparta:

- ✅ **Video Format Support**: Convert MP4, MOV, AVI, FLV and other video formats to GIF/APNG/WebP
- ✅ **Animation Format Support**: Import and convert Lottie, SVGA, and PAG formats
- ✅ **Frame Sequence Export**: Export PNG/JPG frame sequences
- ✅ **Built-in FFmpeg Management**: Automatically download and manage FFmpeg without manual installation
- ✅ **WebAV Acceleration**: Accelerate video decoding using WebCodecs API (Chrome 94+)
- ✅ **Performance Optimization**: 3-5x faster Lottie rendering (Canvas renderer)
- ✅ **Extensive Bug Fixes**: Fixed frame loss, background errors, and other issues in GIF/WebP conversion

# 📸 Screenshots

<img src="https://raw.githubusercontent.com/iSparta/iSparta/master/public/screenshot/iSparta3.1.png" alt="screenshot" width="600">

# 📥 Download

iLamage supports macOS, Windows, and Linux systems.

- **GitHub Releases**: [https://github.com/LegnaOS/iLamage/releases](https://github.com/LegnaOS/iLamage/releases)
- **Original iSparta Website**: [http://isparta.github.io/](http://isparta.github.io/)

# 🌍 Languages

iLamage supports the following languages:

- Simplified Chinese (简体中文)
- Traditional Chinese (繁體中文)
- English
- Japanese (日本語)
- Korean (한국어)
- Russian (Русский)
- French (Français)
- German (Deutsch)
- Italian (Italiano)

# ✨ Features

## Core Features (Inherited from iSparta)

- **PNGs → APNG**  
  Merge multiple PNG images into an APNG animation. Configure frame rate, loop count, and other parameters. PNG files must be in the same directory with standardized naming (`apng000001.png`, `apng000002.png`...)

- **Individual Frame Rate Configuration**  
  Set custom frame rates for individual frames to meet specific requirements

- **PNG/GIF → WebP**  
  Convert PNG and GIF to WebP format with configurable lossless compression and quality settings

- **APNG → Animated WebP**  
  Convert APNG animations to Animated WebP with configurable loop count and lossless compression

- **PNG/GIF Lossless Compression**  
  Perform lossless compression on PNG and GIF images to reduce file size

## 🆕 New Features (Exclusive to iLamage)

### 1. Video Format Support

- **Video → GIF/APNG/WebP**  
  Convert common video formats including MP4, MOV, AVI, FLV, MKV to animated images
  
- **WebAV Acceleration**  
  Accelerate video decoding using WebCodecs API (Chrome 94+), achieving 5-10x faster conversion
  
- **FFmpeg Fallback**  
  Automatically fall back to FFmpeg when WebAV decoding fails, ensuring compatibility

### 2. Animation Format Support

- **Lottie → GIF/APNG/WebP**  
  Convert Lottie JSON animations using Canvas renderer (3-5x performance improvement)
  
- **SVGA → GIF/APNG/WebP**  
  Support for SVGA animation format conversion
  
- **PAG → GIF/APNG/WebP**  
  Support for Tencent PAG animation format conversion (requires PAGViewer installation)

### 3. Frame Sequence Export

- **PNG Frame Sequence Export**  
  Export animations as PNG frame sequences (`_frames_png` directory)
  
- **JPG Frame Sequence Export**  
  Export animations as JPG frame sequences (`_frames_jpg` directory) using FFmpeg batch conversion (10x performance optimization)

### 4. Built-in Tool Management

- **Automatic FFmpeg Download**  
  Automatically download and install FFmpeg + ffprobe without manual configuration
  
- **Automatic PAGViewer Download**  
  Automatically download and install PAGViewer, supporting both system and user data directories
  
- **Tool Management Interface**  
  Visual management of built-in tools with support for deletion, re-download, and opening installation directories

### 5. Bug Fixes and Optimizations

- **GIF → APNG Flicker Fix**  
  Fixed flickering issues when converting GIF to APNG due to inconsistent frame sizes
  
- **WebP → GIF Background Loss Fix**  
  Fixed background element disappearance in WebP to GIF conversion (dispose logic optimization)
  
- **WebP → GIF Single Frame Output Fix**  
  Fixed issue where only the first frame was output when converting WebP to GIF
  
- **Frame Numbering Standardization**  
  Unified frame numbering across all formats to 6-digit format (`%06d`)
  
- **Download Management Optimization**  
  Support for canceling/pausing downloads without error messages when user cancels

# 🛠️ Development

iLamage is developed using [Electron](https://www.electronjs.org/) + [Vue.js](https://vuejs.org/) frameworks and requires [Node.js](https://nodejs.org/).

## Requirements

- **Node.js**: >= 14.0.0
- **npm**: >= 6.0.0
- **System**: macOS / Windows / Linux

## Installation

### macOS

```bash
# Install Node.js (using Homebrew)
brew install node

# Clone the repository
git clone https://github.com/LegnaOS/iLamage.git
cd iLamage

# Install dependencies
npm install
```

### Windows

```bash
# Download and install Node.js
# https://nodejs.org/

# Clone the repository
git clone https://github.com/LegnaOS/iLamage.git
cd iLamage

# Install dependencies
npm install
```

### Linux

```bash
# Install Node.js (using package manager)
sudo apt-get install nodejs npm

# Install libpng16 dependency
sudo apt-get install libpng16-dev

# Clone the repository
git clone https://github.com/LegnaOS/iLamage.git
cd iLamage

# Install dependencies
npm install
```

## Run Development Server

```bash
npm run dev
```

The application will start at `http://localhost:8080` and automatically open an Electron window.

# 📦 Building

iLamage supports building for macOS, Windows, and Linux platforms.

## Build Commands

```bash
# Build for all platforms (macOS + Windows + Linux)
npm run build

# Build for macOS only (must run on macOS)
npm run build:mac

# Build for Windows only
npm run build:windows

# Build for Linux only
npm run build:linux
```

## Build Output

After building, files will be in the `dist_electron/` directory:

```
dist_electron/
├── mac/
│   └── iLamage-3.2.1.dmg          # macOS installer
├── iLamage Setup 3.2.1.exe        # Windows installer
├── iLamage-3.2.1.zip              # Windows portable version
└── linux/
    └── iLamage-3.2.1.AppImage     # Linux installer
```

## Accelerate Building (For Users in China)

```bash
# Set Electron mirror
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# Build
npm run build
```

# 🗺️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) 22.3.27
- **Frontend**: [Vue.js](https://vuejs.org/) 2.7.16 + [Element UI](https://element.eleme.io/)
- **Video Processing**: [FFmpeg](https://ffmpeg.org/) + [WebAV](https://github.com/bilibili/WebAV)
- **Animation Rendering**: [Lottie-web](https://github.com/airbnb/lottie-web) + [SVGA Player](https://github.com/svga/SVGAPlayer-Web)
- **Image Processing**: [pngjs](https://github.com/lukeapage/pngjs) + [AdmZip](https://github.com/cthackers/adm-zip)

# 📝 Changelog

## v1.0.0 (2025-01-01)

### New Features
- ✅ Video format support (MP4, MOV, AVI, FLV, etc.)
- ✅ Lottie, SVGA, PAG animation format support
- ✅ PNG/JPG frame sequence export
- ✅ Automatic FFmpeg download and management
- ✅ Automatic PAGViewer download and management
- ✅ WebAV accelerated video decoding

### Performance Improvements
- ⚡ 3-5x faster Lottie rendering (Canvas renderer)
- ⚡ 10x faster JPG frame sequence export (FFmpeg batch conversion)
- ⚡ 5-10x faster WebAV video decoding

### Bug Fixes
- 🐛 Fixed GIF → APNG flickering issue
- 🐛 Fixed WebP → GIF background loss issue
- 🐛 Fixed WebP → GIF single frame output issue
- 🐛 Fixed Lottie → WEBP conversion errors
- 🐛 Fixed frame numbering inconsistencies
- 🐛 Fixed error messages when canceling downloads

# 📋 To-Do List

- [ ] Add hot update support
- [x] ~~Add video to APNG conversion~~ ✅ Completed
- [ ] Add batch conversion support
- [ ] Optimize preview functionality
- [ ] Add support for more video formats

# 👥 Authors

## iLamage Maintainer
- **LegnaOS** - [GitHub](https://github.com/LegnaOS)

## iSparta Original Authors
- [jeakey](https://github.com/jeakey)
- [ccJUN](https://github.com/ccJUN)
- [yikfun](https://github.com/yikfun)

## Contributors
- [DreamPiggy](https://github.com/dreampiggy)

# 🙏 Acknowledgments

## Image Processing Tools
- [apngasm](http://apngasm.sourceforge.net/) - APNG assembly tool
- [apngopt](https://sourceforge.net/projects/apng/files/APNG_Optimizer/) - APNG optimization tool
- [apng2webp](https://github.com/Benny-/apng2webp) - APNG to WebP converter
- [pngout](http://advsys.net/ken/utils.htm) - PNG optimization tool
- [pngquant](https://pngquant.org/) - PNG compression tool
- [webp](https://developers.google.com/speed/webp/) - WebP codec library

## Video and Animation Tools
- [FFmpeg](https://ffmpeg.org/) - Video processing tool
- [WebAV](https://github.com/bilibili/WebAV) - Web video processing library
- [Lottie-web](https://github.com/airbnb/lottie-web) - Lottie animation rendering library
- [SVGA Player](https://github.com/svga/SVGAPlayer-Web) - SVGA animation player
- [PAG](https://pag.io/) - Tencent PAG animation framework

## Open Source Projects
- [iSparta](https://github.com/iSparta/iSparta) - Original project
- [Electron](https://www.electronjs.org/) - Cross-platform desktop application framework
- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework

# 📄 License

MIT License

Copyright (c) 2025 LegnaOS

Developed based on the [iSparta](https://github.com/iSparta/iSparta) project.

---

**⭐ If this project helps you, please give it a Star!**

