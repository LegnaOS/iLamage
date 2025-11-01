module.exports = {
  // 使用相对路径，确保打包后资源能正确加载
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',

  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      externals: ['electron'],
      // Electron Builder 配置
      builderOptions: {
        appId: 'io.github.ilamage',
        productName: 'iLamage',
        asar: false,  // 不使用 asar 打包（方便调试和访问 public/bin 中的 FFmpeg）

        // 文件过滤（减小打包体积）
        files: [
          '**/*',
          '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
          '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
          '!**/node_modules/*.d.ts',
          '!**/node_modules/.bin',
          '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
          '!.editorconfig',
          '!**/._*',
          '!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}',
          '!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}',
          '!**/{appveyor.yml,.travis.yml,circle.yml}',
          '!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}'
        ],

        mac: {
          target: ['dmg'],
          icon: './public/icons/icon.icns',
          category: 'public.app-category.graphics-design'
        },

        // 打包后钩子：恢复二进制文件的执行权限
        afterPack: async (context) => {
          const { execSync } = require('child_process')
          const path = require('path')

          // 获取打包后的 app 路径
          const appPath = context.appOutDir
          const platform = context.electronPlatformName

          console.log('[afterPack] Fixing binary permissions...')
          console.log('[afterPack] App path:', appPath)
          console.log('[afterPack] Platform:', platform)

          if (platform === 'darwin') {
            // macOS
            const binDir = path.join(appPath, 'iLamage.app/Contents/Resources/app/bin/mac')
            console.log('[afterPack] Binary dir:', binDir)

            try {
              execSync(`chmod -R +x "${binDir}"`)
              console.log('[afterPack] ✅ Binary permissions fixed')
            } catch (err) {
              console.error('[afterPack] ❌ Failed to fix permissions:', err.message)
            }
          } else if (platform === 'win32') {
            // Windows 不需要执行权限
            console.log('[afterPack] Windows platform, skipping chmod')
          } else if (platform === 'linux') {
            // Linux
            const binDir = path.join(appPath, 'resources/app/bin/linux')
            console.log('[afterPack] Binary dir:', binDir)

            try {
              execSync(`chmod -R +x "${binDir}"`)
              console.log('[afterPack] ✅ Binary permissions fixed')
            } catch (err) {
              console.error('[afterPack] ❌ Failed to fix permissions:', err.message)
            }
          }
        },

        win: {
          target: [
            {
              target: 'nsis',
              arch: ['x64', 'ia32']  // 同时构建 64位 和 32位
            },
            {
              target: 'zip',
              arch: ['x64', 'ia32']
            }
          ],
          icon: './public/icons/icon.ico',
          // Windows 特定优化
          requestedExecutionLevel: 'asInvoker',  // 不需要管理员权限
          signAndEditExecutable: false  // 跳过签名（加快构建速度）
        },

        nsis: {
          oneClick: false,  // 允许用户选择安装路径
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          perMachine: false,  // 安装到用户目录（不需要管理员权限）
          allowElevation: true,  // 允许用户选择提升权限
          installerIcon: './public/icons/icon.ico',
          uninstallerIcon: './public/icons/icon.ico',
          installerHeaderIcon: './public/icons/icon.ico',
          warningsAsErrors: false  // 警告不作为错误（避免构建失败）
        },

        linux: {
          target: ['AppImage'],
          category: 'Graphics'
        }
      }
    }
  },
  // Webpack 5 配置
  configureWebpack: {
    resolve: {
      fallback: {
        // Electron 环境不需要 polyfill
        fs: false,
        path: false,
        crypto: false
      }
    },
    // 优化配置
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10
          },
          webav: {
            test: /[\\/]node_modules[\\/]@webav[\\/]/,
            name: 'webav',
            priority: 20
          }
        }
      }
    },
    // 字体文件处理：使用相对路径而不是 app:// 协议
    module: {
      rules: [
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name].[contenthash:8][ext]',
            publicPath: '../'  // CSS 在 css/ 目录，字体在 fonts/ 目录，所以用 ../
          }
        }
      ]
    }
  },
  // 转译现代依赖
  transpileDependencies: [
    '@webav/av-cliper'
  ],
  // 开发服务器配置
  devServer: {
    port: 8080,
    client: {
      overlay: {
        errors: (error) => {
          // 过滤 WebAV OPFS 缓存错误（不影响功能）
          const message = error.message || ''
          if (message.includes('state cached in an interface object')) {
            return false // 不显示此错误
          }
          return true // 显示其他错误
        },
        warnings: false
      }
    }
  }
}


