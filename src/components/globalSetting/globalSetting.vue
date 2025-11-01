<template>
<section class="globalsetting">
  <!-- Language Switcher -->
  <el-dropdown @command="handleLanguageChange" trigger="click" class="language-switcher">
    <el-button type="text" size="small">
      <i class="el-icon-s-flag"></i>
      <span class="language-label">{{ currentLanguageLabel }}</span>
    </el-button>
    <el-dropdown-menu slot="dropdown">
      <el-dropdown-item command="zh-cn">简体中文</el-dropdown-item>
      <el-dropdown-item command="zh-tw">繁體中文</el-dropdown-item>
      <el-dropdown-item command="en-us">English</el-dropdown-item>
      <el-dropdown-item command="ja-jp">日本語</el-dropdown-item>
      <el-dropdown-item command="ko-kr">한국어</el-dropdown-item>
      <el-dropdown-item command="ru-ru">Русский</el-dropdown-item>
      <el-dropdown-item command="fr-fr">Français</el-dropdown-item>
      <el-dropdown-item command="de-de">Deutsch</el-dropdown-item>
      <el-dropdown-item command="it-it">Italiano</el-dropdown-item>
    </el-dropdown-menu>
  </el-dropdown>
  <!-- Settings Button -->
  <el-button type="text" @click="showDialog" class="settings-button">
    <i class="el-icon-setting"></i>
  </el-button>
  <el-dialog :title="$t('defaultSetting')" :visible.sync="dialogFormVisible" v-on:open="resetVarible" :modal="true" :modal-append-to-body="true" :append-to-body="true" width="900px" :close-on-click-modal="false">
    <el-tabs v-model="activeTab">
      <!-- 基础设置 -->
      <el-tab-pane :label="$t('tabBasicSettings')" name="basic">
    <el-form>
      <el-form-item :label="$t('language')" label-width="formLabelWidth">
        <el-select v-model="setting.language">
          <el-option label="简体中文" value="zh-cn"></el-option>
          <el-option label="繁體中文" value="zh-tw"></el-option>
          <el-option label="English" value="en-us"></el-option>
          <el-option label="日本語" value="ja-jp"></el-option>
          <el-option label="한국어" value="ko-kr"></el-option>
          <el-option label="Русский" value="ru-ru"></el-option>
          <el-option label="Français" value="fr-fr"></el-option>
          <el-option label="Deutsch" value="de-de"></el-option>
          <el-option label="Italiano" value="it-it"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item :label="$t('fps')" label-width="formLabelWidth">
        <el-input type="number" v-model="setting.options.frameRate" max="100" min="0" size="mini" auto-complete="off"></el-input>
      </el-form-item>
      <el-form-item :label="$t('loop')" label-width="formLabelWidth">
        <el-input type="number" v-model="setting.options.loop" size="mini" auto-complete="off"></el-input>{{ $t('times') }}
        <i>({{ $t('loopTips')}})</i>
      </el-form-item>
      <el-form-item :label="$t('filenameSuffix')" class="suffix" label-width="formLabelWidth">
        <el-input size="mini" v-model="setting.options.outputSuffix" :maxlength="10" auto-complete="off"></el-input>
      </el-form-item>
      <el-form-item :label="$t('dithering')">
        <el-input type="number" v-model="setting.options.floyd.value" max="1" min="0" size="mini" @blur="floydBlur"></el-input>
        <i>(0-1, {{ $t('ditheringTips') }})</i>
      </el-form-item>
      <el-form-item :label="$t('quality')">
        <el-input type="number" v-model="setting.options.quality.value" max="100" min="0" size="mini" value="100" @blur="qualityBlur"></el-input>
        <i>(0-100, {{ $t('qualityTips') }})</i>
      </el-form-item>
    </el-form>
      </el-tab-pane>

      <!-- FFmpeg 设置 -->
      <el-tab-pane :label="$t('tabFFmpegConfig')" name="ffmpeg">
        <ffmpeg-setting></ffmpeg-setting>
      </el-tab-pane>

      <!-- PAGViewer 设置 -->
      <el-tab-pane :label="$t('tabPAGParser')" name="pagviewer">
        <pagviewer-setting></pagviewer-setting>
      </el-tab-pane>
    </el-tabs>

    <div slot="footer" class="dialog-footer">
      <el-button @click="dialogFormVisible = false">{{ $t('cancel')}}</el-button>
      <el-button type="primary" @click="changeVarible">{{ $t('confrim')}}</el-button>
    </div>
  </el-dialog>
</section>
</template>

<script>
import FFmpegSetting from '../setting/ffmpegSetting.vue'
import PAGViewerSetting from '../setting/pagviewerSetting.vue'

export default {
  components: {
    'ffmpeg-setting': FFmpegSetting,
    'pagviewer-setting': PAGViewerSetting
  },
  data() {
    return {
      setting: JSON.parse(window.storage.getItem('globalSetting')),
      dialogFormVisible: false,
      formLabelWidth: '120px',
      activeTab: 'basic',
      languageLabels: {
        'zh-cn': '简中',
        'zh-tw': '繁中',
        'en-us': 'EN',
        'ja-jp': '日本語',
        'ko-kr': '한국어',
        'ru-ru': 'RU',
        'fr-fr': 'FR',
        'de-de': 'DE',
        'it-it': 'IT'
      }
    }
  },
  computed: {
    currentLanguageLabel() {
      return this.languageLabels[this.$i18n.locale] || 'EN'
    }
  },
  mounted(){
  },
  methods: {
    handleLanguageChange(lang) {
      // 更新 i18n locale
      this.$i18n.locale = lang
      // 更新设置
      this.setting.language = lang
      // 保存到 localStorage
      window.storage.setItem('globalSetting', JSON.stringify(this.setting))
    },
    floydBlur(){

    },
    qualityBlur(){

    },
    showDialog(){
      let locked = this.$store.getters.getterLocked;
      if(locked){
        return false;
      }
      this.dialogFormVisible = true
    },
    resetVarible(){
      this.setting = JSON.parse(window.storage.getItem('globalSetting'))
    },
    changeVarible() {
      //save to localStorage
      
      window.storage.setItem('globalSetting', JSON.stringify(this.setting))
      this.$data.dialogFormVisible = false
      //change language
      const supportedLanguages = ['zh-cn', 'zh-tw', 'en-us', 'ja-jp', 'ko-kr', 'ru-ru', 'fr-fr', 'de-de', 'it-it']
      if (supportedLanguages.includes(this.setting.language)) {
        this.$i18n.locale = this.setting.language
      }
    }
  }
}
</script>

<style lang="scss">
@import "./globalSetting.scss";
</style>
