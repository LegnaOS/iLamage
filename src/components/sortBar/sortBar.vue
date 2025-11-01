<template>
  <section class="mod-bar">
    <el-tag
      v-for="tag in visibleTags"
      size="small"
      :type="tag.type"
      @click.native="handleSort(tag)"
      :key="tag.name"
    >
      {{ tag.name }}
      <span v-if="tag.count > 0" class="tag-count">({{ tag.count }})</span>
    </el-tag>
  </section>
</template>

<script>
  export default {
    data () {
      return {
        allTags: [
          {name: 'ALL', type: '', pre: '', alwaysShow: true},
          {name: 'PNGs', type: 'gray', pre: 'primary'},
          {name: 'APNG', type: 'gray', pre: 'success'},
          {name: 'GIF', type: 'gray', pre: 'warning'},
          {name: 'WEBP', type: 'gray', pre: 'danger'},
          {name: 'MP4', type: 'gray', pre: 'info'},
          {name: 'AVIF', type: 'gray', pre: 'success'},
          {name: 'MOV', type: 'gray', pre: 'info'},
          {name: 'MPEG', type: 'gray', pre: 'warning'},
          {name: 'FLV', type: 'gray', pre: 'danger'},
          {name: 'LOTTIE', type: 'gray', pre: 'info'},
          {name: 'SVGA', type: 'gray', pre: 'success'},
          {name: 'WEBM', type: 'gray', pre: 'warning'},
          {name: 'VAP', type: 'gray', pre: 'danger'},
          {name: 'PAG', type: 'gray', pre: 'primary'}
        ]
      }
    },
    computed: {
      projectList () {
        return this.$store.getters.getterItems
      },
      visibleTags () {
        // 统计每种类型的文件数量
        const typeCounts = {}
        this.projectList.forEach(item => {
          const type = item.basic.type
          typeCounts[type] = (typeCounts[type] || 0) + 1
        })

        // 过滤并添加计数
        return this.allTags
          .filter(tag => {
            // ALL 标签始终显示
            if (tag.alwaysShow) return true
            // 只显示列表中存在的类型
            return typeCounts[tag.name] > 0
          })
          .map(tag => {
            return {
              ...tag,
              count: typeCounts[tag.name] || 0
            }
          })
      }
    },
    methods: {
      handleSort (tag) {
        // 重置所有标签状态
        this.allTags.forEach(function (ele) {
          ele.type = 'gray'
        })
        // 激活当前标签
        tag.type = tag.pre
        this.$root.eventBus.$emit('sortList', tag.name)
      }
    }
  }
</script>

<style lang="scss">
.mod-bar{
  position:fixed;
  left:0;
  bottom:0;
  width:100%;
  min-height:40px;
  max-height:120px; // 最多显示 3 行
  overflow-y:auto;
  border:1px solid #E4E4E4;
  background:#F2F2F2;
  padding:5px 10px;
  display: flex;
  flex-wrap: wrap; // 自动换行
  align-items: center;
  align-content: flex-start;
  gap: 5px; // 标签间距

  .el-tag{
    margin:0;
    cursor:pointer;
    flex-shrink: 0; // 防止标签被压缩

    .tag-count {
      margin-left: 4px;
      font-size: 11px;
      opacity: 0.7;
    }
  }
  .el-tag--gray{
    background:transparent;
    border-color:transparent;
    &:hover{
      border-color: rgba(71,86,105,.2);
    }
  }
}
</style>
