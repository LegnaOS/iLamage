<template>
  <div class="pagviewer-setting">
    <div class="ui-border-b">
      <p class="section-title">
        <i class="el-icon-picture-outline"></i>
        {{ $t('pagParserConfig') }}
        <el-tag size="mini" :type="pagviewerStatus.type" style="margin-left: 10px">
          {{ pagviewerStatus.text }}
        </el-tag>
      </p>

      <div class="pagviewer-info">
        <p class="info-text">
          {{ $t('pagParserInfo') }}
        </p>
      </div>

      <!-- 状态显示 -->
      <div class="status-section">
        <el-form label-width="140px" size="small">
          <!-- 系统 PAGViewer -->
          <el-form-item :label="$t('systemPAGViewer')">
            <div class="status-row">
              <el-tag v-if="systemPAGViewer.found" type="success" size="mini">
                <i class="el-icon-success"></i> {{ $t('statusInstalled') }}
              </el-tag>
              <el-tag v-else type="info" size="mini">
                <i class="el-icon-info"></i> {{ $t('statusNotFound') }}
              </el-tag>
              <span v-if="systemPAGViewer.path" class="path-text">{{ systemPAGViewer.path }}</span>
              <el-button
                type="text"
                size="mini"
                @click="detectSystemPAGViewer"
                :loading="detecting"
              >
                <i class="el-icon-refresh"></i> {{ $t('redetect') }}
              </el-button>
            </div>
          </el-form-item>

          <!-- 自动安装 PAGViewer -->
          <el-form-item :label="$t('autoInstall')">
            <div class="status-row">
              <el-tag v-if="installedPAGViewer.found" type="success" size="mini">
                <i class="el-icon-success"></i> {{ $t('statusInstalled') }}
              </el-tag>
              <el-tag v-else type="warning" size="mini">
                <i class="el-icon-warning"></i> {{ $t('statusNotInstalled') }}
              </el-tag>
              <span v-if="installedPAGViewer.path" class="path-text">{{ installedPAGViewer.path }}</span>
              <el-button
                v-if="installedPAGViewer.found"
                type="text"
                size="mini"
                @click="openPAGViewerDir"
                icon="el-icon-folder-opened"
              >
                {{ $t('open') }}
              </el-button>
              <el-button
                v-if="!installedPAGViewer.found"
                type="primary"
                size="mini"
                @click="showInstallOptions"
                :loading="downloading"
              >
                <i class="el-icon-download"></i> {{ $t('downloadAndInstall') }}
              </el-button>
              <el-button
                v-if="installedPAGViewer.found"
                type="danger"
                size="mini"
                @click="removeInstalledPAGViewer"
                plain
              >
                <i class="el-icon-delete"></i> {{ $t('deleteBuiltin') }}
              </el-button>
            </div>

            <!-- 安装位置选项 -->
            <div v-if="!installedPAGViewer.found && !downloading" class="install-location-hint">
              <el-radio-group v-model="installToSystem" size="mini">
                <el-radio :label="true">
                  <span v-if="isMac">{{ $t('installToApplications') }}</span>
                  <span v-else>{{ $t('installToProgramFiles') }}</span>
                </el-radio>
                <el-radio :label="false">{{ $t('installToAppData') }}</el-radio>
              </el-radio-group>
            </div>
            <div v-if="downloading" class="download-progress">
              <el-progress
                :percentage="downloadProgress"
                :status="downloadStatus"
              ></el-progress>
              <div class="progress-actions">
                <p class="progress-text">{{ downloadStatusText }}</p>
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
          </el-form-item>

          <!-- 自定义路径 -->
          <el-form-item :label="$t('customPath')">
            <div class="custom-path-row">
              <el-input
                v-model="customPath"
                :placeholder="$t('placeholderPAGViewerPath')"
                size="mini"
                :disabled="downloading"
              >
                <el-button
                  slot="append"
                  @click="selectCustomPath"
                  :disabled="downloading"
                >
                  <i class="el-icon-folder-opened"></i> {{ $t('browse') }}
                </el-button>
              </el-input>
            </div>
          </el-form-item>

          <!-- 当前使用 -->
          <el-form-item :label="$t('currentUsing')">
            <div class="current-path">
              <el-tag v-if="currentPAGViewerPath" type="success">
                {{ currentPAGViewerPath }}
              </el-tag>
              <el-tag v-else type="info">{{ $t('notConfigured') }}</el-tag>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- 帮助信息 -->
      <div class="help-section">
        <el-collapse>
          <el-collapse-item :title="$t('usageGuide')" name="1">
            <div class="help-content">
              <h4>{{ $t('pagviewerPriority') }}</h4>
              <ol>
                <li><strong>{{ $t('customPath') }}</strong>: {{ $t('pagviewerPriorityCustom') }}</li>
                <li><strong>{{ $t('autoInstall') }}</strong>: {{ $t('pagviewerPriorityAuto') }}</li>
                <li><strong>{{ $t('systemPAGViewer') }}</strong>: {{ $t('pagviewerPrioritySystem') }}</li>
              </ol>

              <h4>{{ $t('autoInstallGuide') }}</h4>
              <ul>
                <li><strong>macOS</strong>: {{ $t('autoInstallMacOS') }}</li>
                <li><strong>Windows</strong>: {{ $t('autoInstallWindows') }}</li>
              </ul>

              <h4>{{ $t('manualInstall') }}</h4>
              <p>
                {{ $t('manualInstallHint') }}
                <el-link type="primary" @click="openPAGWebsite">{{ $t('pagWebsite') }}</el-link>
                {{ $t('manualInstallHint2') }}
              </p>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </div>
