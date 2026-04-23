# 识别调试页面 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 playground 的识别调试场景从占位组件完善为完整的 `@inker/recognition` 集成示例，支持自动/手动两种导出模式、分组概览、JSON 预览和数据操作。

**Architecture:** 画布主导 2:1 布局（左侧书写区 2/3 + 右侧数据面板 1/3）。核心逻辑封装在 `useRecognitionEditor` composable 中，管理 RecognitionHelper 生命周期和导出流程。数据面板 `RecognitionDataPanel` 作为纯展示组件，通过 props/emits 与父组件通信。

**Tech Stack:** Vue 3 Composition API, TypeScript, @inker/sdk, @inker/recognition

---

## Chunk 1: useRecognitionEditor composable

### Task 1: 创建 useRecognitionEditor composable 基础结构

**Files:**
- Create: `playground/app/src/scenes/recognition/useRecognitionEditor.ts`

- [ ] **Step 1: 创建 composable 文件，实现 Inker 实例管理和基础状态**

```typescript
import { ref, reactive, watch, onUnmounted, type Ref } from 'vue'
import { useEditor } from '../../composables/useEditor'
import {
  RecognitionHelper,
  groupByTime,
  translateToOrigin,
  SimpleJsonFormat,
  type StrokeGroup
} from '@inker/recognition'
import type { ToolType } from '../../types'
import type { Stroke, BoundingBox } from '@inker/types'

/** 工具预设参数 */
const toolPresets: Record<string, { color: string; size: number; opacity: number }> = {
  pen: { color: '#000000', size: 2, opacity: 1 },
  pencil: { color: '#333333', size: 1, opacity: 0.8 },
  eraser: { color: '#ffffff', size: 20, opacity: 1 }
}

export type RecognitionStatus = 'idle' | 'writing' | 'paused' | 'triggered'

export function useRecognitionEditor() {
  const currentTool = ref<ToolType>('pen')

  const styleParams = reactive({
    color: '#000000', size: 2, opacity: 1,
    thinning: 0.5, smoothing: 0.5, streamline: 0.5,
    easing: 'linear' as string,
    simulatePressure: true,
    taperStart: 0, capStart: true, taperEnd: 0, capEnd: true
  })

  const editorApi = useEditor(styleParams, currentTool)

  // 识别参数
  const gapMs = ref(500)
  const translateEnabled = ref(true)
  const includeBoundingBox = ref(true)

  // 模式控制
  const autoMode = ref(true)
  const manualMode = ref(true)

  // 识别状态
  const groups = ref<StrokeGroup[]>([])
  const jsonResult = ref('')
  const status = ref<RecognitionStatus>('idle')

  // RecognitionHelper 实例
  let helper: RecognitionHelper | null = null
  let unsubscribeHelper: (() => void) | null = null

  // 状态指示定时器
  let statusTimer: ReturnType<typeof setTimeout> | null = null
  let triggeredTimer: ReturnType<typeof setTimeout> | null = null

  const format = new SimpleJsonFormat()

  /** 切换工具并应用预设参数 */
  function setTool(tool: ToolType) {
    currentTool.value = tool
    const preset = toolPresets[tool]
    if (preset) {
      styleParams.color = preset.color
      styleParams.size = preset.size
      styleParams.opacity = preset.opacity
    }
  }

  /** 将 groups 转换为 JSON 字符串 */
  function updateJsonResult() {
    const allStrokes = groups.value.flatMap(g => g.strokes)
    if (allStrokes.length === 0) {
      jsonResult.value = ''
      return
    }

    // 平移处理
    const processedStrokes = translateEnabled.value
      ? translateToOrigin(allStrokes)
      : allStrokes

    // 调用 SimpleJsonFormat 时不传 boundingBox: true（避免双重平移）
    const result = format.convert(processedStrokes)

    // 手动附加包围盒
    const output: Record<string, unknown> = { strokes: result.strokes }
    if (includeBoundingBox.value) {
      if (translateEnabled.value) {
        // 平移后坐标系：minX/minY 为 0
        const originalBbox = groups.value.length > 0
          ? mergeGroupBoundingBoxes(groups.value)
          : null
        output.boundingBox = originalBbox
          ? { minX: 0, minY: 0, maxX: originalBbox.width, maxY: originalBbox.height, width: originalBbox.width, height: originalBbox.height }
          : null
      } else {
        output.boundingBox = mergeGroupBoundingBoxes(groups.value)
      }
    }

    jsonResult.value = JSON.stringify(output, null, 2)
  }

  /** 合并多个分组的包围盒 */
  function mergeGroupBoundingBoxes(groups: StrokeGroup[]): BoundingBox | null {
    if (groups.length === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const g of groups) {
      const b = g.boundingBox
      if (b.minX < minX) minX = b.minX
      if (b.minY < minY) minY = b.minY
      if (b.maxX > maxX) maxX = b.maxX
      if (b.maxY > maxY) maxY = b.maxY
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
  }

  /** 绑定 RecognitionHelper 到 Inker 实例 */
  function bindHelper() {
    if (!editorApi.editor.value) return

    // 清理旧 helper
    disposeHelper()

    helper = new RecognitionHelper({ gapMs: gapMs.value })
    helper.bindTo(editorApi.editor.value)

    unsubscribeHelper = helper.onWritingComplete(group => {
      if (!autoMode.value) return
      groups.value = [...groups.value, group]
      updateJsonResult()

      // 状态：触发 → 500ms 后回退
      status.value = 'triggered'
      clearStatusTimers()
      triggeredTimer = setTimeout(() => {
        if (status.value === 'triggered') {
          status.value = editorApi.strokeCount.value > 0 ? 'idle' : 'idle'
        }
      }, 500)
    })
  }

  function disposeHelper() {
    unsubscribeHelper?.()
    unsubscribeHelper = null
    if (helper) {
      try { helper.dispose() } catch {}
      helper = null
    }
  }

  function clearStatusTimers() {
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null }
    if (triggeredTimer) { clearTimeout(triggeredTimer); triggeredTimer = null }
  }

  /** 监听 stroke:start / stroke:end 驱动状态机 */
  let unsubStrokeStart: (() => void) | null = null
  let unsubStrokeEnd: (() => void) | null = null

  function bindStatusListeners() {
    const ed = editorApi.editor.value
    if (!ed) return

    unsubStrokeStart = ed.on('stroke:start', () => {
      clearStatusTimers()
      status.value = 'writing'
    })

    unsubStrokeEnd = ed.on('stroke:end', () => {
      if (!autoMode.value) {
        status.value = 'idle'
        return
      }
      status.value = 'paused'
      clearStatusTimers()
      statusTimer = setTimeout(() => {
        // 如果还在 paused，说明 helper 回调即将或已经触发
        // 状态由 helper 回调接管
      }, gapMs.value)
    })
  }

  function unbindStatusListeners() {
    unsubStrokeStart?.()
    unsubStrokeEnd?.()
    unsubStrokeStart = null
    unsubStrokeEnd = null
  }

  /** 手动导出 */
  function manualExport() {
    const ed = editorApi.editor.value
    if (!ed) return

    const snapshot = ed.getSnapshot()
    const allStrokes = snapshot.strokeOrder.map(
      (id: string) => snapshot.strokes.get(id)!
    )
    if (allStrokes.length === 0) return

    groups.value = groupByTime(allStrokes, gapMs.value)
    updateJsonResult()
  }

  /** 清空所有数据 */
  function clearAll() {
    groups.value = []
    jsonResult.value = ''
    status.value = 'idle'
    clearStatusTimers()
    editorApi.clear()
  }

  /** 重新绑定 helper（gapMs 变化时调用） */
  function rebindHelper() {
    bindHelper()
  }

  /** 初始化编辑器（包含 helper 绑定） */
  function initEditor(container: HTMLElement) {
    editorApi.initEditor(container)
    bindHelper()
    bindStatusListeners()
  }

  // gapMs 变化时自动重绑 helper
  watch(gapMs, () => {
    rebindHelper()
  })

  function dispose() {
    clearStatusTimers()
    unbindStatusListeners()
    disposeHelper()
    editorApi.dispose()
  }

  return {
    // 编辑器基础 API
    editor: editorApi.editor,
    strokeCount: editorApi.strokeCount,
    zoomLevel: editorApi.zoomLevel,
    canUndo: editorApi.canUndo,
    canRedo: editorApi.canRedo,
    // 工具
    currentTool,
    styleParams,
    setTool,
    undo: editorApi.undo,
    redo: editorApi.redo,
    // 识别特有
    gapMs,
    translateEnabled,
    includeBoundingBox,
    autoMode,
    manualMode,
    groups,
    jsonResult,
    status,
    // 方法
    initEditor,
    dispose,
    manualExport,
    clearAll,
    rebindHelper,
    exportPNG: editorApi.exportPNG
  }
}
```

