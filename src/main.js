import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import 'normalize.css/normalize.css'
import AsyncComputed from 'vue-async-computed'
import VueI18n from 'vue-i18n'
// const storage = require('electron-localstorage');

Vue.config.productionTip = false

// 全局错误处理器：过滤掉 WebAV OPFS 的无害错误
Vue.config.errorHandler = (err, vm, info) => {
  // 过滤 OPFS 缓存错误（不影响功能）
  if (err.message && err.message.includes('state cached in an interface object')) {
    console.warn('[Ignored] OPFS cache error:', err.message)
    return
  }
  // 其他错误正常抛出
  console.error('Vue Error:', err, info)
}

// 全局 Promise rejection 处理器
window.addEventListener('unhandledrejection', (event) => {
  // 过滤 OPFS 缓存错误
  if (event.reason && event.reason.message && event.reason.message.includes('state cached in an interface object')) {
    console.warn('[Ignored] OPFS cache error (Promise):', event.reason.message)
    event.preventDefault() // 阻止错误显示在控制台
    return
  }
})

Vue.use(VueI18n)

/* Initialize the plugin */
Vue.use(AsyncComputed)
Vue.use(ElementUI)

let globalSetting = window.storage.getItem('globalSetting');
let defaultLanguage = 'zh-cn';
if (globalSetting) {
  var setting = JSON.parse(globalSetting);
  defaultLanguage = setting.language;
}
const i18n = new VueI18n({
  locale: defaultLanguage, // set locale
  messages: {
    'zh-cn': require('./locales/zh-cn'),
    'zh-tw': require('./locales/zh-tw'),
    'en-us': require('./locales/en-us'),
    'ja-jp': require('./locales/ja-jp'),
    'ko-kr': require('./locales/ko-kr'),
    'ru-ru': require('./locales/ru-ru'),
    'fr-fr': require('./locales/fr-fr'),
    'de-de': require('./locales/de-de'),
    'it-it': require('./locales/it-it')
  }
})
Vue.filter('basePath', function (value) {
  // console.warn(process.env);
  var basePath = '../' + _.compact(_.takeRight(value.split('/'), 3)).join('/')
  return basePath
})

Vue.filter('fileLink', function (value) {
  // console.log(value)
  // var fileLink = value.split(",")[0];
  return value[0]
})
new Vue({
  router,
  i18n,
  store,
  render: h => h(App),
  data: {
    // 注册一个空的 Vue 实例，作为 ‘中转站’
    eventBus: new Vue()
  }
}).$mount('#app')
