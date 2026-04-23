import type { Stroke, DocumentSnapshot } from '@inker/types'

/** 按时间间隔分组后的笔画组 */
export interface StrokeGroup {
  readonly strokes: Stroke[]
  readonly startTime: number
  readonly endTime: number
}

/** 格式导出选项 */
export interface ExportFormatOptions {
  /** 是否计算包围盒并将坐标平移到包围盒原点 */
  readonly toBBoxOrigin?: boolean
}

/** 可扩展的导出格式策略接口 */
export interface ExportFormat<T> {
  readonly name: string
  convert(strokes: readonly Stroke[], options?: ExportFormatOptions): T
}

/** RecognitionHelper 绑定目标的最小接口 */
export interface RecognitionTarget {
  on(event: string, handler: (data: unknown) => void): () => void
  getSnapshot(): DocumentSnapshot
}