- [ ] **Step 2: 验证文件无语法错误**

Run: `cd playground/app && npx vue-tsc --noEmit --pretty 2>&1 | head -20`
Expected: 无与 `useRecognitionEditor.ts` 相关的错误

- [ ] **Step 3: 提交**

```bash
git add playground/app/src/scenes/recognition/useRecognitionEditor.ts
git commit -m "feat(playground): 添加识别场景 useRecognitionEditor composable"
```

---

## Chunk 2: RecognitionDataPanel 组件

### Task 2: 创建 RecognitionDataPanel 数据面板组件

**Files:**
- Create: `playground/app/src/scenes/recognition/RecognitionDataPanel.vue`

- [ ] **Step 1: 创建数据面板组件**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { StrokeGroup } from '@inker/recognition'

const props = defineProps<{
  groups: StrokeGroup[]
  jsonResult: string
}>()

const emit = defineEmits<{
  'highlight-group': [index: number]
  'clear-all': []
}>()

// Tab 状态
const activeTab = ref<'groups' | 'json'>('groups')

// 选中的分组索引（用于高亮）
const selectedGroupIndex = ref<number | null>(null)

// 分组颜色
const groupColors = [
  '#4fc3f7', '#81c784', '#ffb74d', '#e57373',
  '#ba68c8', '#4db6ac', '#f06292', '#aed581'
]

