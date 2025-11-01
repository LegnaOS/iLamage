<template>
  <section class="mod-upload" v-if="items.length == 0" >
    <div class="upload-wrap" v-on:click="upFile">
    <el-upload
      class="upload-content"
      drag
      action="javascript:void(0)"
      :before-upload="beforeUpload"
      disabled
      multiple
     >
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">{{ $t("uploadTips") }}</div>
      <div class="el-upload__tip" slot="tip">
        {{ $t("uploadRule") }}
        <br>
        <small style="color: #909399; white-space: pre-line;">{{ $t("uploadRuleTips") }}</small>
      </div>
    </el-upload>
    </div>
  </section>
</template>
<script>

import { f as fsOperate } from '../drag/file.js'
import * as d from '../drag/drag.js'

const {dialog} = require('@electron/remote')

export default {
  data () {
    return {
      imageUrl: '',
      muFileList: []
    }
  },
  computed: {
    items: function () {
      return this.$store.getters.getterItems
    }
  },
  methods: {
    beforeUpload () {
      return false
    },
    handle () {
      return false
    },
    upFile (filsList) {
      dialog.showOpenDialog({
        properties: [ 'openFile', 'openDirectory', 'multiSelections' ],
        filters: [
          { name: 'All Supported Formats', extensions: ['png', 'gif', 'webp', 'avif', 'mp4', 'mov', 'webm', 'mpeg', 'mpg', 'flv', 'json', 'lottie', 'svga', 'pag'] },
          { name: 'Images (PNG, GIF, WEBP, AVIF)', extensions: ['png', 'gif', 'webp', 'avif'] },
          { name: 'Video (MP4, MOV, WebM, MPEG, FLV)', extensions: ['mp4', 'mov', 'webm', 'mpeg', 'mpg', 'flv'] },
          { name: 'Animation (Lottie, SVGA, PAG)', extensions: ['json', 'lottie', 'svga', 'pag'] },
          { name: 'PNG Sequences', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      }).then((result) => {
        if (result.canceled) {
          return false;
        }
        this.muFileList = result.filePaths
        if(!this.muFileList || this.muFileList.length === 0){
          return false;
        }
        fsOperate.readerFiles(this.muFileList).then((ars) => {
          var Obj = {}
          for (var i in ars) {
            Obj.basic = ars[i].basic
            Obj.options = ars[i].options
            this.$store.dispatch('add', Obj)
          }
        })
      })
      return false
    }
  },
  mounted () {
  }
}
</script>

<style lang="scss">
@import "./mainUpload";
</style>
