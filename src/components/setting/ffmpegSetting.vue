<template>
  <div class="ffmpeg-setting">
    <div class="ui-border-b">
      <p class="section-title">
        <i class="el-icon-video-camera"></i>
        {{ $t('decoderConfig') }}
        <el-tag size="mini" :type="decoderStatus.type" style="margin-left: 10px">
          {{ decoderStatus.text }}
        </el-tag>
      </p>

      <div class="decoder-info">
        <p class="info-text">
          {{ $t('decoderInfo') }}
        </p>
      </div>

      <!-- WebAV 优先选项 -->
      <div class="webav-section">
        <el-form label-width="120px" size="small">
          <el-form-item :label="$t('decoderPriority')">
            <el-switch
              v-model="preferWebAV"
              :active-text="$t('preferWebAV')"
              :inactive-text="$t('preferFFmpeg')"
              @change="onPreferWebAVChange"
            ></el-switch>
            <div class="help-text">
              <span v-if="preferWebAV">
                <i class="el-icon-success"></i>
                {{ $t('webavModern') }}
              </span>
              <span v-else>
                <i class="el-icon-info"></i>
                {{ $t('ffmpegTraditional') }}
              </span>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div class="ffmpeg-info">
        <p class="info-text">
          {{ $t('ffmpegConfigNote') }}
        </p>
      </div>

      <!-- 状态显示 -->
      <div class="status-section">
        <el-form label-width="120px" size="small">
          <!-- 系统 FFmpeg -->
          <el-form-item :label="$t('systemFFmpeg')">
            <div class="status-row">
              <!-- FFmpeg 状态 -->
              <div class="tool-status">
                <span class="tool-label">ffmpeg:</span>
                <el-tag v-if="systemFFmpeg.found" type="success" size="mini">
                  <i class="el-icon-success"></i> {{ $t("statusFound") }}
                </el-tag>
                <el-tag v-else type="info" size="mini">
                  <i class="el-icon-info"></i> {{ $t("statusNotFound") }}
                </el-tag>
                <span v-if="systemFFmpeg.path" class="path-text">{{ systemFFmpeg.path }}</span>
              </div>

              <!-- ffprobe 状态 -->
              <div class="tool-status">
                <span class="tool-label">ffprobe:</span>
                <el-tag v-if="systemFFprobe.found" type="success" size="mini">
                  <i class="el-icon-success"></i> {{ $t("statusFound") }}
                </el-tag>
                <el-tag v-else type="info" size="mini">
                  <i class="el-icon-info"></i> {{ $t("statusNotFound") }}
                </el-tag>
                <span v-if="systemFFprobe.path" class="path-text">{{ systemFFprobe.path }}</span>
              </div>

              <el-button
                type="text"
                size="mini"
                @click="detectSystemFFmpeg"
                :loading="detecting"
              >
                <i class="el-icon-refresh"></i> {{ $t("redetect") }}
              </el-button>
            </div>
          </el-form-item>

          <!-- 内置 FFmpeg / ffprobe -->
          <el-form-item :label="$t('builtinTools')">
            <div class="status-row">
              <!-- FFmpeg 状态 -->
              <div class="tool-status">
                <span class="tool-label">ffmpeg:</span>
                <el-tag v-if="builtinFFmpeg.found" type="success" size="mini">
                  <i class="el-icon-success"></i> {{ $t("statusInstalled") }}
                </el-tag>
                <el-tag v-else type="warning" size="mini">
                  <i class="el-icon-warning"></i> {{ $t("statusNotInstalled") }}
                </el-tag>
              </div>

              <!-- ffprobe 状态 -->
              <div class="tool-status">
                <span class="tool-label">ffprobe:</span>
                <el-tag v-if="builtinFFprobe.found" type="success" size="mini">
                  <i class="el-icon-success"></i> {{ $t("statusInstalled") }}
                </el-tag>
                <el-tag v-else type="info" size="mini">
                  <i class="el-icon-info"></i> {{ $t("statusNotInstalled") }}
                </el-tag>
              </div>

              <!-- 路径显示 -->
              <span v-if="builtinFFmpeg.path" class="path-text">{{ getFFmpegDir(builtinFFmpeg.path) }}</span>

              <!-- 操作按钮 -->
              <el-button
                v-if="builtinFFmpeg.found"
                type="text"
                size="mini"
                @click="openFFmpegDir"
                icon="el-icon-folder-opened"
              >
                {{ $t('open') }}
              </el-button>
              <el-button
                v-if="!builtinFFmpeg.found"
                type="primary"
                size="mini"
                @click="downloadFFmpeg"
                :loading="downloading"
              >
                <i class="el-icon-download"></i> {{ $t('downloadInstall') }}
              </el-button>
              <el-button
                v-if="builtinFFmpeg.found"
                type="danger"
                size="mini"
                @click="removeBuiltinFFmpeg"
                plain
              >
                <i class="el-icon-delete"></i> {{ $t('deleteBuiltin') }}
              </el-button>
            </div>
          </el-form-item>

          <!-- 自定义路径 -->
          <el-form-item :label="$t('customPath')">
            <div class="custom-path-row">
              <el-input
                v-model="customPath"
                :placeholder="$t('placeholderAutoDetect')"
                size="mini"
                style="flex: 1; max-width: 400px"
              >
                <el-button
                  slot="append"
                  icon="el-icon-folder-opened"
                  @click="browseFFmpeg"
                ></el-button>
              </el-input>
              <el-button
                type="text"
                size="mini"
                @click="saveCustomPath"
                :disabled="!customPath"
              >
                <i class="el-icon-check"></i> {{ $t('save') }}
              </el-button>
              <el-button
                type="text"
                size="mini"
                @click="clearCustomPath"
                :disabled="!customPath"
              >
                <i class="el-icon-close"></i> {{ $t('clear') }}
              </el-button>
            </div>
          </el-form-item>

          <!-- 当前使用 -->
          <el-form-item :label="$t('currentUsing')">
            <div class="current-ffmpeg">
              <el-tag v-if="currentFFmpeg.path" type="success">
                {{ currentFFmpeg.source }}
              </el-tag>
              <span v-if="currentFFmpeg.path" class="path-text">{{ currentFFmpeg.path }}</span>
              <span v-else class="no-ffmpeg">{{ $t("notConfigured") }}</span>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- 下载进度 -->
      <div v-if="downloading" class="download-progress">
        <el-progress
          :percentage="downloadProgress"
          :status="downloadStatus"
        ></el-progress>
        <div class="progress-actions">
          <p class="progress-text">{{ downloadMessage }}</p>
          <el-button
            type="danger"
            size="mini"
            @click="cancelDownload"
            icon="el-icon-close"
          >
            {{ $t('cancelDownload') }}
          </el-button>
        </div>
      </div>

      <!-- 安装指南 -->
      <div class="install-guide">
        <el-collapse>
          <el-collapse-item :title="$t('howToInstallFFmpeg')" name="1">
            <div class="guide-content">
              <h4>{{ $t('installGuideMacOS') }}</h4>
              <p>{{ $t('installStepMacOS1') }}</p>
              <pre>brew install ffmpeg</pre>
              <p>{{ $t('installStepMacOS2') }}</p>
              <pre>https://evermeet.cx/ffmpeg/</pre>

              <h4>{{ $t('installGuideWindows') }}</h4>
              <p>{{ $t('installStepWindows1') }}</p>
              <pre>choco install ffmpeg</pre>
              <p>{{ $t('installStepWindows2') }}</p>
              <pre>https://www.gyan.dev/ffmpeg/builds/</pre>
              <p>{{ $t('installStepWindows3') }}</p>

              <h4>{{ $t('installGuideLinux') }}</h4>
              <p>{{ $t('installStepLinux1') }}</p>
              <pre>sudo apt-get install ffmpeg</pre>
              <p>{{ $t('installStepLinux2') }}</p>
              <pre>sudo yum install ffmpeg</pre>
              <p>{{ $t('installStepLinux3') }}</p>
              <pre>sudo pacman -S ffmpeg</pre>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </div>