function getGroupColor(index: number): string {
  return groupColors[index % groupColors.length]
}

// 统计
const totalStrokes = computed(() =>
  props.groups.reduce((sum, g) => sum + g.strokes.length, 0)
)

// 格式化时间
function formatTime(ms: number): string {
  return (ms / 1000).toFixed(1) + 's'
}

// 点击分组
function onGroupClick(index: number) {
  if (selectedGroupIndex.value === index) {
    selectedGroupIndex.value = null
    emit('highlight-group', -1)
  } else {
    selectedGroupIndex.value = index
    emit('highlight-group', index)
  }
}

// Tab 切换时取消高亮
function switchTab(tab: 'groups' | 'json') {
  activeTab.value = tab
  selectedGroupIndex.value = null
  emit('highlight-group', -1)
}

// 复制 JSON
async function copyJson() {
  if (!props.jsonResult) return
  await navigator.clipboard.writeText(props.jsonResult)
}

// 下载 JSON
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

// JSON 语法高亮（简单正则）
function highlightJson(json: string): string {
  if (!json) return ''
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 字符串（key 和 value）
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"\s*:/g, '<span class="json-key">"$1"</span>:')
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="json-string">"$1"</span>')
    // 数字
    .replace(/\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, '<span class="json-number">$1</span>')
    // 布尔和 null
    .replace(/\b(true|false|null)\b/g, '<span class="json-bool">$1</span>')
}
</script>

<template>
  <div class="data-panel">
    <!-- Tab 栏 -->
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

    <!-- 分组概览 Tab -->
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
            <span>{{ Math.round(group.boundingBox.width) }} × {{ Math.round(group.boundingBox.height) }} px</span>
          </div>
        </div>
        <div class="hint">点击分组可在画布上高亮对应笔画</div>
      </template>
    </div>

    <!-- JSON 数据 Tab -->
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
```

- [ ] **Step 2: 验证文件无语法错误**

Run: `cd playground/app && npx vue-tsc --noEmit --pretty 2>&1 | head -20`
Expected: 无与 `RecognitionDataPanel.vue` 相关的错误

- [ ] **Step 3: 提交**

```bash
git add playground/app/src/scenes/recognition/RecognitionDataPanel.vue
git commit -m "feat(playground): 添加识别数据面板组件 RecognitionDataPanel"
```

---

## Chunk 3: 场景组装和 config 更新

### Task 3: 更新 config.ts 添加识别参数面板

**Files:**
- Modify: `playground/app/src/scenes/recognition/config.ts`

- [ ] **Step 1: 在 panels 中添加 'recognition'**

将 `config.ts` 修改为：

```typescript
import type { SceneConfig } from '../../types'

