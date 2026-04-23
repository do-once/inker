import type { StrokePoint } from './stroke-point.types'
import type { StrokeStyle } from './stroke-style.types'

/**
 * 文档操作类型
 * Operation 是数据变更的 source of truth
 */
export type Operation =
  | {
      readonly type: 'stroke:start'
      readonly strokeId: string
      readonly style: StrokeStyle
      readonly point: StrokePoint
      readonly timestamp: number
    }
  | {
      readonly type: 'stroke:addPoint'
      readonly strokeId: string
      readonly point: StrokePoint
    }
  | {
      readonly type: 'stroke:end'
      readonly strokeId: string
      readonly timestamp: number
    }
  | {
      readonly type: 'stroke:delete'
      readonly strokeIds: readonly string[]
      readonly timestamp: number
    }
  | {
      readonly type: 'stroke:clear'
      readonly timestamp: number
    }
