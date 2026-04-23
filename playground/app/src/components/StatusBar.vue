<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  strokeCount: number
  rendererName: string
  zoomLevel: number
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  undo: []
  redo: []
  clear: []
  exportPNG: []
  exportJSON: []
  importJSON: [file: File]
  zoomIn: []
  zoomOut: []
}>()

const fileInput = ref<HTMLInputElement>()

function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) {
    emit('importJSON', input.files[0])
    input.value = ''
  }
}

function triggerImport() {
  fileInput.value?.click()
}
</script>

<template>
  <footer class="statusbar">
    <div class="statusbar-left">
      <span class="info-item">笔画: {{ strokeCount }}</span>
      <span class="info-item">{{ rendererName }}</span>
    </div>
    <div class="statusbar-right">
      <div class="action-group">
        <button
          class="action-btn"
          :disabled="!canUndo"
          @click="$emit('undo')"
        >↩ 撤销</button>
        <button
          class="action-btn"
          :disabled="!canRedo"
          @click="$emit('redo')"
        >↪ 恢复</button>
        <button
          class="action-btn danger"
          @click="$emit('clear')"
        >清空</button>
      </div>
      <span class="statusbar-divider" />
      <div class="action-group">
        <button class="action-btn" @click="$emit('exportPNG')">导出 PNG</button>
        <button class="action-btn" @click="$emit('exportJSON')">导出 JSON</button>
        <button class="action-btn" @click="triggerImport">导入 JSON</button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          style="display:none"
          @change="handleImport"
        />
      </div>
      <span class="statusbar-divider" />
      <div class="zoom-controls">
        <button class="zoom-btn" @click="$emit('zoomOut')">−</button>
        <span class="zoom-value">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="zoom-btn" @click="$emit('zoomIn')">+</button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.statusbar {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fafafa;
  border-top: 1px solid #e8e8e8;
  flex-shrink: 0;
  font-size: 11px;
}
.statusbar-left {
  display: flex;
  gap: 12px;
  color: #999;
}
.info-item {
  white-space: nowrap;
}
.statusbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.statusbar-divider {
  width: 1px;
  height: 14px;
  background: #e0e0e0;
}
.action-group {
  display: flex;
  gap: 2px;
}
.action-btn {
  padding: 2px 8px;
  background: #f0f0f0;
  border: none;
  border-radius: 4px;
  font-size: 10px;
  color: #555;
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn:hover {
  background: #e0e0e0;
}
.action-btn:disabled {
  color: #ccc;
  cursor: default;
}
.action-btn:disabled:hover {
  background: #f0f0f0;
}
.action-btn.danger {
  color: #c33;
}
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}
.zoom-btn {
  padding: 1px 6px;
  background: #f0f0f0;
  border: none;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
}
.zoom-btn:hover {
  background: #e0e0e0;
}
.zoom-value {
  min-width: 36px;
  text-align: center;
  font-weight: 500;
  color: #666;
}
</style>
