# Playground

Inker SDK 的开发调试应用。基于 Vue 3 + Vue Router 4 + Vite，通过 pnpm workspace 直接链接到各包源码，Vite HMR 即时生效。

## 启动

```bash
pnpm dev
```

## 目录结构

```
src/
├── main.ts                    # 应用入口，注册路由
├── App.vue                    # 壳布局（TopBar + router-view + StatusBar）
├── router.ts                  # Vue Router 配置（Hash 模式）
├── types.ts                   # 类型定义（SceneConfig / SceneState / SceneActions 等）
├── scenes/                    # 场景目录
│   ├── index.ts               # 场景注册表
│   ├── basic/                 # 基础使用场景
│   │   ├── config.ts          # 场景配置（路径、工具列表、面板列表）
│   │   ├── BasicScene.vue     # 场景根组件
│   │   └── useBasicEditor.ts  # 场景专属 composable（工具预设、setTool 等）
│   └── recognition/           # 识别调试场景
│       ├── config.ts          # 场景配置
│       └── RecognitionScene.vue  # 场景根组件（占位）
├── composables/
│   ├── useEditor.ts           # 共享编辑器 composable（生命周期、缩放、回放、导出）
│   └── useDraggable.ts        # 浮动面板拖拽 composable
└── components/
    ├── TopBar.vue             # 顶栏（标题 + 场景选择 + 工具组）
    ├── StatusBar.vue          # 状态栏（撤销/重做/清空 + 导出 + 缩放）
    ├── FloatingPanel.vue      # 浮动手风琴面板（可拖拽、可折叠）
    ├── RendererTabs.vue       # 渲染器切换 pill（Canvas / SVG / Offscreen）
    ├── StylePanel.vue         # 样式面板（颜色 / 大小 / 透明度）
    ├── FreehandPanel.vue      # 笔刷参数面板（thinning / smoothing / taper 等）
    ├── ZoomPanel.vue          # 缩放与视口面板
    ├── PlaybackPanel.vue      # 回放控制面板
    └── SliderControl.vue      # 通用滑块控件
```

## 布局说明

```
┌─────────────────────────────────────────────┐
│ TopBar（40px）                               │
│  Inker  [场景选择▾]  | 钢笔 马克笔 铅笔 橡皮 │
├─────────────────────────────────────────────┤
│                                             │
│  canvas-area（flex:1）                       │
│                                             │
│  ┌─ RendererTabs（顶部居中浮动）────────┐    │
│  │  Canvas  SVG  Offscreen  |  ⊞ 对比   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│                          ┌─ FloatingPanel ─┐│
│  （编辑器画布）             │  参数面板    − ││
│                          │ ▾ 样式         ││
│                          │   ...          ││
│                          │ ▸ 笔刷参数     ││
│                          └────────────────┘│
├─────────────────────────────────────────────┤
│ StatusBar（28px）                            │
│  笔画:N  Canvas 2D  |  ↩撤销 ↪恢复 清空 |   │
│  导出PNG 导出JSON 导入JSON  |  − 100% +      │
└─────────────────────────────────────────────┘
```

## 场景列表

| 场景 | 路由 | 功能说明 |
|------|------|----------|
| 基础使用 | `/` | 钢笔、马克笔、铅笔、橡皮擦演示，支持样式调节、笔刷参数、缩放平移、回放、PNG/JSON 导入导出 |
| 识别调试 | `/recognition` | @inker/recognition 集成示例，支持自动/手动两种导出模式、分组概览、JSON 预览和数据操作 |

## 场景注册机制

App 壳通过 `provide/inject` 与场景组件通信：

- `provide('sceneState')` — 共享 reactive 状态对象，场景直接修改其属性
- `provide('registerActions')` — 场景 mount 时注册操作回调
- `provide('unregisterActions')` — 场景 unmount 时清空回调

场景组件通过 `inject` 获取上述注入，在 `watchEffect` 中同步状态，在 `onMounted` 中注册操作。

## 新增场景（三步）

**第一步：建目录并创建配置**

```ts
// src/scenes/my-scene/config.ts
import type { SceneConfig } from '../../types'

export const myScene: SceneConfig = {
  name: '我的场景',
  path: '/my-scene',
  component: () => import('./MyScene.vue'),
  tools: ['pen', 'eraser'],
  panels: ['style', 'brush']
}
```

**第二步：创建场景组件**