</template>

<script>
import { detectPAGViewer, downloadPAGViewer, installPAGViewer } from '../../util/pagviewer-manager'

const { dialog, shell } = require('@electron/remote')
const path = require('path')
const fs = require('fs-extra')

export default {
  name: 'PAGViewerSetting',
  data() {
    return {
      systemPAGViewer: {
        found: false,
        path: ''
      },
      installedPAGViewer: {
        found: false,
        path: ''
      },
      customPath: '',
      detecting: false,
      downloading: false,
      downloadProgress: 0,
      downloadStatus: null, // null, 'success', 'exception', 'warning'
      downloadStatusText: '',
      installToSystem: true // 默认安装到系统目录
    }
  },
  computed: {
    isMac() {
      return process.platform === 'darwin'
    },
    pagviewerStatus() {
      if (this.currentPAGViewerPath) {
        return { type: 'success', text: this.$t('configured') }
      }
      return { type: 'warning', text: this.$t('notConfigured') }
    },
    currentPAGViewerPath() {
      // 优先级：自定义 > 自动安装 > 系统
      if (this.customPath && fs.existsSync(this.customPath)) {
        return this.customPath
      }
      if (this.installedPAGViewer.found) {
        return this.installedPAGViewer.path
      }
      if (this.systemPAGViewer.found) {
        return this.systemPAGViewer.path
      }
      return ''
    }
  },
  mounted() {
    this.loadSettings()
    this.detectAllPAGViewers()
  },
  methods: {
    loadSettings() {
      // 从 localStorage 加载自定义路径
      const savedPath = window.storage.getItem('pagviewerPath')
      if (savedPath) {
        this.customPath = savedPath
      }
    },
    saveSettings() {
      // 保存自定义路径到 localStorage
      window.storage.setItem('pagviewerPath', this.customPath || '')

      // 保存当前使用的路径到 Vuex
      this.$store.commit('SET_PAGVIEWER_PATH', this.currentPAGViewerPath)
    },
    async detectAllPAGViewers() {
      this.detecting = true
      try {
        const result = await detectPAGViewer()
        
        this.systemPAGViewer = {
          found: result.system.found,
          path: result.system.path
        }
        
        this.installedPAGViewer = {
          found: result.installed.found,
          path: result.installed.path
        }
        
        this.saveSettings()
      } catch (err) {
        console.error('PAGViewer detection failed:', err)
      } finally {
        this.detecting = false
      }
    },
    async detectSystemPAGViewer() {
      this.detectAllPAGViewers()
    },

    // 取消下载
    cancelDownload() {
      const { cancelDownload: cancelDownloadUtil } = require('@/util/pagviewer-manager')
      if (cancelDownloadUtil()) {
        this.$message.warning(this.$t('msgDownloadCancelled'))
        this.downloading = false
        this.downloadProgress = 0
        this.downloadStatusText = ''
      }
    },

    // 显示安装选项并开始下载
    showInstallOptions() {
      const installLocation = this.installToSystem
        ? (this.isMac ? '/Applications' : 'Program Files')
        : this.$t('installToAppData')

      this.$confirm(`${this.$t('msgConfirmInstallLocation')}: ${installLocation}`, this.$t('msgConfirmInstallLocationTitle'), {
        confirmButtonText: this.$t('msgStartDownload'),
        cancelButtonText: this.$t('cancel'),
        type: 'info'
      }).then(() => {
        this.downloadAndInstallPAGViewer()
      }).catch(() => {
        // 用户取消
      })
    },

    async downloadAndInstallPAGViewer() {
      this.downloading = true
      this.downloadProgress = 0
      this.downloadStatus = null
      this.downloadStatusText = this.$t('msgPAGPreparingDownload')

      try {
        // 下载
        this.downloadStatusText = this.$t('msgPAGDownloading')
        const downloadedPath = await downloadPAGViewer((progress) => {
          this.downloadProgress = Math.floor(progress * 100)
          this.downloadStatusText = this.$t('msgPAGDownloadingProgress').replace('{progress}', this.downloadProgress)
        })

        this.downloadProgress = 100
        this.downloadStatusText = this.$t('msgPAGDownloadComplete')

        // 安装（传递安装位置选项）
        const installedPath = await installPAGViewer(downloadedPath, this.installToSystem)

        this.downloadStatus = 'success'
        this.downloadStatusText = this.$t('msgPAGInstallSuccess')
        
        // 重新检测
        await this.detectAllPAGViewers()

        this.$message.success(this.$t('msgPAGViewerInstallSuccess'))
      } catch (err) {
        // 检查是否是用户取消
        if (err.message === this.$t('msgPAGDownloadCancelled')) {
          // 用户取消，不显示错误
          console.log('[PAGViewer] Download cancelled by user')
          // 已经在 cancelDownload() 中处理了 UI 重置
          return
        }

        console.error('PAGViewer installation failed:', err)
        this.downloadStatus = 'exception'
        this.downloadStatusText = `${this.$t('msgInstallFailed')}: ${err.message}`
        this.$message.error(`${this.$t('msgInstallFailed')}: ${err.message}`)
      } finally {
        setTimeout(() => {
          this.downloading = false
          this.downloadProgress = 0
          this.downloadStatus = null
          this.downloadStatusText = ''
        }, 3000)
      }
    },
    selectCustomPath() {
      const platform = process.platform
      let filters = []
      
      if (platform === 'darwin') {
        filters = [{ name: 'PAGViewer', extensions: ['app'] }]
      } else if (platform === 'win32') {
        filters = [{ name: 'PAGViewer', extensions: ['exe'] }]
      }
      
      dialog.showOpenDialog({
        title: this.$t('titleSelectPAGViewer'),
        filters: filters,
        properties: ['openFile']
      }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
          this.customPath = result.filePaths[0]
          this.saveSettings()
          this.$message.success(this.$t('msgPAGViewerPathSet'))
        }
      })
    },
    openPAGWebsite() {
      shell.openExternal('https://pag.io/docs/pag-download.html')
    },

    // 打开 PAGViewer 安装目录
    openPAGViewerDir() {
      if (!this.installedPAGViewer.path) {
        this.$message.warning(this.$t('msgPAGViewerDirNotExist'))
        return
      }

      shell.showItemInFolder(this.installedPAGViewer.path)
      console.log('[PAGViewer] Opening directory:', this.installedPAGViewer.path)
    },

    // 删除自动安装的 PAGViewer
    async removeInstalledPAGViewer() {
      try {
        // 确认对话框
        await this.$confirm(this.$t('msgConfirmDeletePAGViewer'), this.$t('msgConfirmDeleteTitle'), {
          confirmButtonText: this.$t('msgDelete'),
          cancelButtonText: this.$t('cancel'),
          type: 'warning'
        })

        const platform = process.platform
        let targetPath = this.installedPAGViewer.path

        // 检查路径是否存在
        if (!targetPath || !fs.existsSync(targetPath)) {
          this.$message.warning(this.$t('msgPAGViewerDirNotExist'))
          return
        }

        // macOS: 删除 .app 文件
        if (platform === 'darwin') {
          // 如果路径是 /Applications/PAGViewer.app，需要管理员权限
          if (targetPath.startsWith('/Applications')) {
            try {
              await this.$confirm(this.$t('msgNeedAdminPermission'), this.$t('msgNeedAuthorization'), {
                confirmButtonText: this.$t('msgContinue'),
                cancelButtonText: this.$t('cancel'),
                type: 'info'
              })

              const { exec } = require('child_process')
              const { promisify } = require('util')
              const execAsync = promisify(exec)

              await execAsync(`osascript -e 'do shell script "rm -rf \\"${targetPath}\\"" with administrator privileges'`, { timeout: 60000 })
              console.log('[PAGViewer] Removed from /Applications:', targetPath)
            } catch (err) {
              if (err === 'cancel') {
                return
              }
              throw new Error(`删除失败: ${err.message}`)
            }
          } else {
            // 应用数据目录，不需要管理员权限
            await fs.remove(targetPath)
            console.log('[PAGViewer] Removed from user directory:', targetPath)
          }
        }
        // Windows: 删除安装目录
        else if (platform === 'win32') {
          // Windows 通常安装在 Program Files，需要提示用户手动卸载
          await this.$confirm(
            this.$t('msgUninstallHint'),
            this.$t('msgUninstallHintTitle'),
            {
              confirmButtonText: this.$t('msgTryDelete'),
              cancelButtonText: this.$t('cancel'),
              type: 'warning'
            }
          )

          // 尝试删除目录
          const installDir = path.dirname(targetPath)
          await fs.remove(installDir)
          console.log('[PAGViewer] Removed installation directory:', installDir)
        }

        this.$message.success(this.$t('msgPAGViewerDeleted'))

        // 重新检测
        await this.detectAllPAGViewers()

      } catch (err) {
        // 用户取消
        if (err === 'cancel') {
          return
        }

        console.error('[PAGViewer] Remove failed:', err)
        this.$message.error(err.message || this.$t('msgDeleteFailed'))
      }
    }
  },
  watch: {
    customPath() {
      this.saveSettings()
    }
  }
}
</script>

