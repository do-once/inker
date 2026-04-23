<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted, watchEffect } from 'vue'
import type { SceneState, SceneActions } from '../../types'
import { useBasicEditor } from './useBasicEditor'
import { basicScene } from './config'
import RendererTabs from '../../components/RendererTabs.vue'
import FloatingPanel from '../../components/FloatingPanel.vue'
import StylePanel from '../../components/StylePanel.vue'
import FreehandPanel from '../../components/FreehandPanel.vue'
import ZoomPanel from '../../components/ZoomPanel.vue'
import PlaybackPanel from '../../components/PlaybackPanel.vue'
import type { EasingType } from '@inker/types'

const containerRef = ref<HTMLElement>()
const activeRenderer = ref('canvas')
const compareMode = ref(false)

const {
  currentTool,
  styleParams,
  strokeCount,
  zoomLevel,
  panModeActive,
  canUndo,
  canRedo,
  initEditor,
  dispose,
  setTool,
  applyOfficialDefaults,
  undo,
  redo,
  clear,
  zoomIn,
  zoomOut,
  zoomToFit,
  zoomReset,
  togglePanMode,
  isPlaying,
  isPaused,
  playbackProgress,
  playbackSpeed,
  playbackStart,
  playbackPause,
  playbackStop,
  setPlaybackSpeed,
  exportPNG,
  exportJSON,
  importJSON
} = useBasicEditor()

// 注册场景状态和操作到 App 壳
const sceneState = inject<SceneState>('sceneState')!
const registerActions = inject<(actions: Partial<SceneActions>) => void>('registerActions')!
const unregisterActions = inject<() => void>('unregisterActions')!

// 同步状态到 App 壳的 reactive 对象
watchEffect(() => {
  sceneState.currentTool = currentTool.value
  sceneState.tools = basicScene.tools || []
  sceneState.strokeCount = strokeCount.value
  sceneState.rendererName = compareMode.value
    ? '对比模式'
    : activeRenderer.value === 'canvas'
      ? 'Canvas 2D'
      : activeRenderer.value === 'svg'
        ? 'SVG'
        : 'OffscreenCanvas'
  sceneState.zoomLevel = zoomLevel.value
  sceneState.canUndo = canUndo.value
  sceneState.canRedo = canRedo.value
})

onMounted(() => {
  if (containerRef.value) {
    initEditor(containerRef.value)
  }
  registerActions({
    setTool,
    undo,
    redo,
    clear,
    zoomIn,
    zoomOut,
    exportPNG,
    exportJSON,
    importJSON
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

    <FloatingPanel :panels="basicScene.panels || []">
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
