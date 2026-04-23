<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { scenes } from '../scenes'
import type { ToolType } from '../types'

defineProps<{
  tools: ToolType[]
  currentTool: ToolType
}>()

defineEmits<{
  setTool: [tool: ToolType]
}>()

const router = useRouter()
const route = useRoute()

const toolLabels: Record<ToolType, string> = {
  pen: '钢笔',
  marker: '马克笔',
  pencil: '铅笔',
  eraser: '橡皮'
}

function onSceneChange(event: Event) {
  const path = (event.target as HTMLSelectElement).value
  router.push(path)
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <span class="topbar-title">Inker</span>
      <select
        class="scene-select"
        :value="route.path"
        @change="onSceneChange"
      >
        <option
          v-for="scene in scenes"
          :key="scene.path"
          :value="scene.path"
        >{{ scene.name }}</option>
      </select>
      <span class="topbar-divider" />
      <div class="tool-group">
        <button
          v-for="tool in tools"
          :key="tool"
          class="tool-btn"
          :class="{ active: currentTool === tool }"
          @click="$emit('setTool', tool)"
        >{{ toolLabels[tool] }}</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.topbar-title {
  font-weight: 700;
  font-size: 14px;
  color: #1a1a2e;
}
.scene-select {
  padding: 3px 8px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 12px;
  background: #fff;
  cursor: pointer;
}
.topbar-divider {
  width: 1px;
  height: 18px;
  background: #e8e8e8;
}
.tool-group {
  display: flex;
  gap: 3px;
}
.tool-btn {
  padding: 4px 10px;
  background: #f5f5f5;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  color: #555;
  cursor: pointer;
  transition: all 0.15s;
}
.tool-btn:hover {
  background: #eee;
}
.tool-btn.active {
  background: #e8f0fe;
  color: #1a73e8;
  font-weight: 500;
}
</style>
