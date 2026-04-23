/**
 * 笔画样式
 */
import type { StrokeOptions } from '@inker/freehand'

/** 笔画类型 */
export type StrokeType = 'pen' | 'eraser' | 'marker' | 'pencil' | 'wiper'

/** 压感缓动函数类型（对齐 perfect-freehand 官网 19 种） */
export type EasingType =
  | 'linear'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
  | 'easeInQuint' | 'easeOutQuint' | 'easeInOutQuint'
  | 'easeInSine' | 'easeOutSine' | 'easeInOutSine'
  | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo'

/**
 * 从 StrokeOptions 中提取可序列化的扁平字段
 * 排除：easing（函数）、start/end（嵌套，需特殊处理）、last（内部字段）
 */
type SerializableStrokeOptions = Readonly<
  Omit<StrokeOptions, 'easing' | 'start' | 'end' | 'last'>
>

/**
 * 笔画起始/结束的渐细+端帽配置
 * 复用 freehand StrokeOptions['start'] 的 cap/taper 字段，排除 easing 函数
 */
export type StrokeTaper = Readonly<
  Omit<NonNullable<StrokeOptions['start']>, 'easing'>
>

/**
 * 笔画样式定义
 * 继承 freehand StrokeOptions 的可序列化字段（size/thinning/smoothing/streamline/simulatePressure）
 * 新增绘图专用字段（type/color/opacity）和可序列化的 easing/start/end
 */
export interface StrokeStyle extends SerializableStrokeOptions {
  /** 笔画类型 */
  readonly type: StrokeType
  /** 颜色值 */
  readonly color: string
  /** 笔画基准大小（直径），继承自 StrokeOptions.size，收窄为 required */
  readonly size: number
  /** 不透明度（0-1） */
  readonly opacity: number
  /** 压感缓动类型（可序列化字符串，替代 StrokeOptions 中的函数） */
  readonly easing?: EasingType
  /** 起始端配置（渐细 + 端帽） */
  readonly start?: StrokeTaper
  /** 结束端配置（渐细 + 端帽） */
  readonly end?: StrokeTaper
}
