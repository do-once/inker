import type { Stroke } from './stroke.types'

/**
 * 文档快照
 * 表示某一时刻的文档完整状态
 */
export interface DocumentSnapshot {
  /** 所有笔画，按 id 索引 */
  readonly strokes: ReadonlyMap<string, Stroke>
  /** 笔画绘制顺序（id 列表） */
  readonly strokeOrder: readonly string[]
  /** 快照时间戳（毫秒） */
  readonly timestamp: number
}
