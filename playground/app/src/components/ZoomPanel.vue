<script setup lang="ts">
defineProps<{
  zoomLevel: number
  panModeActive: boolean
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  zoomToFit: []
  zoomReset: []
  togglePanMode: []
}>()

function formatZoom(zoom: number): string {
  return Math.round(zoom * 100) + '%'
}
</script>

<template>
  <div class="zoom-section">
    <div class="zoom-row">
      <button class="zoom-btn" title="缩小" @click="emit('zoomOut')">−</button>
      <span class="zoom-value">{{ formatZoom(zoomLevel) }}</span>
      <button class="zoom-btn" title="放大" @click="emit('zoomIn')">+</button>
    </div>
    <div class="zoom-actions">
      <button class="action-btn" @click="emit('zoomToFit')">适应画布</button>
      <button class="action-btn" @click="emit('zoomReset')">100%</button>
    </div>
    <div class="divider" />
    <button
      :class="['pan-btn', { active: panModeActive }]"
      @click="emit('togglePanMode')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2v12M2 8h12M4 4l-2 4 2 4M12 4l2 4-2 4M4 4l4-2 4 2M4 12l4 2 4-2" />
      </svg>
      {{ panModeActive ? '平移中' : '平移模式' }}
    </button>
    <div class="zoom-hint">滚轮缩放 · 空格临时平移</div>
  </div>
</template>

<style scoped>
.zoom-section {
}
.zoom-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}
.zoom-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.zoom-btn:hover {
  background: #f5f5f5;
}
.zoom-value {
  flex: 1;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}
.zoom-actions {
  display: flex;
  gap: 4px;
}
.action-btn {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 12px;
  text-align: center;
  transition: all 0.15s;
}
.action-btn:hover {
  background: #f5f5f5;
}
.divider {
  height: 1px;
  background: #eee;
  margin: 8px 0;
}
.pan-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 13px;
  text-align: center;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.pan-btn:hover {
  background: #f5f5f5;
}
.pan-btn.active {
  background: #333;
  color: #fff;
  border-color: #333;
}
.zoom-hint {
  margin-top: 8px;
  font-size: 11px;
  color: #bbb;
  text-align: center;
}
</style>
