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
