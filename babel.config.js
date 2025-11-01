module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        // 目标环境：Electron 11+
        targets: {
          electron: '11.0'
        },
        // 使用 core-js@3
        useBuiltIns: 'usage',
        corejs: 3,
        // 支持现代语法
        modules: false
      }
    ]
  ],
  // 支持动态导入
  plugins: [
    '@babel/plugin-syntax-dynamic-import'
  ],
  // 环境特定配置
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: { node: 'current' }
          }
        ]
      ]
    }
  }
}

