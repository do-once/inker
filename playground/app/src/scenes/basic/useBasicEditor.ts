import { ref, reactive } from 'vue'
import { useEditor } from '../../composables/useEditor'
import type { ToolType } from '../../types'

/** 工具预设参数 */
const toolPresets: Record<ToolType, { color: string; size: number; opacity: number }> = {
  pen: { color: '#000000', size: 2, opacity: 1 },
  marker: { color: '#ff6600', size: 12, opacity: 0.6 },
  pencil: { color: '#333333', size: 1, opacity: 0.8 },
  eraser: { color: '#ffffff', size: 20, opacity: 1 }
}

/** perfect-freehand 官网默认参数 */
const OFFICIAL_DEFAULTS = {
  size: 16,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  easing: 'linear' as string,
  simulatePressure: true,
  taperStart: 0,
  capStart: true,
  taperEnd: 0,
  capEnd: true
}

/** 样式参数默认值 */
const DEFAULT_STYLE_PARAMS = {
  color: '#000000',
  size: 2,
  opacity: 1,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  easing: 'linear' as string,
  simulatePressure: true,
  taperStart: 0,
  capStart: true,
  taperEnd: 0,
  capEnd: true
}

/**
 * 基础场景专属 composable
 * 在共享 useEditor 基础上，添加工具预设、工具切换、参数重置等功能
 */
export function useBasicEditor() {
  const currentTool = ref<ToolType>('pen')

  const styleParams = reactive({ ...DEFAULT_STYLE_PARAMS })

  const editorApi = useEditor(styleParams, currentTool)

  /** 切换工具并应用预设参数 */
  function setTool(tool: ToolType) {
    currentTool.value = tool
    const preset = toolPresets[tool]
    styleParams.color = preset.color
    styleParams.size = preset.size
    styleParams.opacity = preset.opacity
  }

  /** 重置参数为当前工具的默认值 */
  function resetParams() {
    const preset = toolPresets[currentTool.value]
    Object.assign(styleParams, {
      ...DEFAULT_STYLE_PARAMS,
      color: preset.color,
      size: preset.size,
      opacity: preset.opacity
    })
  }

  /** 应用官网默认参数（用于对比效果） */
  function applyOfficialDefaults() {
    Object.assign(styleParams, OFFICIAL_DEFAULTS)
  }

  return {
    ...editorApi,
    currentTool,
    styleParams,
    setTool,
    resetParams,
    applyOfficialDefaults
  }
}
