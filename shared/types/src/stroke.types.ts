import type { StrokePoint } from './stroke-point.types'
import type { StrokeStyle } from './stroke-style.types'

/**
 * 完整笔画数据
 */
export interface Stroke {
  /** 笔画唯一标识 */
  readonly id: string
  /** 采样点序列 */
  readonly points: readonly StrokePoint[]
  /** 笔画样式 */
  readonly style: StrokeStyle
  /** 创建时间戳（毫秒） */
  readonly createdAt: number
}
