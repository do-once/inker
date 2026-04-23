<script setup lang="ts">
import { ref, computed } from 'vue'
import type { StrokeGroup } from '@inker/recognition'
import { computeBBox } from '@inker/util'

const props = defineProps<{
  groups: StrokeGroup[]
  jsonResult: string
}>()

const emit = defineEmits<{
  'highlight-group': [index: number]
  'clear-all': []
}>()

const activeTab = ref<'groups' | 'json'>('groups')
const selectedGroupIndex = ref<number | null>(null)

const groupColors = [
  '#4fc3f7', '#81c784', '#ffb74d', '#e57373',
  '#ba68c8', '#4db6ac', '#f06292', '#aed581'
]

function getGroupColor(index: number): string {
  return groupColors[index % groupColors.length]
}

const totalStrokes = computed(() =>
  props.groups.reduce((sum, g) => sum + g.strokes.length, 0)
)

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(1) + 's'
}

function onGroupClick(index: number) {
  if (selectedGroupIndex.value === index) {
    selectedGroupIndex.value = null
    emit('highlight-group', -1)
  } else {
    selectedGroupIndex.value = index
    emit('highlight-group', index)
  }
}

function switchTab(tab: 'groups' | 'json') {
  activeTab.value = tab
  selectedGroupIndex.value = null
  emit('highlight-group', -1)
}

async function copyJson() {
  if (!props.jsonResult) return
  await navigator.clipboard.writeText(props.jsonResult)
}

function downloadJson() {
  if (!props.jsonResult) return
  const blob = new Blob([props.jsonResult], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'recognition-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

function highlightJson(json: string): string {
  if (!json) return ''
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"\s*:/g, '<span class="json-key">"$1"</span>:')
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="json-string">"$1"</span>')
    .replace(/\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, '<span class="json-number">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="json-bool">$1</span>')
}

function getGroupBBoxSize(group: StrokeGroup): string {
  if (group.strokes.length === 0) return '0 × 0'
  const b = computeBBox(group.strokes)
  return `${Math.round(b.width)} × ${Math.round(b.height)}`
}
</script>

<template>
  <div class="data-panel">
    <div class="tab-bar">
      <div class="tabs">
        <button
          :class="['tab', { active: activeTab === 'groups' }]"
          @click="switchTab('groups')"
        >
          分组概览
        </button>
        <button
          :class="['tab', { active: activeTab === 'json' }]"
          @click="switchTab('json')"
        >
          JSON 数据
        </button>
      </div>
      <div class="actions">
        <button class="action-btn primary" @click="copyJson" :disabled="!jsonResult" title="复制 JSON">
          复制
        </button>
        <button class="action-btn" @click="downloadJson" :disabled="!jsonResult" title="下载 JSON">
          下载
        </button>
        <button class="action-btn danger" @click="emit('clear-all')" title="清空所有数据">
          清空
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'groups'" class="tab-content">
      <div v-if="groups.length === 0" class="empty-hint">
        书写后将显示分组数据
      </div>
      <template v-else>
        <div class="summary">
          共 {{ groups.length }} 组 · {{ totalStrokes }} 笔画
        </div>
        <div
          v-for="(group, index) in groups"
          :key="index"
          :class="['group-card', { selected: selectedGroupIndex === index }]"
          :style="{ borderLeftColor: getGroupColor(index) }"
          @click="onGroupClick(index)"
        >
          <div class="group-header">
            <span class="group-name" :style="{ color: getGroupColor(index) }">
              组 {{ index + 1 }}
            </span>
            <span class="group-count">{{ group.strokes.length }} 笔画</span>
          </div>
          <div class="group-meta">
            <span>{{ formatTime(group.startTime) }} ~ {{ formatTime(group.endTime) }}</span>
            <span>{{ getGroupBBoxSize(group) }} px</span>
          </div>
        </div>
        <div class="hint">点击分组可在画布上高亮对应笔画</div>
      </template>
    </div>

    <div v-if="activeTab === 'json'" class="tab-content json-content">
      <div v-if="!jsonResult" class="empty-hint">
        书写后将显示 JSON 数据
      </div>
      <pre v-else class="json-view" v-html="highlightJson(jsonResult)" />
    </div>
  </div>
</template>

<style scoped>
.data-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-left: 1px solid #e0e0e0;
  font-size: 12px;
}
.tab-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
  flex-shrink: 0;
}
.tabs {
  display: flex;
  gap: 2px;
}
.tab {
  padding: 4px 10px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: #888;
  border-bottom: 2px solid transparent;
  font-weight: 500;
}
.tab.active {
  color: #1976d2;
  border-bottom-color: #1976d2;
}
.actions {
  display: flex;
  gap: 4px;
}
.action-btn {
  padding: 3px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 11px;
  color: #555;
}
.action-btn:hover:not(:disabled) {
  background: #f5f5f5;
}
.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.action-btn.primary {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}
.action-btn.primary:hover:not(:disabled) {
  background: #1565c0;
}
.action-btn.danger {
  color: #d32f2f;
  border-color: #d32f2f;
}
.action-btn.danger:hover:not(:disabled) {
  background: #ffebee;
}
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.empty-hint {
  color: #999;
  text-align: center;
  padding: 32px 16px;
  font-size: 12px;
}
.summary {
  color: #888;
  font-size: 11px;
  margin-bottom: 8px;
}
.group-card {
  background: #f9f9f9;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 6px;
  border-left: 3px solid #ccc;
  cursor: pointer;
  transition: background 0.15s;
}
.group-card:hover {
  background: #f0f0f0;
}
.group-card.selected {
  background: #e3f2fd;
}
.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}
.group-name {
  font-weight: 600;
  font-size: 12px;
}
.group-count {
  color: #888;
  font-size: 10px;
}
.group-meta {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: #aaa;
}
.hint {
  color: #bbb;
  font-size: 10px;
  text-align: center;
  padding: 8px;
}
.json-content {
  padding: 0;
}
.json-view {
  margin: 0;
  padding: 8px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: #333;
}
.json-view :deep(.json-key) {
  color: #881391;
}
.json-view :deep(.json-string) {
  color: #0b7e22;
}
.json-view :deep(.json-number) {
  color: #1976d2;
}
.json-view :deep(.json-bool) {
  color: #e65100;
}
</style>
