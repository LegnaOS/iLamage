module.exports = {
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

        win: {
          target: ['nsis', 'zip'],  // 生成安装程序和压缩包
          icon: './public/icons/icon.ico'
        },

        nsis: {
          oneClick: false,  // 允许用户选择安装路径
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true
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


