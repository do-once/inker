<script setup lang="ts">
defineProps<{
  label: string
  min: number
  max: number
  step: number
  modelValue: number
}>()

defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<template>
  <div class="slider-control">
    <label class="slider-label">
      <span>{{ label }}</span>
      <span class="slider-value">{{ modelValue }}</span>
    </label>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    />
  </div>
</template>

<style scoped>
.slider-control {
  margin-bottom: 8px;
}
.slider-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
}
.slider-value {
  font-variant-numeric: tabular-nums;
  color: #999;
}
input[type="range"] {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #555;
  cursor: pointer;
}
</style>
