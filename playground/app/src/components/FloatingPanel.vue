<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDraggable } from '../composables/useDraggable'

const props = defineProps<{
  panels: string[]
  extraPanels?: { id: string; label: string }[]
}>()

// 面板标签映射
const panelLabels: Record<string, string> = {
  style: '样式',
  brush: '笔刷参数',
  zoom: '缩放与视口',
  playback: '回放',
  recognition: '识别参数'
}

// 所有可见面板列表
const allPanels = computed(() => {
  const base = props.panels.map(id => ({ id, label: panelLabels[id] || id }))
  if (props.extraPanels) {
    base.push(...props.extraPanels)
  }
  return base
})

// 展开状态
const expandedPanels = ref<Set<string>>(new Set(['style']))

function togglePanel(id: string) {
  if (expandedPanels.value.has(id)) {
    expandedPanels.value.delete(id)
  } else {
    expandedPanels.value.add(id)
  }
}

// 折叠/展开整个面板
const isCollapsed = ref(false)

// 拖拽
const { x, y, onPointerDown } = useDraggable(
  window.innerWidth - 290,
  60
)
</script>

<template>
  <!-- 折叠态：入口按钮 -->
  <div
    v-if="isCollapsed"
    class="panel-toggle"
    :style="{ right: '12px', top: '60px', position: 'absolute' }"
    @click="isCollapsed = false"
  >
    ☰ 参数面板
  </div>

  <!-- 展开态：浮动面板 -->
  <div
    v-else
    class="floating-panel"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <!-- 头部：可拖拽 -->
    <div class="panel-header" @pointerdown="onPointerDown">
      <span class="panel-title">参数面板</span>
      <div class="panel-actions">
        <button class="panel-action" @click.stop="isCollapsed = true" title="折叠">−</button>
      </div>
    </div>

    <!-- 手风琴内容 -->
    <div class="panel-body">
      <div
        v-for="panel in allPanels"
        :key="panel.id"
        class="accordion-item"
      >
        <div
          class="accordion-header"
          @click="togglePanel(panel.id)"
        >
          <span>{{ expandedPanels.has(panel.id) ? '▾' : '▸' }} {{ panel.label }}</span>
        </div>
        <div v-if="expandedPanels.has(panel.id)" class="accordion-content">
          <slot :name="panel.id" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-toggle {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #555;
  user-select: none;
}
.panel-toggle:hover {
  background: #f5f5f5;
}
.floating-panel {
  position: absolute;
  width: 270px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  font-size: 12px;
  overflow: hidden;
  z-index: 100;
  user-select: none;
}
.panel-header {
  padding: 10px 14px;
  background: #fafafa;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  cursor: move;
}
.panel-title {
  font-weight: 600;
  color: #333;
  font-size: 13px;
}
.panel-actions {
  display: flex;
  gap: 6px;
}
.panel-action {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
}
.panel-action:hover {
  color: #333;
}
.panel-body {
  max-height: 70vh;
  overflow-y: auto;
}
.accordion-item {
  border-bottom: 1px solid #f0f0f0;
}
.accordion-item:last-child {
  border-bottom: none;
}
.accordion-header {
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  color: #333;
  background: #fafafa;
}
.accordion-header:hover {
  background: #f0f0f0;
}
.accordion-content {
  padding: 12px 14px;
}
</style>
