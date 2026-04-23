# Playground 重构实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 playground 从单页平铺结构重构为多场景路由架构，采用浮动面板 + 紧凑顶栏 + 状态栏布局。

**Architecture:** Vue Router 驱动场景切换，每个场景独立编辑器实例。共享 useEditor composable 管理编辑器生命周期，场景专属 composable 添加特有逻辑。UI 从固定侧边栏改为浮动手风琴面板。

**Tech Stack:** Vue 3 Composition API, Vue Router 4, Vite, Scoped CSS

**Spec:** `docs/superpowers/specs/2026-03-13-playground-restructure-design.md`

**本次范围外：** CompareView 对比模式的三列并排画布实现（本次仅预留按钮和状态切换，实际多渲染器并排渲染后续迭代）

---

## Chunk 1: 基础设施（路由 + 类型 + 场景注册）

### Task 1: 安装 Vue Router 并创建类型定义

**Files:**
- Modify: `playground/app/package.json`
- Create: `playground/app/src/types.ts`

- [ ] **Step 1: 安装 vue-router**

```bash
cd playground/app && pnpm add vue-router@4
```

- [ ] **Step 2: 创建类型定义文件**

创建 `playground/app/src/types.ts`：

```ts
import type { Component } from 'vue'

export type ToolType = 'pen' | 'marker' | 'pencil' | 'eraser'

export interface StyleParams {
  color: string
  size: number
  opacity: number
  thinning: number
  smoothing: number
  streamline: number
  easing: string
  simulatePressure: boolean
  taperStart: number
  capStart: boolean
  taperEnd: number
  capEnd: boolean
}

export interface PanelGroupConfig {
  id: string
  label: string
  component: Component
}

export interface SceneConfig {
  name: string
  path: string
  component: () => Promise<Component>
  tools?: ToolType[]
  panels?: string[]
  extraPanels?: PanelGroupConfig[]
}

// App 壳与场景组件之间的通信接口
export interface SceneState {
  currentTool: ToolType
  tools: ToolType[]
  strokeCount: number
  rendererName: string
  zoomLevel: number
  canUndo: boolean
  canRedo: boolean
}

export interface SceneActions {
  setTool: (tool: ToolType) => void
  undo: () => void
  redo: () => void
  clear: () => void
  zoomIn: () => void
  zoomOut: () => void
  exportPNG: () => void
  exportJSON: () => void
  importJSON: (file: File) => void
}
```

- [ ] **Step 3: 提交**

```bash
git add playground/app/package.json playground/app/src/types.ts pnpm-lock.yaml
git commit -m "chore: 安装 vue-router 并创建 playground 类型定义"
```

### Task 2: 创建场景配置和注册表

**Files:**
- Create: `playground/app/src/scenes/basic/config.ts`
- Create: `playground/app/src/scenes/recognition/config.ts`
- Create: `playground/app/src/scenes/index.ts`

- [ ] **Step 1: 创建基础场景配置**

创建 `playground/app/src/scenes/basic/config.ts`：

```ts
import type { SceneConfig } from '../../types'

export const basicScene: SceneConfig = {
  name: '基础使用',
  path: '/basic',
  component: () => import('./BasicScene.vue'),
  tools: ['pen', 'marker', 'pencil', 'eraser'],
  panels: ['style', 'brush', 'zoom', 'playback']
}
```

- [ ] **Step 2: 创建识别场景配置**

创建 `playground/app/src/scenes/recognition/config.ts`：

```ts
import type { SceneConfig } from '../../types'

export const recognitionScene: SceneConfig = {
  name: '识别调试',
  path: '/recognition',
  component: () => import('./RecognitionScene.vue'),
  tools: ['pen', 'pencil', 'eraser'],
  panels: ['style', 'brush']
}
```

- [ ] **Step 3: 创建场景注册表**

创建 `playground/app/src/scenes/index.ts`：

```ts
import type { SceneConfig } from '../types'
import { basicScene } from './basic/config'
import { recognitionScene } from './recognition/config'

export const scenes: SceneConfig[] = [
  basicScene,
  recognitionScene
]
```

- [ ] **Step 4: 提交**

```bash
git add playground/app/src/scenes/
git commit -m "feat: 创建场景配置和注册表"
```