<style lang="scss" scoped>
.pagviewer-setting {
  padding: 20px;
  
  .section-title {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    
    i {
      margin-right: 8px;
      font-size: 18px;
    }
  }
  
  .pagviewer-info, .ffmpeg-info {
    margin-bottom: 20px;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
    
    .info-text {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: #606266;
    }
  }
  
  .status-section {
    margin-bottom: 20px;
    
    .status-row {
      display: flex;
      align-items: center;
      gap: 10px;
      
      .path-text {
        font-size: 12px;
        color: #909399;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    
    .custom-path-row {
      width: 100%;
    }
    
    .current-path {
      .el-tag {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
  
  .install-location-hint {
    margin-top: 10px;
    padding: 8px 12px;
    background: #f0f9ff;
    border-radius: 4px;
    border-left: 3px solid #409eff;

    .el-radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .el-radio {
      margin-right: 0;
    }
  }

  .download-progress {
    margin-top: 10px;

    .progress-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 5px;
    }

    .progress-text {
      font-size: 12px;
      color: #909399;
      margin: 0;
    }
  }
  
  .help-section {
    margin-top: 20px;
    
    .help-content {
      font-size: 13px;
      line-height: 1.8;
      
      h4 {
        margin: 15px 0 10px 0;
        font-size: 14px;
        color: #303133;
      }
      
      ol, ul {
        margin: 10px 0;
        padding-left: 25px;
        
        li {
          margin: 5px 0;
          color: #606266;
        }
      }
      
      p {
        margin: 10px 0;
        color: #606266;
      }
    }
  }
}
</style>

