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
