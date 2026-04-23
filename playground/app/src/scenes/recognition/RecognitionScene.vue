<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted, watchEffect, computed } from 'vue'
import { computeBBox } from '@inker/util'
import { useRecognitionEditor } from './useRecognitionEditor'
import RecognitionDataPanel from './RecognitionDataPanel.vue'
import { recognitionScene } from './config'
import RendererTabs from '../../components/RendererTabs.vue'
import FloatingPanel from '../../components/FloatingPanel.vue'
import StylePanel from '../../components/StylePanel.vue'
import FreehandPanel from '../../components/FreehandPanel.vue'
import type { SceneState, SceneActions } from '../../types'
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
  gapMs,
  toBBoxOrigin,
  selectedFormat,
  autoMode,
  manualMode,
  groups,
  jsonResult,
  status,
  initEditor,
  dispose,
  setTool,
  undo,
  redo,
  manualExport,
  clearAll,
  exportPNG,
  exportJSON,
  importJSON,
  zoomIn,
  zoomOut
} = useRecognitionEditor()

// 分组高亮
const highlightedGroupIndex = ref<number | null>(null)

function onHighlightGroup(index: number) {
  highlightedGroupIndex.value = index >= 0 ? index : null
}

const highlightStyle = computed(() => {
  if (highlightedGroupIndex.value === null || !editor.value) return null
  const group = groups.value[highlightedGroupIndex.value]
  if (!group || group.strokes.length === 0) return null

  const cam = editor.value.camera
  const bbox = computeBBox(group.strokes)

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
    exportPNG, exportJSON, importJSON,
    zoomIn, zoomOut
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
          <div class="param-row">
            <label class="param-label">分组间隔 (ms)</label>
            <div class="param-controls">
              <input type="range" v-model.number="gapMs" min="100" max="3000" step="100" class="param-slider" />
              <input type="number" v-model.number="gapMs" min="100" max="3000" step="100" class="param-number" />
            </div>
          </div>
          <div class="param-row">
            <label class="param-label">导出格式</label>
            <select v-model="selectedFormat" class="param-select">
              <option value="simple-json">Simple JSON</option>
            </select>
          </div>
          <div class="param-toggle">
            <label title="开启：计算笔画的包围盒，并将所有坐标平移到包围盒左上角为原点（0,0），输出中附带包围盒信息。关闭：保留原始画布坐标，不包含包围盒。">
              <input type="checkbox" v-model="toBBoxOrigin" />
              平移到包围盒原点
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
.param-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.param-label {
  font-size: 12px;
  color: #555;
  font-weight: 500;
}
.param-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.param-slider {
  flex: 1;
  height: 4px;
}
.param-number {
  width: 60px;
  padding: 2px 4px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 11px;
  text-align: center;
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
.param-select {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  color: #333;
  background: #fff;
}
</style>