export const recognitionScene: SceneConfig = {
  name: '识别调试',
  path: '/recognition',
  component: () => import('./RecognitionScene.vue'),
  tools: ['pen', 'pencil', 'eraser'],
  panels: ['style', 'brush', 'recognition']
}
```

- [ ] **Step 2: 在 `FloatingPanel.vue` 的 `panelLabels` 中添加 'recognition' 的中文标签**

在 `playground/app/src/components/FloatingPanel.vue` 的 `panelLabels` 对象中添加：

```typescript
const panelLabels: Record<string, string> = {
  style: '样式',
  brush: '笔刷参数',
  zoom: '缩放与视口',
  playback: '回放',
  recognition: '识别参数'
}
```

- [ ] **Step 3: 提交**

```bash
git add playground/app/src/scenes/recognition/config.ts playground/app/src/components/FloatingPanel.vue
git commit -m "feat(playground): 注册识别参数面板到 FloatingPanel"
```

### Task 4: 重写 RecognitionScene.vue 实现完整布局

**Files:**
- Modify: `playground/app/src/scenes/recognition/RecognitionScene.vue`

- [ ] **Step 1: 重写 RecognitionScene.vue**

将整个文件替换为：

```vue
<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted, watchEffect, computed } from 'vue'
import { useRecognitionEditor } from './useRecognitionEditor'
import RecognitionDataPanel from './RecognitionDataPanel.vue'
import { recognitionScene } from './config'
import RendererTabs from '../../components/RendererTabs.vue'
import FloatingPanel from '../../components/FloatingPanel.vue'
import StylePanel from '../../components/StylePanel.vue'
import FreehandPanel from '../../components/FreehandPanel.vue'
import SliderControl from '../../components/SliderControl.vue'
import type { ToolType, SceneState, SceneActions } from '../../types'
import type { EasingType } from '@inker/types'

const containerRef = ref<HTMLElement>()
const activeRenderer = ref('canvas')
const compareMode = ref(false)

const {
  editor,
  currentTool,
  styleParams,
  strokeCount,
  zoomLevel,
  canUndo,
  canRedo,
  // 识别特有
  gapMs,
  translateEnabled,
  includeBoundingBox,
  autoMode,
  manualMode,
  groups,
  jsonResult,
  status,
  // 方法
  initEditor,
  dispose,
  setTool,
  undo,
  redo,
  manualExport,
  clearAll,
  exportPNG
} = useRecognitionEditor()

// 分组高亮
const highlightedGroupIndex = ref<number | null>(null)

function onHighlightGroup(index: number) {
  highlightedGroupIndex.value = index >= 0 ? index : null
}

// 高亮 overlay 的样式计算
const highlightStyle = computed(() => {
  if (highlightedGroupIndex.value === null || !editor.value) return null
  const group = groups.value[highlightedGroupIndex.value]
  if (!group) return null

  const cam = editor.value.camera
  const bbox = group.boundingBox

  const x = (bbox.minX - cam.x) * cam.zoom
  const y = (bbox.minY - cam.y) * cam.zoom
  const w = bbox.width * cam.zoom
  const h = bbox.height * cam.zoom

  return {
    left: x + 'px',
    top: y + 'px',
    width: w + 'px',
    height: h + 'px'
  }
})

// 状态颜色
const statusColor = computed(() => {
  switch (status.value) {
    case 'writing': return '#4caf50'
    case 'paused': return '#ff9800'
    case 'triggered': return '#2196f3'
    default: return '#999'
  }
})

const statusLabel = computed(() => {
  switch (status.value) {
    case 'writing': return '书写中'
    case 'paused': return '已停顿 (等待中...)'
    case 'triggered': return '已触发'
    default: return '空闲'
  }
})

// App 壳通信
const sceneState = inject<SceneState>('sceneState')!
const registerActions = inject<(actions: Partial<SceneActions>) => void>('registerActions')!
const unregisterActions = inject<() => void>('unregisterActions')!

watchEffect(() => {
  sceneState.currentTool = currentTool.value
  sceneState.tools = recognitionScene.tools || []
  sceneState.strokeCount = strokeCount.value
  sceneState.rendererName = 'Canvas 2D'
  sceneState.zoomLevel = zoomLevel.value
  sceneState.canUndo = canUndo.value
  sceneState.canRedo = canRedo.value
})

