import { ref, reactive, watch } from 'vue'
import { useEditor } from '../../composables/useEditor'
import {
  RecognitionHelper,
  groupByTime,
  SimpleJsonFormat,
  type StrokeGroup
} from '@inker/recognition'
import type { ToolType } from '../../types'
import type { Stroke } from '@inker/types'

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
  const toBBoxOrigin = ref(true)
  const selectedFormat = ref('simple-json')

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

    const result = format.convert(allStrokes, { toBBoxOrigin: toBBoxOrigin.value })
    jsonResult.value = JSON.stringify(result, null, 2)
  }

  function bindHelper() {
    if (!editorApi.editor.value) return
    disposeHelper()

    helper = new RecognitionHelper({ gapMs: gapMs.value })
    helper.bindTo(editorApi.editor.value)

    unsubscribeHelper = helper.onWritingComplete(group => {
      if (!autoMode.value) return
      groups.value = [...groups.value, group]
      updateJsonResult()

      status.value = 'triggered'
      clearStatusTimers()
      triggeredTimer = setTimeout(() => {
        if (status.value === 'triggered') {
          status.value = 'idle'
        }
      }, 500)
    })
  }

  function disposeHelper() {
    unsubscribeHelper?.()
    unsubscribeHelper = null
    if (helper) {
      try { helper.dispose() } catch (e) { console.warn('RecognitionHelper dispose failed:', e) }
      helper = null
    }
  }

  function clearStatusTimers() {
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null }
    if (triggeredTimer) { clearTimeout(triggeredTimer); triggeredTimer = null }
  }

  // stroke:start / stroke:end 状态机
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
        // 如果 helper 没触发回调（无新笔画），回退到 idle
        if (status.value === 'paused') {
          status.value = 'idle'
        }
      }, gapMs.value + 100)
    })
  }

  function unbindStatusListeners() {
    unsubStrokeStart?.()
    unsubStrokeEnd?.()
    unsubStrokeStart = null
    unsubStrokeEnd = null
  }

  function manualExport() {
    const ed = editorApi.editor.value
    if (!ed) return

    const snapshot = ed.getSnapshot()
    const allStrokes = snapshot.strokeOrder
      .map((id: string) => snapshot.strokes.get(id))
      .filter((s): s is Stroke => s !== undefined)
    if (allStrokes.length === 0) return

    groups.value = groupByTime(allStrokes, gapMs.value)
    updateJsonResult()
  }

  function clearAll() {
    groups.value = []
    jsonResult.value = ''
    status.value = 'idle'
    clearStatusTimers()
    editorApi.clear()
  }

  function initEditor(container: HTMLElement) {
    editorApi.initEditor(container)
    bindHelper()
    bindStatusListeners()
  }

  watch(gapMs, () => {
    bindHelper()
  })

  function dispose() {
    clearStatusTimers()
    unbindStatusListeners()
    disposeHelper()
    editorApi.dispose()
  }

  return {
    editor: editorApi.editor,
    strokeCount: editorApi.strokeCount,
    zoomLevel: editorApi.zoomLevel,
    canUndo: editorApi.canUndo,
    canRedo: editorApi.canRedo,
    currentTool,
    styleParams,
    setTool,
    undo: editorApi.undo,
    redo: editorApi.redo,
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
    manualExport,
    clearAll,
    exportPNG: editorApi.exportPNG,
    exportJSON: editorApi.exportJSON,
    importJSON: editorApi.importJSON,
    zoomIn: editorApi.zoomIn,
    zoomOut: editorApi.zoomOut
  }
}
