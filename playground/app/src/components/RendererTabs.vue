<script setup lang="ts">
defineProps<{
  activeRenderer: string
  compareMode: boolean
}>()

defineEmits<{
  'update:activeRenderer': [id: string]
  'update:compareMode': [value: boolean]
}>()

const renderers = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'svg', label: 'SVG' },
  { id: 'offscreen', label: 'Offscreen' }
]
</script>

<template>
  <div class="renderer-tabs">
    <button
      v-for="r in renderers"
      :key="r.id"
      class="tab-btn"
      :class="{ active: !compareMode && activeRenderer === r.id }"
      :disabled="compareMode"
      @click="$emit('update:activeRenderer', r.id)"
    >{{ r.label }}</button>
    <span class="tab-divider" />
    <button
      class="tab-btn compare-btn"
      :class="{ active: compareMode }"
      @click="$emit('update:compareMode', !compareMode)"
    >⊞ 对比</button>
  </div>
</template>

<style scoped>
.renderer-tabs {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0;
  background: #f0f0f0;
  border-radius: 8px;
  padding: 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  z-index: 50;
}
.tab-btn {
  padding: 4px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  color: #888;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.tab-btn:hover:not(:disabled) {
  color: #555;
}
.tab-btn.active {
  background: #fff;
  color: #333;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.tab-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.tab-divider {
  width: 1px;
  height: 14px;
  background: #ddd;
  margin: 0 2px;
}
.compare-btn.active {
  background: #e8f0fe;
  color: #1a73e8;
}
</style>
