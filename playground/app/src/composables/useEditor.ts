import { ref, watch, type Ref } from 'vue'
import { Inker } from '@inker/sdk'
import { StrokePlayer } from '@inker/playback'
import { operationsToJSON, jsonToOperations } from '@inker/model'
import type { StrokeStyle, Operation, EasingType } from '@inker/types'
import type { StyleParams } from '../types'

/** 缩放范围 */
const MIN_ZOOM = 0.1
const MAX_ZOOM = 10

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 共享编辑器 composable
 * 管理 Inker 实例生命周期、通用操作、缩放、平移、回放、导出等
 * @param styleParams 样式参数（reactive 对象，由场景传入）
 * @param toolType 当前工具类型（ref，用于 syncStyle 区分橡皮擦）
 */
export function useEditor(styleParams: StyleParams, toolType: Ref<string>) {
  const editor: Ref<Inker | null> = ref(null)
  const strokeCount = ref(0)
  const zoomLevel = ref(1)
  /** 平移模式（按钮切换） */
  const panModeActive = ref(false)
  /** 撤销可用状态 */
  const canUndo = ref(false)
  /** 重做可用状态 */
  const canRedo = ref(false)

  // ResizeObserver 引用
  let resizeObserver: ResizeObserver | null = null
  // 空格键临时平移
  let spaceHeld = false
  // 是否正在拖拽平移
  let isPanning = false
  // 容器引用，用于获取画布中心
  let containerEl: HTMLElement | null = null

  /** 当前是否处于平移状态（按钮模式或空格临时模式） */
  function isPanActive(): boolean {
    return panModeActive.value || spaceHeld
  }

  /** 初始化编辑器，挂载到指定容器 */
  function initEditor(container: HTMLElement) {
    containerEl = container
    if (editor.value) {
      editor.value.dispose()
    }
    editor.value = Inker.create({ element: container })
    editor.value.on('document:changed', () => {
      strokeCount.value = editor.value?.strokeCount ?? 0
      canUndo.value = editor.value?.canUndo ?? false
      canRedo.value = editor.value?.canRedo ?? false
      // 非回放期间用户修改了文档，使回放缓存失效
      if (!isPlaying.value && !isPaused.value) {
        cachedPlaybackOps = null
      }
    })
    syncStyle()

    // ResizeObserver 接入
    resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        editor.value?.resize(width, height)
      }
    })
    resizeObserver.observe(container)

    // 滚轮缩放
    container.addEventListener('wheel', handleWheel, { passive: false })

    // 在 capture 阶段拦截指针事件，平移模式时阻止编辑器接收
    container.addEventListener('pointerdown', handlePanPointerDown, true)
    container.addEventListener('pointermove', handlePanPointerMove, true)
    container.addEventListener('pointerup', handlePanPointerUp, true)

    // 空格键临时平移
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    if (!editor.value) return
    const currentZoom = editor.value.camera.zoom
    const newZoom = clamp(currentZoom * (1 - e.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM)
    editor.value.zoomAt(e.offsetX, e.offsetY, newZoom)
    zoomLevel.value = editor.value.camera.zoom
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault()
      spaceHeld = true
      updateCursor()
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      spaceHeld = false
      isPanning = false
      updateCursor()
    }
  }

  /** capture 阶段拦截 pointerdown — 平移模式时吞掉事件 */
  function handlePanPointerDown(e: PointerEvent) {
    if (!isPanActive() || !editor.value) return
    e.stopPropagation()
    e.preventDefault()
    isPanning = true
    updateCursor()
  }

  /** capture 阶段拦截 pointermove — 平移模式拖拽 */
  function handlePanPointerMove(e: PointerEvent) {
    if (!isPanning || !editor.value) return
    e.stopPropagation()
    e.preventDefault()
    editor.value.pan(e.movementX, e.movementY)
  }

  /** capture 阶段拦截 pointerup — 结束拖拽 */
  function handlePanPointerUp(e: PointerEvent) {
    if (!isPanning) return
    e.stopPropagation()
    e.preventDefault()
    isPanning = false
    updateCursor()
  }

  /** 切换平移模式 */
  function togglePanMode() {
    panModeActive.value = !panModeActive.value
    isPanning = false
    updateCursor()
  }

  /** 根据平移状态更新光标 */
  function updateCursor() {
    if (!containerEl) return
    if (isPanning) {
      containerEl.style.cursor = 'grabbing'
    } else if (isPanActive()) {
      containerEl.style.cursor = 'grab'
    } else {
      containerEl.style.cursor = 'crosshair'
    }
  }

  /** 同步 styleParams 到编辑器 */
  function syncStyle() {
    if (!editor.value) return
    editor.value.penStyle = {
      type: toolType.value === 'eraser' ? 'eraser' : toolType.value,
      color: styleParams.color,
      size: styleParams.size,
      opacity: styleParams.opacity,
      thinning: styleParams.thinning,
      smoothing: styleParams.smoothing,
      streamline: styleParams.streamline,
      easing: styleParams.easing as EasingType,
      simulatePressure: styleParams.simulatePressure,
      start: { taper: styleParams.taperStart, cap: styleParams.capStart },
      end: { taper: styleParams.taperEnd, cap: styleParams.capEnd }
    } as StrokeStyle
  }

  // 监听参数变化自动同步
  watch(() => ({ ...styleParams }), () => syncStyle(), { deep: true })

  function undo() { editor.value?.undo() }
  function redo() { editor.value?.redo() }
  function clear() { editor.value?.clear() }

  function zoomToFit() {
    editor.value?.zoomToFit()
    if (editor.value) zoomLevel.value = editor.value.camera.zoom
  }

  /** 以画布中心为锚点放大 */
  function zoomIn() {
    if (!editor.value || !containerEl) return
    const cx = containerEl.clientWidth / 2
    const cy = containerEl.clientHeight / 2
    const newZoom = clamp(editor.value.camera.zoom * 1.2, MIN_ZOOM, MAX_ZOOM)
    editor.value.zoomAt(cx, cy, newZoom)
    zoomLevel.value = editor.value.camera.zoom
  }

  /** 以画布中心为锚点缩小 */
  function zoomOut() {
    if (!editor.value || !containerEl) return
    const cx = containerEl.clientWidth / 2
    const cy = containerEl.clientHeight / 2
    const newZoom = clamp(editor.value.camera.zoom * 0.8, MIN_ZOOM, MAX_ZOOM)
    editor.value.zoomAt(cx, cy, newZoom)
    zoomLevel.value = editor.value.camera.zoom
  }

  /** 重置缩放到 100% */
  function zoomReset() {
    if (!editor.value) return
    editor.value.setCamera({ x: 0, y: 0, zoom: 1 })
    zoomLevel.value = 1
  }

  // 回放状态
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const playbackProgress = ref(0)
  const playbackSpeed = ref(1)
  let player: StrokePlayer | null = null
  let progressTimer: ReturnType<typeof setInterval> | null = null
  /**
   * 回放操作序列缓存
   * 首次回放时快照原始 ops，防止 applyOperation 将回放操作写回 document
   * 导致下次 getOperations() 返回翻倍的 ops
   * 用户新增笔画（document:changed 且非回放中）时自动失效
   */
  let cachedPlaybackOps: Operation[] | null = null

  /** 开始回放 */
  function playbackStart() {
    if (!editor.value) return

    // 首次回放时缓存原始 ops；后续重播直接复用缓存，避免累积
    if (!cachedPlaybackOps) {
      const rawOps = [...editor.value.getOperations()] as Operation[]
      if (rawOps.length === 0) return
      cachedPlaybackOps = rawOps
    }
    const ops = cachedPlaybackOps
    if (ops.length === 0) return

    // 先标记回放中，防止 clear() 触发 document:changed 时意外清除缓存
    isPlaying.value = true
    playbackProgress.value = 0

    // 清空画布，准备回放
    editor.value.clear()

    player = new StrokePlayer(ops, { speed: playbackSpeed.value })
    player.onOperation = op => {
      editor.value?.applyOperation(op)
    }
    player.onFinish = () => {
      isPlaying.value = false
      stopProgressSync()
    }

    player.play()
    startProgressSync()
  }

  /** 暂停/恢复回放 */
  function playbackPause() {
    if (!player) return
    if (player.state === 'playing') {
      player.pause()
      isPlaying.value = false
      isPaused.value = true
      stopProgressSync()
    } else if (player.state === 'paused') {
      player.resume()
      isPlaying.value = true
      isPaused.value = false
      startProgressSync()
    }
  }

  /** 停止回放 */
  function playbackStop() {
    if (player) {
      player.stop()
      player.dispose()
      player = null
    }
    isPlaying.value = false
    isPaused.value = false
    playbackProgress.value = 0
    stopProgressSync()
  }

  /** 设置回放速度 */
  function setPlaybackSpeed(speed: number) {
    playbackSpeed.value = speed
    if (player) {
      player.speed = speed
    }
  }

  /** 同步进度到响应式状态 */
  function startProgressSync() {
    stopProgressSync()
    progressTimer = setInterval(() => {
      if (player) {
        playbackProgress.value = player.progress
      }
    }, 50)
  }

  function stopProgressSync() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  }

  /** 导出 PNG */
  async function exportPNG() {
    if (!editor.value) return
    const blob = await editor.value.renderAdapter.exportAsBlob('png')
    downloadBlob(blob, 'drawing.png')
  }

  /** 导出 JSON */
  function exportJSON() {
    if (!editor.value) return
    const ops = editor.value.getOperations()
    // documentSize 取容器尺寸
    const size = { width: containerEl?.clientWidth ?? 800, height: containerEl?.clientHeight ?? 600 }
    const json = operationsToJSON(ops, size)
    const blob = new Blob([json], { type: 'application/json' })
    downloadBlob(blob, 'drawing.json')
  }

  /** 导入 JSON */
  function importJSON(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      if (!editor.value || typeof reader.result !== 'string') return
      const { operations } = jsonToOperations(reader.result)
      // 清空并重建
      editor.value.clear()
      for (const op of operations) {
        editor.value.applyOperation(op)
      }
    }
    reader.readAsText(file)
  }

  /** 浏览器下载 Blob */
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function dispose() {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (containerEl) {
      containerEl.removeEventListener('wheel', handleWheel)
      containerEl.removeEventListener('pointerdown', handlePanPointerDown, true)
      containerEl.removeEventListener('pointermove', handlePanPointerMove, true)
      containerEl.removeEventListener('pointerup', handlePanPointerUp, true)
    }
    containerEl = null
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    playbackStop()
    editor.value?.dispose()
    editor.value = null
  }

  return {
    editor,
    strokeCount,
    zoomLevel,
    panModeActive,
    canUndo,
    canRedo,
    initEditor,
    dispose,
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
  }
}
