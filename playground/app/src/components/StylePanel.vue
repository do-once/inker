<script setup lang="ts">
import SliderControl from './SliderControl.vue'

const props = defineProps<{
  color: string
  size: number
  opacity: number
}>()

const emit = defineEmits<{
  'update:color': [value: string]
  'update:size': [value: number]
  'update:opacity': [value: number]
}>()
</script>

<template>
  <div class="style-panel">
    <div class="color-row">
      <span class="color-label">颜色</span>
      <input
        type="color"
        :value="props.color"
        @input="emit('update:color', ($event.target as HTMLInputElement).value)"
        class="color-input"
      />
    </div>
    <SliderControl
      label="大小"
      :min="1"
      :max="50"
      :step="1"
      :model-value="props.size"
      @update:model-value="emit('update:size', $event)"
    />
    <SliderControl
      label="透明度"
      :min="0"
      :max="1"
      :step="0.1"
      :model-value="props.opacity"
      @update:model-value="emit('update:opacity', $event)"
    />
  </div>
</template>

<style scoped>
.style-panel {
}
.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.color-label {
  font-size: 12px;
  color: #666;
}
.color-input {
  width: 32px;
  height: 24px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}
</style>