```vue
<!-- src/scenes/my-scene/MyScene.vue -->
<script setup lang="ts">
import { ref, reactive, inject, onMounted, onUnmounted, watchEffect } from 'vue'
import { useEditor } from '../../composables/useEditor'
import FloatingPanel from '../../components/FloatingPanel.vue'
import StylePanel from '../../components/StylePanel.vue'
import { myScene } from './config'
import type { ToolType, SceneState, SceneActions } from '../../types'

const containerRef = ref<HTMLElement>()
const currentTool = ref<ToolType>('pen')
const styleParams = reactive({ color: '#000000', size: 2, opacity: 1,
  thinning: 0.5, smoothing: 0.5, streamline: 0.5, easing: 'linear',
  simulatePressure: true, taperStart: 0, capStart: true, taperEnd: 0, capEnd: true })

const { strokeCount, zoomLevel, canUndo, canRedo,
  initEditor, dispose, undo, redo, clear, zoomIn, zoomOut,
  exportPNG, exportJSON, importJSON } = useEditor(styleParams, currentTool)

const sceneState = inject<SceneState>('sceneState')!
const registerActions = inject<(a: Partial<SceneActions>) => void>('registerActions')!
const unregisterActions = inject<() => void>('unregisterActions')!

watchEffect(() => {
  sceneState.currentTool = currentTool.value
  sceneState.tools = myScene.tools || []
  sceneState.strokeCount = strokeCount.value
  sceneState.rendererName = 'Canvas 2D'
  sceneState.zoomLevel = zoomLevel.value
  sceneState.canUndo = canUndo.value
  sceneState.canRedo = canRedo.value
})

function setTool(tool: ToolType) { currentTool.value = tool }

onMounted(() => {
  if (containerRef.value) initEditor(containerRef.value)
  registerActions({ setTool, undo, redo, clear, zoomIn, zoomOut,
    exportPNG, exportJSON, importJSON })
})
onUnmounted(() => { unregisterActions(); dispose() })
</script>

<template>
  <div style="width:100%;height:100%;position:relative">
    <div ref="containerRef" style="width:100%;height:100%" />
    <FloatingPanel :panels="myScene.panels || []">
      <template #style><StylePanel ... /></template>
    </FloatingPanel>
  </div>
</template>
```

**第三步：注册到场景列表**

```ts
// src/scenes/index.ts
import { myScene } from './my-scene/config'

export const scenes: SceneConfig[] = [
  basicScene,
  recognitionScene,
  myScene   // 添加这一行
]
```

## 核心组合式函数

### useEditor（共享）

管理 Inker 实例生命周期、通用操作、缩放、平移、回放、导出：

```typescript
export function useEditor(styleParams: StyleParams, toolType: Ref<string>) {
  return {
    editor, strokeCount, zoomLevel, panModeActive, canUndo, canRedo,
    initEditor, dispose,
    undo, redo, clear,
    zoomIn, zoomOut, zoomToFit, zoomReset, togglePanMode,
    isPlaying, isPaused, playbackProgress, playbackSpeed,
    playbackStart, playbackPause, playbackStop, setPlaybackSpeed,
    exportPNG, exportJSON, importJSON
  }
}
```

### useBasicEditor（场景专属）

在 `useEditor` 基础上添加工具预设管理：

```typescript
export function useBasicEditor() {
  // 内置 toolPresets（pen/marker/pencil/eraser 默认参数）
  return {
    ...editorApi,
    currentTool, styleParams,
    setTool, resetParams, applyOfficialDefaults
  }
}
```

## 交互操作

| 操作 | 方式 | 说明 |
|------|------|------|
| 绘制 | 鼠标/触摸/笔 | 按下 → 移动 → 抬起 |
| 缩放 | 鼠标滚轮 | 锚点缩放（鼠标下内容不移动） |
| 平移 | 空格 + 鼠标拖拽 | 按住空格进入平移模式 |
| 工具切换 | 顶栏工具按钮 | 场景决定可用工具列表 |
| 参数调整 | 浮动面板滑块 | 实时生效，支持拖拽移位 |
| 撤销/重做 | 底部状态栏按钮 | 粒度为完整笔画 |
| 导出 | 底部状态栏按钮 | PNG / JSON |
| 场景切换 | 顶栏下拉选择 | Vue Router Hash 模式路由 |
| 自适应 | 窗口 resize | ResizeObserver 自动触发 |

## 技术栈

- **Vue 3** + Composition API
- **Vue Router 4** + Hash 模式（无需服务器配置）
- **Vite** + HMR
- **@inker/sdk** 通过 `workspace:*` 链接源码