onMounted(() => {
  if (containerRef.value) initEditor(containerRef.value)
  registerActions({
    setTool, undo, redo,
    clear: clearAll,
    exportPNG
  })
})

onUnmounted(() => {
  unregisterActions()
  dispose()
})
</script>

<template>
  <div class="recognition-scene">
    <!-- 左侧：画布区 (2/3) -->
    <div class="canvas-area">
      <!-- 顶栏 -->
      <div class="top-bar">
        <span class="scene-title">识别调试</span>
        <div class="mode-controls">
          <label class="mode-toggle">
            <input type="checkbox" v-model="autoMode" />
            <span>自动</span>
          </label>
          <label class="mode-toggle">
            <input type="checkbox" v-model="manualMode" />
            <span>手动</span>
          </label>
          <button
            v-if="manualMode"
            class="export-btn"
            @click="manualExport"
            :disabled="strokeCount === 0"
          >
            导出
          </button>
        </div>
      </div>

      <!-- 画布容器 -->
      <div class="canvas-wrapper">
        <div ref="containerRef" class="editor-container" />
        <!-- 分组高亮 overlay -->
        <div
          v-if="highlightStyle"
          class="highlight-overlay"
          :style="highlightStyle"
        />
      </div>

      <!-- 底部状态栏 -->
      <div class="status-bar">
        <span class="status-indicator">
          <span class="status-dot" :style="{ background: statusColor }" />
          {{ statusLabel }}
        </span>
        <span class="status-info">
          笔画: {{ strokeCount }} · 分组: {{ groups.length }}
        </span>
      </div>
    </div>

    <!-- 右侧：数据面板 (1/3) -->
    <RecognitionDataPanel
      :groups="groups"
      :json-result="jsonResult"
      @highlight-group="onHighlightGroup"
      @clear-all="clearAll"
    />

    <!-- 渲染器切换 -->
    <RendererTabs
      v-model:active-renderer="activeRenderer"
      v-model:compare-mode="compareMode"
    />

    <!-- 浮动参数面板 -->
    <FloatingPanel :panels="recognitionScene.panels || []">
      <template #style>
        <StylePanel
          :color="styleParams.color"
          :size="styleParams.size"
          :opacity="styleParams.opacity"
          @update:color="styleParams.color = $event"
          @update:size="styleParams.size = $event"
          @update:opacity="styleParams.opacity = $event"
        />
      </template>
      <template #brush>
        <FreehandPanel
          :thinning="styleParams.thinning"
          :smoothing="styleParams.smoothing"
          :streamline="styleParams.streamline"
          :easing="styleParams.easing as EasingType"
          :simulate-pressure="styleParams.simulatePressure"
          :taper-start="styleParams.taperStart"
          :cap-start="styleParams.capStart"
          :taper-end="styleParams.taperEnd"
          :cap-end="styleParams.capEnd"
          @update:thinning="styleParams.thinning = $event"
          @update:smoothing="styleParams.smoothing = $event"
          @update:streamline="styleParams.streamline = $event"
          @update:easing="styleParams.easing = $event"
          @update:simulate-pressure="styleParams.simulatePressure = $event"
          @update:taper-start="styleParams.taperStart = $event"
          @update:cap-start="styleParams.capStart = $event"
          @update:taper-end="styleParams.taperEnd = $event"
          @update:cap-end="styleParams.capEnd = $event"
        />
      </template>
      <template #recognition>
        <div class="recognition-params">
          <SliderControl
            label="分组间隔 (ms)"
            :model-value="gapMs"
            :min="100"
            :max="3000"
            :step="100"
            @update:model-value="gapMs = $event"
          />
          <div class="param-toggle">
            <label>
              <input type="checkbox" v-model="translateEnabled" />
              平移到原点
            </label>
          </div>
          <div class="param-toggle">
            <label>
              <input type="checkbox" v-model="includeBoundingBox" />
              包含包围盒
            </label>
          </div>
        </div>
      </template>
    </FloatingPanel>
  </div>
</template>

