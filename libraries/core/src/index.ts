// @inker/core — EventBus + 抽象基类 + ServiceTokens + EditorKernel

// 事件总线
export { EventBus } from './event-bus.service'

// 服务 DI Token
export {
  EVENT_BUS,
  INPUT_ADAPTER,
  RENDER_ADAPTER,
  STROKE_PROCESSOR,
  COMPUTE_STRATEGY,
  STROKE_DOCUMENT,
  COORDINATE_SYSTEM
} from './service-tokens'

// 抽象基类
export { RenderAdapter } from './render.adapter'
export { StrokeProcessor } from './stroke.processor'
export { ComputeStrategy } from './compute.strategy'

// 编辑器核心
export { EditorKernel } from './editor-kernel.service'
export type { EditorKernelDeps } from './editor-kernel.service'

// 橡皮擦轨迹
export { EraserTrail } from './eraser-trail'
export type { EraserTrailOptions, TrailPoint } from './eraser-trail'

// 几何工具
export { geometryToPath2D } from './geometry.utils'

// 笔画会话
export { StrokeSession } from './stroke-session'