</template>

<script>
const { ipcRenderer, shell } = require('electron')
const fs = require('fs-extra')
const path = require('path')
const { exec } = require('child_process')

export default {
  name: 'FFmpegSetting',
  
  data() {
    return {
      preferWebAV: true, // WebAV 优先
      systemFFmpeg: {
        found: false,
        path: ''
      },
      systemFFprobe: {
        found: false,
        path: ''
      },
      builtinFFmpeg: {
        found: false,
        path: ''
      },
      builtinFFprobe: {
        found: false,
        path: ''
      },
      customPath: '',
      currentFFmpeg: {
        source: '',
        path: ''
      },
      detecting: false,
      downloading: false,
      downloadProgress: 0,
      downloadStatus: null, // null, 'success', 'exception', 'warning'
      downloadMessage: ''
    }
  },

  computed: {
    decoderStatus() {
      if (this.preferWebAV) {
        return { type: 'success', text: this.$t('statusWebAVPreferred') }
      } else if (this.currentFFmpeg.path) {
        return { type: 'success', text: this.$t('statusFFmpegConfigured') }
      } else {
        return { type: 'warning', text: this.$t('statusNotConfigured') }
      }
    }
  },
  
  mounted() {
    this.loadSettings()
    this.detectAllFFmpeg()
  },

  watch: {
    // 监听 Vuex 中的解码器配置变化，同步到本地状态
    '$store.state.decoderConfig': {
      handler(newConfig) {
        if (newConfig.ffmpegPath && newConfig.ffmpegPath !== this.currentFFmpeg.path) {
          this.detectAllFFmpeg()
        }
        if (newConfig.preferWebAV !== this.preferWebAV) {
          this.preferWebAV = newConfig.preferWebAV
        }
      },
      deep: true
    },
    // 监听语言变化，更新当前使用的 FFmpeg 标签
    '$i18n.locale'() {
      this.updateCurrentFFmpeg()
    }
  },
  
  methods: {
    // WebAV 优先选项变化
    onPreferWebAVChange(value) {
      this.$store.commit('SET_DECODER_CONFIG', { preferWebAV: value })
      this.$message.success(value ? this.$t('msgSwitchedToWebAV') : this.$t('msgSwitchedToFFmpeg'))
    },

    // 加载设置
    loadSettings() {
      const settings = JSON.parse(window.storage.getItem('ffmpegSettings') || '{}')
      this.customPath = settings.customPath || ''

      // 从 Vuex 加载 preferWebAV
      this.preferWebAV = this.$store.getters.preferWebAV
    },

    // 保存设置
    saveSettings() {
      const settings = {
        customPath: this.customPath
      }
      window.storage.setItem('ffmpegSettings', JSON.stringify(settings))
    },
    
    // 检测所有 FFmpeg
    async detectAllFFmpeg() {
      this.detecting = true
      
      await this.detectSystemFFmpeg()
      await this.detectBuiltinFFmpeg()
      this.updateCurrentFFmpeg()
      
      this.detecting = false
    },
    
    // 检测系统 FFmpeg 和 ffprobe
    async detectSystemFFmpeg() {
      // 检测 ffmpeg
      await new Promise((resolve) => {
        const command = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg'

        exec(command, (err, stdout) => {
          if (err || !stdout.trim()) {
            this.systemFFmpeg.found = false
            this.systemFFmpeg.path = ''
          } else {
            this.systemFFmpeg.found = true
            this.systemFFmpeg.path = stdout.trim().split('\n')[0]
          }
          resolve()
        })
      })

      // 检测 ffprobe
      await new Promise((resolve) => {
        const command = process.platform === 'win32' ? 'where ffprobe' : 'which ffprobe'

        exec(command, (err, stdout) => {
          if (err || !stdout.trim()) {
            this.systemFFprobe.found = false
            this.systemFFprobe.path = ''
          } else {
            this.systemFFprobe.found = true
            this.systemFFprobe.path = stdout.trim().split('\n')[0]
          }
          resolve()
        })
      })
    },
    
    // 检测内置 FFmpeg
    detectBuiltinFFmpeg() {
      return new Promise((resolve) => {
        // 获取平台
        const platform = this.getPlatform()
        const binaryName = platform.startsWith('win') ? 'ffmpeg.exe' : 'ffmpeg'

        // 1. 检查自动下载安装的 FFmpeg（用户数据目录）
        const appDataDir = this.getAppDataDir()
        let installedPath

        if (process.platform === 'darwin') {
          installedPath = path.join(appDataDir, 'ffmpeg', 'ffmpeg')
        } else if (process.platform === 'win32') {
          installedPath = path.join(appDataDir, 'ffmpeg', 'bin', 'ffmpeg.exe')
        }

        if (installedPath && fs.existsSync(installedPath)) {
          console.log('[FFmpeg] Found installed FFmpeg:', installedPath)
          this.builtinFFmpeg.found = true
          this.builtinFFmpeg.path = installedPath

          // 检测 ffprobe
          this.detectBuiltinFFprobe(installedPath)
          return resolve()
        }

        // 2. 检查 public/bin/{platform}/ffmpeg（打包时的内置版本）
        const binPath = path.join(process.cwd(), 'public', 'bin', platform, binaryName)

        if (fs.existsSync(binPath)) {
          console.log('[FFmpeg] Found bundled FFmpeg:', binPath)
          this.builtinFFmpeg.found = true
          this.builtinFFmpeg.path = binPath

          // 检测 ffprobe
          this.detectBuiltinFFprobe(binPath)
        } else {
          console.log('[FFmpeg] No built-in FFmpeg found')
          this.builtinFFmpeg.found = false
          this.builtinFFmpeg.path = ''
          this.builtinFFprobe.found = false
          this.builtinFFprobe.path = ''
        }

        resolve()
      })
    },

    // 检测内置 ffprobe
    detectBuiltinFFprobe(ffmpegPath) {
      // 根据 ffmpeg 路径推断 ffprobe 路径
      let ffprobePath

      if (process.platform === 'darwin') {
        // macOS: ffprobe 与 ffmpeg 在同一目录
        ffprobePath = ffmpegPath.replace(/ffmpeg$/, 'ffprobe')
      } else if (process.platform === 'win32') {
        // Windows: ffprobe.exe 与 ffmpeg.exe 在同一目录
        ffprobePath = ffmpegPath.replace(/ffmpeg\.exe$/, 'ffprobe.exe')
      }

      if (ffprobePath && fs.existsSync(ffprobePath)) {
        console.log('[FFmpeg] Found ffprobe:', ffprobePath)
        this.builtinFFprobe.found = true
        this.builtinFFprobe.path = ffprobePath
      } else {
        console.log('[FFmpeg] ffprobe not found')
        this.builtinFFprobe.found = false
        this.builtinFFprobe.path = ''
      }
    },

    // 获取 FFmpeg 目录（用于显示）
    getFFmpegDir(ffmpegPath) {
      if (!ffmpegPath) return ''
      return path.dirname(ffmpegPath)
    },

    // 获取应用数据目录
    getAppDataDir() {
      try {
        // 优先使用 Electron 的 app.getPath('userData')
        const { app } = require('@electron/remote')
        if (app && app.getPath) {
          return app.getPath('userData')
        }
      } catch (err) {
        console.warn('Failed to get userData path, using fallback:', err.message)
      }

      // 降级方案：使用临时目录
      const os = require('os')
      return path.join(os.tmpdir(), 'iLamage')
    },
    
    // 更新当前使用的 FFmpeg
    updateCurrentFFmpeg() {
      if (this.customPath && fs.existsSync(this.customPath)) {
        this.currentFFmpeg.source = this.$t('sourceCustom')
        this.currentFFmpeg.path = this.customPath
      } else if (this.builtinFFmpeg.found) {
        this.currentFFmpeg.source = this.$t('sourceBuiltin')
        this.currentFFmpeg.path = this.builtinFFmpeg.path
      } else if (this.systemFFmpeg.found) {
        this.currentFFmpeg.source = this.$t('sourceSystem')
        this.currentFFmpeg.path = this.systemFFmpeg.path
      } else {
        this.currentFFmpeg.source = ''
        this.currentFFmpeg.path = ''
      }

      // 通知全局
      this.$store.commit('SET_FFMPEG_PATH', this.currentFFmpeg.path)
    },
    
    // 获取平台
    getPlatform() {
      const platform = process.platform
      if (platform === 'darwin') return 'mac'
      if (platform === 'win32') {
        return process.arch === 'x64' ? 'win64' : 'win32'
      }
      if (platform === 'linux') return 'linux'
      return 'unknown'
    },

    // 打开 FFmpeg 安装目录
    openFFmpegDir() {
      if (!this.builtinFFmpeg.path) {
        this.$message.warning(this.$t('statusNotFound') + ' FFmpeg ' + this.$t('installGuideTitle'))
        return
      }

      const dir = this.getFFmpegDir(this.builtinFFmpeg.path)
      shell.showItemInFolder(this.builtinFFmpeg.path)
      console.log('[FFmpeg] Opening directory:', dir)
    },

    // 取消下载
    cancelDownload() {
      const { cancelDownload: cancelDownloadUtil } = require('@/util/ffmpeg-manager')
      if (cancelDownloadUtil()) {
        this.$message.warning(this.$t('msgDownloadCancelled'))
        this.downloading = false
        this.downloadProgress = 0
        this.downloadMessage = ''
      }
    },

    // 下载 FFmpeg
    async downloadFFmpeg() {
      this.downloading = true
      this.downloadProgress = 0
      this.downloadStatus = null
      this.downloadMessage = this.$t('msgPreparingDownload')

      try {
        // 导入 ffmpeg-manager
        const { downloadFFmpeg: downloadFFmpegUtil, installFFmpeg } = require('@/util/ffmpeg-manager')

        // 下载
        this.downloadMessage = this.$t('msgDownloadingFFmpeg')
        const downloadedPath = await downloadFFmpegUtil((progress) => {
          this.downloadProgress = Math.floor(progress * 100)
          this.downloadMessage = this.$t('msgDownloadingProgress').replace('{progress}', this.downloadProgress)
        })

        this.downloadProgress = 100
        this.downloadMessage = this.$t('msgDownloadComplete')

        // 安装
        const installedPath = await installFFmpeg(downloadedPath)

        this.downloadStatus = 'success'
        this.downloadMessage = this.$t('msgInstallSuccess')

        // {{ $t("redetect") }}
        await this.detectAllFFmpeg()

        this.$message.success(this.$t('msgInstallSuccess'))
      } catch (err) {
        // 检查是否是用户取消
        if (err.message === this.$t('msgDownloadCancelled')) {
          // 用户取消，不显示错误
          console.log('[FFmpeg] Download cancelled by user')
          // 已经在 cancelDownload() 中处理了 UI 重置
          return
        }

        console.error('FFmpeg installation failed:', err)
        this.downloadStatus = 'exception'
        this.downloadMessage = `${this.$t('msgInstallFailed')}: ${err.message}`
        this.$message.error(`${this.$t('msgInstallFailed')}: ${err.message}`)
      } finally {
        setTimeout(() => {
          this.downloading = false
          this.downloadProgress = 0
          this.downloadStatus = null
          this.downloadMessage = ''
        }, 3000)
      }
    },
    
    // 浏览选择 FFmpeg
    browseFFmpeg() {
      const { dialog } = require('@electron/remote')

      dialog.showOpenDialog({
        title: this.$t('titleSelectFFmpeg'),
        properties: ['openFile'],
        filters: [
          { name: 'FFmpeg', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }
        ]
      }).then((result) => {
        if (!result.canceled && result.filePaths.length > 0) {
          this.customPath = result.filePaths[0]
        }
      })
    },
    
    // 保存自定义路径
    saveCustomPath() {
      if (!fs.existsSync(this.customPath)) {
        this.$message.error(this.$t('msgFileNotExist'))
        return
      }

      this.saveSettings()
      this.updateCurrentFFmpeg()
      this.$message.success(this.$t('msgCustomPathSaved'))
    },

    // 清除自定义路径
    clearCustomPath() {
      this.customPath = ''
      this.saveSettings()
      this.updateCurrentFFmpeg()
      this.$message.success(this.$t('msgCustomPathCleared'))
    },

    // 删除内置 FFmpeg
    async removeBuiltinFFmpeg() {
      try {
        // 确认对话框
        await this.$confirm(this.$t('msgConfirmDelete'), this.$t('msgConfirmDeleteTitle'), {
          confirmButtonText: this.$t('msgDelete'),
          cancelButtonText: this.$t('cancel'),
          type: 'warning'
        })

        const appDataDir = this.getAppDataDir()
        const ffmpegDir = path.join(appDataDir, 'ffmpeg')

        // 检查目录是否存在
        if (!fs.existsSync(ffmpegDir)) {
          this.$message.warning(this.$t('msgBuiltinDirNotExist'))
          return
        }

        // 删除目录
        try {
          await fs.remove(ffmpegDir)
          console.log('[FFmpeg] Removed built-in FFmpeg directory:', ffmpegDir)
          this.$message.success(this.$t('msgDeleteSuccess'))
        } catch (err) {
          console.error('[FFmpeg] Failed to remove directory:', err)
          throw new Error(`${this.$t('msgDeleteFailed')}: ${err.message}`)
        }

        // 重新检测
        await this.detectAllFFmpeg()

      } catch (err) {
        // 用户取消
        if (err === 'cancel') {
          return
        }

        console.error('[FFmpeg] Remove failed:', err)
        this.$message.error(err.message || this.$t('msgDeleteFailed'))
      }
    }
  }
}
</script>