<style scoped>
.recognition-scene {
  width: 100%;
  height: 100%;
  display: flex;
  position: relative;
}
.canvas-area {
  flex: 2;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #fafafa;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
  z-index: 10;
}
.scene-title {
  font-weight: 600;
  font-size: 13px;
  color: #333;
}
.mode-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mode-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #555;
  cursor: pointer;
}
.mode-toggle input {
  cursor: pointer;
}
.export-btn {
  padding: 3px 10px;
  border: 1px solid #1976d2;
  border-radius: 4px;
  background: #1976d2;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
}
.export-btn:hover:not(:disabled) {
  background: #1565c0;
}
.export-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.canvas-wrapper {
  flex: 1;
  position: relative;
  min-height: 0;
}
.editor-container {
  width: 100%;
  height: 100%;
}
.highlight-overlay {
  position: absolute;
  border: 2px dashed #1976d2;
  background: rgba(25, 118, 210, 0.08);
  pointer-events: none;
  z-index: 5;
  border-radius: 2px;
}
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 12px;
  background: #fafafa;
  border-top: 1px solid #e0e0e0;
  font-size: 11px;
  color: #888;
  flex-shrink: 0;
}
.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.recognition-params {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.param-toggle {
  display: flex;
  align-items: center;
}
.param-toggle label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #555;
  cursor: pointer;
}
</style>
```

- [ ] **Step 2: 检查 SliderControl 组件是否存在并确认 props**

Run: `ls playground/app/src/components/SliderControl.vue`

如果不存在，需要在 RecognitionScene 中内联滑块，用原生 `<input type="range">` + `<input type="number">` 替代：

```html
<div class="slider-row">
  <label>分组间隔 (ms)</label>
  <input type="range" v-model.number="gapMs" min="100" max="3000" step="100" />
  <input type="number" v-model.number="gapMs" min="100" max="3000" step="100" class="num-input" />
</div>
```

- [ ] **Step 3: 验证构建**

Run: `cd playground/app && npx vue-tsc --noEmit --pretty 2>&1 | head -30`
Expected: 无类型错误

- [ ] **Step 4: 启动开发服务器验证页面可访问**

Run: `cd playground/app && pnpm dev`
访问 `/recognition` 路由，确认页面可正常加载且布局为 2:1 分栏

- [ ] **Step 5: 提交**

```bash
git add playground/app/src/scenes/recognition/RecognitionScene.vue
git commit -m "feat(playground): 重写识别场景为完整集成示例布局"
```

---

## Chunk 4: 集成测试和功能验证

### Task 5: 端到端功能验证

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm dev`

- [ ] **Step 2: 验证自动模式**

1. 打开 `/recognition` 页面
2. 使用鼠标书写几笔，停顿 500ms 以上
3. 确认右侧"分组概览" tab 自动出现分组卡片
4. 确认 JSON 数据 tab 有格式化的 JSON 输出
5. 确认底部状态栏依次显示：书写中 → 已停顿 → 已触发 → 空闲

- [ ] **Step 3: 验证手动模式**

1. 关闭自动模式，开启手动模式
2. 书写几笔，确认不会自动触发
3. 点击"导出"按钮
4. 确认分组数据正确显示（全量分组）

- [ ] **Step 4: 验证数据操作**

1. 点击"复制"按钮，粘贴确认 JSON 内容
2. 点击"下载"按钮，确认下载文件名为 `recognition-export.json`
3. 点击"清空"按钮，确认画布和数据面板均清空

- [ ] **Step 5: 验证分组高亮**

1. 书写多组笔画（中间停顿足够长）
2. 点击某个分组卡片，确认画布上出现虚线矩形高亮
3. 再次点击取消高亮
4. 切换 tab 确认高亮消失

- [ ] **Step 6: 验证参数控制**

1. 打开浮动面板的"识别参数"折叠组
2. 调整分组间隔滑块，书写验证分组行为变化
3. 关闭"平移到原点"，验证 JSON 输出坐标为世界坐标
4. 关闭"包含包围盒"，验证 JSON 输出无 boundingBox 字段

- [ ] **Step 7: 修复发现的问题**

根据验证结果修复任何 bug。

- [ ] **Step 8: 最终提交**

```bash
git add -A
git commit -m "fix(playground): 修复识别调试页面集成问题"
```

---

## Chunk 5: 文档同步

### Task 6: 更新文档

**Files:**
- Modify: `playground/app/README.md`（如存在）

- [ ] **Step 1: 检查是否有需要更新的文档**

检查 `playground/app/README.md` 是否存在，如有则添加识别调试场景的描述。

- [ ] **Step 2: 提交文档更新**

```bash
git add -A
git commit -m "docs: 更新 playground 文档反映识别调试页面"
```
