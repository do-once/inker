// @inker/types — 纯接口，零 runtime

// 基础几何类型
export type { Point, Rect, Size, BBox } from './geometry.types'

// Camera 视口
export type { Camera } from './camera.types'

// 笔画数据类型
export type { StrokePoint } from './stroke-point.types'
export type { StrokeType, StrokeStyle, EasingType, StrokeTaper } from './stroke-style.types'
export type { Stroke } from './stroke.types'

// 操作与快照
export type { Operation } from './operation.types'
export type { DocumentSnapshot } from './document-snapshot.types'

// 输入适配器
export type {
  PointerType,
  RawPoint,
  StrokeInputReceiver,
  InputAdapterInterface
} from './input-adapter.types'

// 渲染适配器
export type {
  StrokeData,
  RenderAdapterInterface
} from './render-adapter.types'

// 轮廓几何
export type { OutlineGeometry } from './outline-geometry.types'

// 笔画处理器
export type { StrokeProcessorInterface } from './stroke-processor.types'

// 计算策略
export type { ComputeStrategyInterface } from './compute-strategy.types'

// 事件映射
export type { EventMap } from './event-map.types'

// 编辑器配置
export type { EditorTheme, EditorOptions } from './editor-options.types'