<style scoped>
.ffmpeg-setting {
  padding: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 15px;
}

.decoder-info {
  background: #f0f9ff;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.webav-section {
  background: #f0f9ff;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #b3d8ff;
}

.help-text {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: #67c23a;
}

.help-text i {
  margin-right: 4px;
}

.ffmpeg-info {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.info-text {
  margin: 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.status-section {
  margin-bottom: 20px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tool-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-label {
  font-size: 12px;
  color: #606266;
  font-weight: 500;
}

.path-text {
  color: #909399;
  font-size: 12px;
  font-family: monospace;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 150px;
  max-width: 300px;
}

.custom-path-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.current-ffmpeg {
  display: flex;
  align-items: center;
  gap: 10px;
}

.no-ffmpeg {
  color: #909399;
  font-style: italic;
}

.download-progress {
  margin: 20px 0;

  .progress-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
  }

  .progress-text {
    color: #606266;
    font-size: 14px;
    margin: 0;
  }
}

.install-guide {
  margin-top: 20px;
}

.guide-content {
  padding: 10px;
}

.guide-content h4 {
  margin: 15px 0 10px 0;
  color: #303133;
}

.guide-content pre {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: monospace;
  font-size: 13px;
}

.guide-content a {
  color: #409eff;
  text-decoration: none;
}

.guide-content a:hover {
  text-decoration: underline;
}
</style>