### Task 3: 创建路由配置并更新入口

**Files:**
- Create: `playground/app/src/router.ts`
- Modify: `playground/app/src/main.ts`

- [ ] **Step 1: 创建路由配置**

创建 `playground/app/src/router.ts`：

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import { scenes } from './scenes'

const routes = [
  { path: '/', redirect: scenes[0].path },
  ...scenes.map(scene => ({
    path: scene.path,
    name: scene.path.slice(1),
    component: scene.component
  }))
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
```

注意：使用 hash 模式，因为 playground 以 `base: "./"` 部署，hash 模式不依赖服务器配置。

- [ ] **Step 2: 更新 main.ts 注册路由**

修改 `playground/app/src/main.ts`：

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).mount('#app')
```

- [ ] **Step 3: 提交**

```bash
git add playground/app/src/router.ts playground/app/src/main.ts
git commit -m "feat: 创建路由配置并注册到应用入口"
```

---

## Chunk 2: Composable 重构

### Task 4: 拆分 useEditor（共享）和 useBasicEditor（场景专属）

**Files:**
- Modify: `playground/app/src/composables/useEditor.ts` — 重写为共享 composable
- Create: `playground/app/src/scenes/basic/useBasicEditor.ts` — 基础场景专属逻辑

**重构要点：**

`useEditor.ts`（共享）保留：
- Inker 实例生命周期（initEditor、dispose）
- 通用操作（undo、redo、clear）
- 缩放操作（zoomIn、zoomOut、zoomToFit、zoomReset）
- 平移控制（togglePanMode）
- 通用状态（editor、strokeCount、zoomLevel、panModeActive、canUndo、canRedo）
- 回放操作（playbackStart、playbackPause、playbackStop、setPlaybackSpeed + 相关状态）
- 导出操作（exportPNG、exportJSON、importJSON）
- styleParams 的同步机制（syncStyle、watch）
- 事件监听器绑定（wheel、keyboard、pointer for pan）

`useBasicEditor.ts`（场景专属）保留：
- toolPresets（工具预设参数映射）
- OFFICIAL_DEFAULTS
- currentTool 状态
- setTool()（切换工具 + 应用预设参数）
- resetParams()
- applyOfficialDefaults()

- [ ] **Step 1: 重写 useEditor.ts 为共享 composable**

重写 `playground/app/src/composables/useEditor.ts`，移除 toolPresets、OFFICIAL_DEFAULTS、currentTool、setTool、resetParams、applyOfficialDefaults，这些属于基础场景专属逻辑。保留所有其他功能。useEditor 接受 styleParams 作为参数（由场景传入），而不是内部创建。

关键接口变化：

```ts
import type { StyleParams } from '../types'

// useEditor 接收 styleParams（reactive 对象）和 toolType（ref，用于 syncStyle 区分橡皮擦）
export function useEditor(styleParams: StyleParams, toolType: Ref<string>) {
  // syncStyle 内部通过 toolType.value === 'eraser' 区分笔画类型
  // canUndo/canRedo 通过监听 editor 的 document:changed 事件同步更新
  const canUndo = ref(false)
  const canRedo = ref(false)
  // 在 initEditor 中绑定事件：
  // editor.on('document:changed', () => { canUndo.value = editor.canUndo; canRedo.value = editor.canRedo })

  return {
    editor, strokeCount, zoomLevel, panModeActive,
    canUndo, canRedo,
    initEditor, dispose,
    undo, redo, clear,
    zoomIn, zoomOut, zoomToFit, zoomReset, togglePanMode,
    isPlaying, isPaused, playbackProgress, playbackSpeed,
    playbackStart, playbackPause, playbackStop, setPlaybackSpeed,
    exportPNG, exportJSON, importJSON
  }
}
```

- [ ] **Step 2: 创建 useBasicEditor.ts**

创建 `playground/app/src/scenes/basic/useBasicEditor.ts`：

```ts
import { ref, reactive } from 'vue'
import { useEditor } from '../../composables/useEditor'
import type { ToolType } from '../../types'

const toolPresets: Record<ToolType, { color: string; size: number; opacity: number }> = {
  pen: { color: '#000000', size: 2, opacity: 1 },
  marker: { color: '#ff6600', size: 12, opacity: 0.6 },
  pencil: { color: '#333333', size: 1, opacity: 0.8 },
  eraser: { color: '#ffffff', size: 20, opacity: 1 }
}

const OFFICIAL_DEFAULTS = {
  size: 16, thinning: 0.5, smoothing: 0.5, streamline: 0.5,
  easing: 'linear' as const, simulatePressure: true,
  taperStart: 0, capStart: true, taperEnd: 0, capEnd: true
}

export function useBasicEditor() {
  const currentTool = ref<ToolType>('pen')

  const styleParams = reactive({
    color: '#000000', size: 2, opacity: 1,
    thinning: 0.5, smoothing: 0.5, streamline: 0.5,
    easing: 'linear' as string,
    simulatePressure: true,
    taperStart: 0, capStart: true, taperEnd: 0, capEnd: true
  })

  const editorApi = useEditor(styleParams, currentTool)

  function setTool(tool: ToolType) {
    currentTool.value = tool
    const preset = toolPresets[tool]
    styleParams.color = preset.color
    styleParams.size = preset.size
    styleParams.opacity = preset.opacity
    if (editorApi.editor.value) {
      editorApi.editor.value.penStyle = {
        color: preset.color, size: preset.size, opacity: preset.opacity,
        easing: styleParams.easing, thinning: styleParams.thinning,
        smoothing: styleParams.smoothing, streamline: styleParams.streamline,
        simulatePressure: styleParams.simulatePressure,
        taperStart: styleParams.taperStart, capStart: styleParams.capStart,
        taperEnd: styleParams.taperEnd, capEnd: styleParams.capEnd
      }
    }
  }

  function resetParams() {
    const preset = toolPresets[currentTool.value]
    styleParams.color = preset.color
    styleParams.size = preset.size
    styleParams.opacity = preset.opacity
    styleParams.thinning = 0.5
    styleParams.smoothing = 0.5
    styleParams.streamline = 0.5
    styleParams.easing = 'linear'
    styleParams.simulatePressure = true
    styleParams.taperStart = 0
    styleParams.capStart = true
    styleParams.taperEnd = 0
    styleParams.capEnd = true
  }

  function applyOfficialDefaults() {
    Object.assign(styleParams, OFFICIAL_DEFAULTS)
  }

  return {
    ...editorApi,
    currentTool, styleParams,
    setTool, resetParams, applyOfficialDefaults
  }
}
```

- [ ] **Step 3: 验证类型检查**

```bash
cd playground/app && npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add playground/app/src/composables/useEditor.ts playground/app/src/scenes/basic/useBasicEditor.ts
git commit -m "refactor: 拆分 useEditor 为共享 composable + 场景专属 useBasicEditor"
```

---

## Chunk 3: 壳布局组件（TopBar + StatusBar + App.vue）

### Task 5: 创建 TopBar 组件

**Files:**
- Create: `playground/app/src/components/TopBar.vue`

- [ ] **Step 1: 创建 TopBar.vue**

```vue
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
```

- [ ] **Step 2: 提交**

```bash
git add playground/app/src/components/TopBar.vue
git commit -m "feat: 创建 TopBar 组件（标题 + 场景选择 + 工具组）"
```

### Task 6: 重写 StatusBar 组件

**Files:**
- Modify: `playground/app/src/components/StatusBar.vue`

- [ ] **Step 1: 重写 StatusBar.vue**

```vue
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
```

- [ ] **Step 2: 提交**

```bash
git add playground/app/src/components/StatusBar.vue
git commit -m "feat: 重写 StatusBar（撤销/恢复/清空 + 导出 + 缩放控制）"
```

### Task 7: 重写 App.vue 壳布局

**Files:**
- Modify: `playground/app/src/App.vue`

- [ ] **Step 1: 重写 App.vue**

App.vue 改为壳布局：TopBar + `<router-view>` + StatusBar。不再直接引用编辑器逻辑，状态通过 provide/inject 或 props 从场景组件传递。

由于 TopBar 和 StatusBar 需要访问当前场景的编辑器状态（currentTool、strokeCount 等），而编辑器实例在场景组件中创建，采用以下方案：

**方案：场景通过 provide 暴露状态，App.vue 通过 inject 获取**

App.vue 提供一个注册机制，场景组件 mount 时注册自己的状态，unmount 时注销。

```vue
<script setup lang="ts">
import { reactive, ref, provide } from 'vue'
import TopBar from './components/TopBar.vue'
import StatusBar from './components/StatusBar.vue'
import type { SceneState, SceneActions, ToolType } from './types'

// 场景通过 inject('sceneState') 获取此 reactive 对象并直接修改其属性
// 这样 App 壳自动感知场景状态变化（无需 re-register）
const sceneState = reactive<SceneState>({
  currentTool: 'pen',
  tools: ['pen', 'marker', 'pencil', 'eraser'],
  strokeCount: 0,
  rendererName: 'Canvas 2D',
  zoomLevel: 1,
  canUndo: false,
  canRedo: false
})

// 场景操作回调（场景 mount 时注册，unmount 时清空）
const sceneActions = ref<Partial<SceneActions>>({})

function registerActions(actions: Partial<SceneActions>) {
  sceneActions.value = actions
}

function unregisterActions() {
  sceneActions.value = {}
}

provide('sceneState', sceneState)
provide('registerActions', registerActions)
provide('unregisterActions', unregisterActions)

function callAction<K extends keyof SceneActions>(name: K, ...args: Parameters<SceneActions[K]>) {
  const fn = sceneActions.value[name]
  if (fn) (fn as any)(...args)
}
</script>

<template>
  <div class="app-shell">
    <TopBar
      :tools="sceneState.tools"
      :current-tool="sceneState.currentTool"
      @set-tool="callAction('setTool', $event)"
    />
    <main class="canvas-area">
      <router-view />
    </main>
    <StatusBar
      :stroke-count="sceneState.strokeCount"
      :renderer-name="sceneState.rendererName"
      :zoom-level="sceneState.zoomLevel"
      :can-undo="sceneState.canUndo"
      :can-redo="sceneState.canRedo"
      @undo="callAction('undo')"
      @redo="callAction('redo')"
      @clear="callAction('clear')"
      @export-p-n-g="callAction('exportPNG')"
      @export-j-s-o-n="callAction('exportJSON')"
      @import-j-s-o-n="callAction('importJSON', $event)"
      @zoom-in="callAction('zoomIn')"
      @zoom-out="callAction('zoomOut')"
    />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>

<style scoped>
.app-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #fff;
}
</style>
```

**响应式方案说明：** `sceneState` 是 App 层级的 reactive 对象，场景组件 mount 时通过 `inject('sceneState')` 获取同一个引用，直接修改其属性（如 `sceneState.strokeCount = xxx`），App 壳自动感知变化。场景操作回调通过 `inject('registerActions')` 注册，`inject('unregisterActions')` 在 unmount 时清空。

- [ ] **Step 2: 验证开发服务器启动**

```bash
cd playground/app && pnpm dev
```

此时页面应显示顶栏和底部状态栏，中间为空白画布区域（场景组件尚未创建，路由会报 warning）。

- [ ] **Step 3: 提交**

```bash
git add playground/app/src/App.vue
git commit -m "feat: 重写 App.vue 为壳布局（TopBar + router-view + StatusBar）"
```

---

## Chunk 4: 浮动面板

### Task 8: 创建 useDraggable composable

**Files:**
- Create: `playground/app/src/composables/useDraggable.ts`

- [ ] **Step 1: 创建 useDraggable.ts**

```ts
import { ref, onUnmounted } from 'vue'

export function useDraggable(initialX = 0, initialY = 0) {
  const x = ref(initialX)
  const y = ref(initialY)
  const isDragging = ref(false)

  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0

  function onPointerDown(e: PointerEvent) {
    isDragging.value = true
    startX = e.clientX
    startY = e.clientY
    startLeft = x.value
    startTop = y.value
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging.value) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    x.value = Math.max(0, startLeft + dx)
    y.value = Math.max(0, startTop + dy)

    // 限制不超出窗口右下边界（留 100px 最小可见区域）
    x.value = Math.min(x.value, window.innerWidth - 100)
    y.value = Math.min(y.value, window.innerHeight - 100)
  }

  function onPointerUp() {
    isDragging.value = false
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  }

  onUnmounted(() => {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  })

  return { x, y, isDragging, onPointerDown }
}
```

- [ ] **Step 2: 提交**

```bash
git add playground/app/src/composables/useDraggable.ts
git commit -m "feat: 创建 useDraggable composable 支持面板拖拽"
```

### Task 9: 创建 FloatingPanel 组件

**Files:**
- Create: `playground/app/src/components/FloatingPanel.vue`

- [ ] **Step 1: 创建 FloatingPanel.vue**

FloatingPanel 接收 panels 配置（哪些分组要显示），使用插槽渲染各分组内容。支持拖拽、折叠、手风琴展开/收起。

```vue
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
  playback: '回放'
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
  window.innerWidth - 230,
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
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
  user-select: none;
}
.panel-toggle:hover {
  background: #f5f5f5;
}
.floating-panel {
  position: absolute;
  width: 210px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  font-size: 12px;
  overflow: hidden;
  z-index: 100;
  user-select: none;
}
.panel-header {
  padding: 8px 12px;
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
  font-size: 12px;
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
  font-size: 14px;
  padding: 0 2px;
}
.panel-action:hover {
  color: #333;
}
.panel-body {
  max-height: 60vh;
  overflow-y: auto;
}
.accordion-item {
  border-bottom: 1px solid #f0f0f0;
}
.accordion-item:last-child {
  border-bottom: none;
}
.accordion-header {
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 500;
  color: #333;
  background: #fafafa;
}
.accordion-header:hover {
  background: #f0f0f0;
}
.accordion-content {
  padding: 10px 12px;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add playground/app/src/components/FloatingPanel.vue
git commit -m "feat: 创建 FloatingPanel 浮动手风琴面板组件"
```

---

## Chunk 5: 基础场景 + 渲染器切换

### Task 10: 重写 RendererTabs 组件

**Files:**
- Modify: `playground/app/src/components/RendererTabs.vue`

- [ ] **Step 1: 重写 RendererTabs.vue**

改为 pill 样式，居中浮动在画布上方，包含对比模式切换按钮。

```vue
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
```

- [ ] **Step 2: 提交**

```bash
git add playground/app/src/components/RendererTabs.vue
git commit -m "feat: 重写 RendererTabs 为 pill 样式 + 对比模式切换"
```

### Task 11: 创建 BasicScene 场景组件

**Files:**
- Create: `playground/app/src/scenes/basic/BasicScene.vue`

- [ ] **Step 1: 创建 BasicScene.vue**

BasicScene 是基础使用场景的根组件。它负责：
- 调用 useBasicEditor 获取编辑器状态和操作
- 挂载编辑器到画布容器
- 渲染 RendererTabs + FloatingPanel
- 通过 inject('registerScene') 将状态和操作注册到 App 壳

FloatingPanel 的各手风琴分组内容通过插槽传入，复用现有的 StylePanel、FreehandPanel、ZoomPanel、PlaybackPanel 组件（可能需要微调样式使其适配面板内的紧凑布局）。

```vue
<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted, watchEffect } from 'vue'
import { useBasicEditor } from './useBasicEditor'
import RendererTabs from '../../components/RendererTabs.vue'
import FloatingPanel from '../../components/FloatingPanel.vue'
import StylePanel from '../../components/StylePanel.vue'
import FreehandPanel from '../../components/FreehandPanel.vue'
import ZoomPanel from '../../components/ZoomPanel.vue'
import PlaybackPanel from '../../components/PlaybackPanel.vue'
import { basicScene } from './config'

const containerRef = ref<HTMLElement>()
const activeRenderer = ref('canvas')
const compareMode = ref(false)

const {
  editor, currentTool, styleParams,
  strokeCount, zoomLevel, panModeActive, canUndo, canRedo,
  initEditor, dispose, setTool, resetParams, applyOfficialDefaults,
  undo, redo, clear,
  zoomIn, zoomOut, zoomToFit, zoomReset, togglePanMode,
  isPlaying, isPaused, playbackProgress, playbackSpeed,
  playbackStart, playbackPause, playbackStop, setPlaybackSpeed,
  exportPNG, exportJSON, importJSON
} = useBasicEditor()

// 注册场景状态和操作到 App 壳
import type { SceneState, SceneActions } from '../../types'
const sceneState = inject<SceneState>('sceneState')!
const registerActions = inject<(actions: Partial<SceneActions>) => void>('registerActions')!
const unregisterActions = inject<() => void>('unregisterActions')!

// 同步状态到 App 壳的 reactive 对象
watchEffect(() => {
  sceneState.currentTool = currentTool.value
  sceneState.tools = basicScene.tools || []
  sceneState.strokeCount = strokeCount.value
  sceneState.rendererName = compareMode.value ? '对比模式' : activeRenderer.value === 'canvas' ? 'Canvas 2D' : activeRenderer.value === 'svg' ? 'SVG' : 'OffscreenCanvas'
  sceneState.zoomLevel = zoomLevel.value
  sceneState.canUndo = canUndo.value
  sceneState.canRedo = canRedo.value
})

onMounted(() => {
  if (containerRef.value) {
    initEditor(containerRef.value)
  }
  registerActions({
    setTool, undo, redo, clear,
    zoomIn, zoomOut,
    exportPNG, exportJSON, importJSON
  })
})

onUnmounted(() => {
  unregisterActions()
  dispose()
})
</script>

<template>
  <div class="basic-scene">
    <div ref="containerRef" class="editor-container" />

    <RendererTabs
      v-model:active-renderer="activeRenderer"
      v-model:compare-mode="compareMode"
    />

    <FloatingPanel
      :panels="basicScene.panels || []"
    >
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
          :easing="styleParams.easing"
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
          @apply-official-defaults="applyOfficialDefaults"
        />
      </template>

      <template #zoom>
        <ZoomPanel
          :zoom-level="zoomLevel"
          :pan-mode-active="panModeActive"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @zoom-to-fit="zoomToFit"
          @zoom-reset="zoomReset"
          @toggle-pan-mode="togglePanMode"
        />
      </template>

      <template #playback>
        <PlaybackPanel
          :is-playing="isPlaying"
          :is-paused="isPaused"
          :progress="playbackProgress"
          :speed="playbackSpeed"
          @play="playbackStart"
          @pause="playbackPause"
          @stop="playbackStop"
          @set-speed="setPlaybackSpeed"
        />
      </template>
    </FloatingPanel>
  </div>
</template>

<style scoped>
.basic-scene {
  width: 100%;
  height: 100%;
  position: relative;
}
.editor-container {
  width: 100%;
  height: 100%;
}
</style>
```

- [ ] **Step 2: 验证基础场景可运行**

```bash
cd playground/app && pnpm dev
```

访问 http://localhost:3000/#/basic，应能看到完整的编辑器界面：顶栏工具、画布、浮动面板、底部状态栏。

- [ ] **Step 3: 提交**

```bash
git add playground/app/src/scenes/basic/BasicScene.vue
git commit -m "feat: 创建基础使用场景组件"
```

---

## Chunk 6: 识别场景 + 收尾

### Task 12: 创建识别调试场景占位组件

**Files:**
- Create: `playground/app/src/scenes/recognition/RecognitionScene.vue`

- [ ] **Step 1: 创建 RecognitionScene.vue**

识别场景的最小占位实现，使用共享 useEditor，画布可用但无识别专属功能。

```vue
<script setup lang="ts">
import { ref, reactive, inject, onMounted, onUnmounted, watchEffect } from 'vue'
import { useEditor } from '../../composables/useEditor'
import RendererTabs from '../../components/RendererTabs.vue'
import FloatingPanel from '../../components/FloatingPanel.vue'
import StylePanel from '../../components/StylePanel.vue'
import FreehandPanel from '../../components/FreehandPanel.vue'
import { recognitionScene } from './config'
import type { ToolType } from '../../types'

const containerRef = ref<HTMLElement>()
const activeRenderer = ref('canvas')
const compareMode = ref(false)
const currentTool = ref<ToolType>('pen')

const styleParams = reactive({
  color: '#000000', size: 2, opacity: 1,
  thinning: 0.5, smoothing: 0.5, streamline: 0.5,
  easing: 'linear' as string,
  simulatePressure: true,
  taperStart: 0, capStart: true, taperEnd: 0, capEnd: true
})

const {
  editor, strokeCount, zoomLevel, panModeActive, canUndo, canRedo,
  initEditor, dispose, undo, redo, clear,
  zoomIn, zoomOut, zoomToFit, zoomReset, togglePanMode,
  exportPNG, exportJSON, importJSON,
  isPlaying, isPaused, playbackProgress, playbackSpeed,
  playbackStart, playbackPause, playbackStop, setPlaybackSpeed
} = useEditor(styleParams, currentTool)

const toolPresets: Record<string, { color: string; size: number; opacity: number }> = {
  pen: { color: '#000000', size: 2, opacity: 1 },
  pencil: { color: '#333333', size: 1, opacity: 0.8 },
  eraser: { color: '#ffffff', size: 20, opacity: 1 }
}

function setTool(tool: ToolType) {
  currentTool.value = tool
  const preset = toolPresets[tool]
  if (preset) {
    styleParams.color = preset.color
    styleParams.size = preset.size
    styleParams.opacity = preset.opacity
  }
}

import type { SceneState, SceneActions } from '../../types'
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
    setTool, undo, redo, clear,
    zoomIn, zoomOut,
    exportPNG, exportJSON, importJSON
  })
})

onUnmounted(() => {
  unregisterActions()
  dispose()
})
</script>

<template>
  <div class="recognition-scene">
    <div ref="containerRef" class="editor-container" />

    <RendererTabs
      v-model:active-renderer="activeRenderer"
      v-model:compare-mode="compareMode"
    />

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
          :easing="styleParams.easing"
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
    </FloatingPanel>

    <!-- 识别专属 UI（后续扩展） -->
    <div class="recognition-placeholder">
      <p>识别调试功能开发中...</p>
    </div>
  </div>
</template>

<style scoped>
.recognition-scene {
  width: 100%;
  height: 100%;
  position: relative;
}
.editor-container {
  width: 100%;
  height: 100%;
}
.recognition-placeholder {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 243, 205, 0.9);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  color: #856404;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add playground/app/src/scenes/recognition/RecognitionScene.vue
git commit -m "feat: 创建识别调试场景占位组件"
```

### Task 13: 清理旧组件 + 调整现有面板组件样式

**Files:**
- Delete: `playground/app/src/components/EditorCanvas.vue`
- Delete: `playground/app/src/components/ToolBar.vue`
- Delete: `playground/app/src/components/ExportPanel.vue`
- Modify: `playground/app/src/components/StylePanel.vue` — 移除外层标题和边距，适配面板内紧凑布局
- Modify: `playground/app/src/components/FreehandPanel.vue` — 同上
- Modify: `playground/app/src/components/ZoomPanel.vue` — 同上
- Modify: `playground/app/src/components/PlaybackPanel.vue` — 同上

- [ ] **Step 1: 删除不再需要的组件**

```bash
cd playground/app
rm src/components/EditorCanvas.vue
rm src/components/ToolBar.vue
rm src/components/ExportPanel.vue
```

- [ ] **Step 2: 调整面板组件样式**

StylePanel、FreehandPanel、ZoomPanel、PlaybackPanel 原本有 section-title 和外层 margin，这些在 FloatingPanel 手风琴内不需要了。移除各组件中的：
- 外层容器的 margin/padding（由 FloatingPanel 的 accordion-content 统一提供）
- section-title 标题（由 FloatingPanel 的 accordion-header 替代）

保留组件内部的实际控件内容和交互逻辑不变。

- [ ] **Step 3: 验证完整功能**

```bash
cd playground/app && pnpm dev
```

验证：
1. 访问 /#/basic — 画布可绘制，工具切换正常，浮动面板可展开/折叠/拖拽
2. 访问 /#/recognition — 画布可绘制，顶栏工具正确反映识别场景的 tools
3. 顶栏场景下拉切换可正常路由
4. 底部状态栏撤销/恢复/导出/缩放功能正常

- [ ] **Step 4: 提交**

```bash
git add -A playground/app/src/
git commit -m "refactor: 清理旧组件，调整面板组件适配浮动面板"
```

### Task 14: 更新文档

**Files:**
- Modify: `playground/app/README.md`

- [ ] **Step 1: 更新 playground README**

更新 README 反映新的目录结构、场景注册机制、新增场景的步骤。

- [ ] **Step 2: 提交**

```bash
git add playground/app/README.md
git commit -m "docs: 更新 playground README 反映重构后的架构"
```
