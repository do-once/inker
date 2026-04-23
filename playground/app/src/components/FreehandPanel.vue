<script setup lang="ts">
import SliderControl from './SliderControl.vue'
import type { EasingType } from '@inker/types'

const EASING_OPTIONS: EasingType[] = [
  'linear',
  'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
  'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
  'easeInQuart', 'easeOutQuart', 'easeInOutQuart',
  'easeInQuint', 'easeOutQuint', 'easeInOutQuint',
  'easeInSine', 'easeOutSine', 'easeInOutSine',
  'easeInExpo', 'easeOutExpo', 'easeInOutExpo'
]

const props = defineProps<{
  thinning: number
  smoothing: number
  streamline: number
  easing: EasingType
  simulatePressure: boolean
  taperStart: number
  capStart: boolean
  taperEnd: number
  capEnd: boolean
}>()

const emit = defineEmits<{
  'update:thinning': [value: number]
  'update:smoothing': [value: number]
  'update:streamline': [value: number]
  'update:easing': [value: EasingType]
  'update:simulatePressure': [value: boolean]
  'update:taperStart': [value: number]
  'update:capStart': [value: boolean]
  'update:taperEnd': [value: number]
  'update:capEnd': [value: boolean]
  'applyOfficialDefaults': []
}>()
</script>

<template>
  <div class="freehand-panel">
    <SliderControl
      label="细化"
      :min="-1"
      :max="1"
      :step="0.1"
      :model-value="props.thinning"
      @update:model-value="emit('update:thinning', $event)"
    />
    <SliderControl
      label="平滑"
      :min="0"
      :max="1"
      :step="0.1"
      :model-value="props.smoothing"
      @update:model-value="emit('update:smoothing', $event)"
    />
    <SliderControl
      label="流线"
      :min="0"
      :max="1"
      :step="0.1"
      :model-value="props.streamline"
      @update:model-value="emit('update:streamline', $event)"
    />
    <div class="select-row">
      <span class="select-label">缓动</span>
      <select
        :value="props.easing"
        @change="emit('update:easing', ($event.target as HTMLSelectElement).value as EasingType)"
        class="select-input"
      >
        <option v-for="opt in EASING_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </div>
    <label class="checkbox-row">
      <input
        type="checkbox"
        :checked="props.simulatePressure"
        @change="emit('update:simulatePressure', ($event.target as HTMLInputElement).checked)"
      />
      <span>模拟压感</span>
    </label>
    <SliderControl
      label="起始渐细"
      :min="0"
      :max="100"
      :step="1"
      :model-value="props.taperStart"
      @update:model-value="emit('update:taperStart', $event)"
    />
    <label class="checkbox-row">
      <input
        type="checkbox"
        :checked="props.capStart"
        @change="emit('update:capStart', ($event.target as HTMLInputElement).checked)"
      />
      <span>起始端帽</span>
    </label>
    <SliderControl
      label="结束渐细"
      :min="0"
      :max="100"
      :step="1"
      :model-value="props.taperEnd"
      @update:model-value="emit('update:taperEnd', $event)"
    />
    <label class="checkbox-row">
      <input
        type="checkbox"
        :checked="props.capEnd"
        @change="emit('update:capEnd', ($event.target as HTMLInputElement).checked)"
      />
      <span>结束端帽</span>
    </label>
    <button class="official-btn" @click="emit('applyOfficialDefaults')">
      官网默认
    </button>
  </div>
</template>

<style scoped>
.freehand-panel {
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  cursor: pointer;
}
.checkbox-row input {
  cursor: pointer;
}
.select-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.select-label {
  font-size: 12px;
  color: #666;
}
.select-input {
  width: 120px;
  font-size: 12px;
  padding: 2px 4px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.official-btn {
  width: 100%;
  padding: 6px 0;
  margin-top: 8px;
  font-size: 12px;
  color: #1a73e8;
  background: #e8f0fe;
  border: 1px solid #d2e3fc;
  border-radius: 4px;
  cursor: pointer;
}
.official-btn:hover {
  background: #d2e3fc;
}
</style>
