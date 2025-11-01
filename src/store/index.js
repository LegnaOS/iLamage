import Vue from 'vue'
import Vuex from 'vuex'

import modules from './modules'

import * as types from './mutation-types'
const fs = require("fs-extra");
const storage = require('electron-localstorage');
const os = require("os");
const path = require("path");
// 【bug fix】修复初次使用时读取缓存错误的问题
let storagePath = "";
if (process.env.NODE_ENV == "development") {

  storagePath = path.join(os.tmpdir(), 'iLamage/localstorage-dev.json');
} else {
  storagePath = path.join(os.tmpdir(), 'iLamage/localstorage.json');
}
if (!fs.existsSync(storagePath)) {
  fs.ensureFileSync(storagePath)

}
if (fs.readFileSync(storagePath)) {
  fs.writeFileSync(storagePath, "{}", "utf-8")
}

storage.setStoragePath(storagePath);
window.storage = storage;
Vue.use(Vuex)
// 原始数据
const defaultState = {
  language: 'zh-cn',
  options: {
    'frameRate': 24,
    'loop': 0,
    'outputSuffix': 'iLam',
    'outputName': '',
    'outputFormat': ['GIF'],
    'floyd': {
      checked: true,
      value: 0.35
    },
    'quality': {
      checked: false,
      value: 70
    }
  },
  basic: {
    fileList: [],
    type: 'APNG',
    thumbPath: '',
    inputPath: '',
    outputPath: ''
  },
  process: {
    text: '',
    schedule: 0
  },
  isSelected: true
}



// state
var state = {
  items: [],
  locked: false,
  cancelled: false, // 全局取消标志
  // 解码器配置
  decoderConfig: {
    preferWebAV: window.storage.getItem('preferWebAV') === 'true', // 优先使用 WebAV（默认 false，因为 FFmpeg 更快）
    ffmpegPath: window.storage.getItem('ffmpegPath') || '' // FFmpeg 路径（优先使用）
  },
  // PAGViewer 路径
  pagviewerPath: window.storage.getItem('pagviewerPath') || ''
}


//init globalSetting
var globalSetting = window.storage.getItem('globalSetting');

if (!globalSetting) {

  let tempSetting = defaultState;
  window.storage.setItem('globalSetting', JSON.stringify(tempSetting))
}
// get localstorage data
var localData = window.storage.getItem('iLamage-item')
if (localData) {
  // 取loaclstorage时重置进度
  var localItems = JSON.parse(localData)
  let items = [];
  _.each(localItems, function (item) {
    let isError = false;
    for (let i = 0; i < item.basic.fileList.length; i++) {

      if (!fs.existsSync(item.basic.fileList[i])) {
        isError = true;
        break;
      }
    }
    if (!isError) {
      item.process.text = ''
      item.process.schedule = 0;
      items.push(item);
    }
  })
  state.items = items
}
// 只有这里才能才state的值
const mutations = {
  [types.ITEMS_ADD](state, data) {
    if (state.locked) {
      return false
    }
    let tempState = JSON.parse(storage.getItem('globalSetting'));
    // console.log(defaultState);
    var itemData = _.cloneDeep(_.extend(tempState, data))
    _.each(state.items, function (item) {
      item.isSelected = false
    })
    state.items.push(itemData)
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.ITEMS_REMOVE](state) {
    if (state.locked) {
      return false
    }
    var remainList = _.remove(state.items, {
      isSelected: false
    })
    state.items = remainList
    if (state.items.length > 1) {
      state.items[0].isSelected = true
    }
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.ALL_REMOVE](state) {
    if (state.locked) {
      return false
    }

    state.items = []
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.ITEMS_EDIT_BASIC](state, keyValue) {
    if (state.locked) {
      return false
    }
    var selectedItem = _.filter(state.items, { isSelected: true })
    var selectedBasic = selectedItem[0].basic
    _.extend(selectedBasic, keyValue)
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.ITEMS_EDIT_OPTIONS](state, keyValue) {
    if (state.locked) {
      return false
    }
    var selectedItem = _.filter(state.items, { isSelected: true })
    var selectedOption = selectedItem[0].options
    _.extend(selectedOption, keyValue)
    storage.setItem('iLamage-item', JSON.stringify(state.items))
    // var new = _.merge(selectedOption,keyValue)
    // console.log(keyValue)
  },
  [types.ITEMS_EDIT_MULTI_OPTIONS](state, keyValue) {
    if (state.locked) {
      return false
    }
    // 只修改选中的项目，而不是所有项目
    _.each(state.items, function (item) {
      if (item.isSelected) {
        _.extend(item.options, keyValue)
      }
    })
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.ITEMS_EDIT_PROCESS](state, keyValue) {
    var selectedItem = _.filter(state.items, { isSelected: true })
    // console.warn(keyValue)
    var selectedProcess = selectedItem[keyValue.index].process
    _.extend(selectedProcess, keyValue)

    // 进度不记录在localstore里
    // storage.setItem("iSparta-item",JSON.stringify(state.items));
  },
  [types.SINGLE_SELECT](state, index) {
    if (state.locked) {
      return false
    }
    _.each(state.items, function (item) {
      item.isSelected = false
    })
    state.items[index].isSelected = true
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.SET_SELECTED](state, index) {
    if (state.locked) {
      return false
    }
    state.items[index].isSelected = true
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.MULTI_SELECT](state, index) {
    if (state.locked) {
      return false
    }
    state.items[index].isSelected = !state.items[index].isSelected
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.ALL_SELECTED](state) {
    if (state.locked) {
      return false
    }
    _.each(state.items, function (item) {
      item.isSelected = true
    })
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.RANGE_SELECT](state, payload) {
    if (state.locked) {
      return false
    }
    const { startIndex, endIndex } = payload
    const minIndex = Math.min(startIndex, endIndex)
    const maxIndex = Math.max(startIndex, endIndex)

    // 清除所有选择
    _.each(state.items, function (item) {
      item.isSelected = false
    })

    // 选择范围内的所有项
    for (let i = minIndex; i <= maxIndex; i++) {
      if (state.items[i]) {
        state.items[i].isSelected = true
      }
    }
    storage.setItem('iLamage-item', JSON.stringify(state.items))
  },
  [types.SET_LOCK](state, boolean) {
    state.locked = boolean
    // 开始新任务时重置取消标志
    if (boolean === true) {
      state.cancelled = false
    }
  },
  [types.SET_CANCELLED](state, boolean) {
    state.cancelled = boolean
  },
  // 设置 FFmpeg 路径（向后兼容）
  SET_FFMPEG_PATH(state, path) {
    state.decoderConfig.ffmpegPath = path
    // 持久化到 localStorage
    if (path) {
      window.storage.setItem('ffmpegPath', path)
    } else {
      window.storage.removeItem('ffmpegPath')
    }
  },
  // 设置解码器配置
  SET_DECODER_CONFIG(state, config) {
    state.decoderConfig = { ...state.decoderConfig, ...config }
    // 持久化 preferWebAV
    if (config.preferWebAV !== undefined) {
      window.storage.setItem('preferWebAV', config.preferWebAV ? 'true' : 'false')
    }
    // 持久化 ffmpegPath
    if (config.ffmpegPath !== undefined) {
      if (config.ffmpegPath) {
        window.storage.setItem('ffmpegPath', config.ffmpegPath)
      } else {
        window.storage.removeItem('ffmpegPath')
      }
    }
  },
  // 设置 PAGViewer 路径
  SET_PAGVIEWER_PATH(state, path) {
    state.pagviewerPath = path
    // 持久化到 localStorage
    if (path) {
      window.storage.setItem('pagviewerPath', path)
    } else {
      window.storage.removeItem('pagviewerPath')
    }
  }

}
// actions are functions that cause side effects and can involve
// asynchronous operations.
// 主要处理异步事件
const actions = {

  //
  add(context, data) {
    context.commit('ITEMS_ADD', data)
  },
  remove(context) {
    context.commit('ITEMS_REMOVE')
  },
  removeAll(context) {
    context.commit('ALL_REMOVE')
  },
  editBasic(context, keyValue) {
    context.commit('ITEMS_EDIT_BASIC', keyValue)
  },
  editOptions(context, keyValue) {
    context.commit('ITEMS_EDIT_OPTIONS', keyValue)
  },
  editMultiOptions(context, keyValue) {
    context.commit('ITEMS_EDIT_MULTI_OPTIONS', keyValue)
  },
  editProcess(context, keyValue) {
    context.commit('ITEMS_EDIT_PROCESS', keyValue)
  },
  setSelected(context, index) {
    context.commit('SET_SELECTED', index)
  },
  singleSelect(context, index) {
    context.commit('SINGLE_SELECT', index)
  },
  multiSelect(context, index) {
    context.commit('MULTI_SELECT', index)
  },
  allSelect(context) {
    context.commit('ALL_SELECTED')
  },
  rangeSelect(context, payload) {
    context.commit('RANGE_SELECT', payload)
  },
  setLock(context, boolean) {
    context.commit('SET_LOCK', boolean)
  },
  // 取消所有正在执行的任务
  cancelAllTasks(context) {
    console.log('[Store] cancelAllTasks action called')
    // 设置取消标志
    context.commit('SET_CANCELLED', true)

    // 立即更新所有选中任务的状态为"已取消"
    const selectedItems = context.getters.getterSelected
    console.log(`[Store] Updating status for ${selectedItems.length} selected items`)
    selectedItems.forEach((item, index) => {
      console.log(`[Store] Setting task ${index} to cancelled`)
      context.dispatch('editProcess', {
        index: index,
        text: '已取消',
        schedule: -1
      })
    })

    // 动态导入 Action 类来调用取消方法
    import('../util/processor/action').then((module) => {
      const count = module.default.cancelAllTasks()
      console.log(`[Store] Cancelled ${count} processes`)
      context.commit('SET_LOCK', false)
    }).catch((err) => {
      console.error('[Store] Failed to cancel tasks:', err)
      context.commit('SET_LOCK', false)
    })
  }
}

// 处理一些分发的事件
const getters = {
  // 获取items
  getterItems() {
    return state.items
  },
  // 获取锁的状态
  getterLocked() {
    return state.locked
  },
  // 获取取消状态
  getterCancelled() {
    return state.cancelled
  },
  // 获取选中的items
  getterSelected() {
    return _.filter(state.items, { isSelected: true })
  },
  // 获取选中items的index
  getterSelectedIndex() {
    return _.findIndex(state.items, { isSelected: true })
  },
  // 获取 FFmpeg 路径（向后兼容）
  getterFFmpegPath() {
    return state.decoderConfig.ffmpegPath
  },
  // 检查是否有 FFmpeg
  hasFFmpeg() {
    return !!state.decoderConfig.ffmpegPath
  },
  // 获取解码器配置
  getterDecoderConfig() {
    return state.decoderConfig
  },
  // 是否优先使用 WebAV
  preferWebAV() {
    return state.decoderConfig.preferWebAV
  },
  // 获取 PAGViewer 路径
  getterPAGViewerPath() {
    return state.pagviewerPath
  },
  // 检查是否有 PAGViewer
  hasPAGViewer() {
    return !!state.pagviewerPath
  }
}

// A Vuex instance is created by combining the state, mutations, actions,
// and getters.
export default new Vuex.Store({
  state,
  getters,
  actions,
  mutations,
  modules
})
