import type { Stroke, BBox } from '@inker/types'
import { computeBBox } from '@inker/util'
import type { ExportFormat, ExportFormatOptions } from '../types'

/** SimpleJsonFormat 的输出结构 */
export interface SimpleJsonResult {
  strokes: Array<{
    id: string
    points: Array<{ x: number; y: number; t: number; p: number }>
    style: { type: string; color: string; size: number }
  }>
  boundingBox: BBox | null
}

/**
 * 简单 JSON 导出格式
 * 将笔画数据转换为易于识别 API 消费的 JSON 结构
 */
export class SimpleJsonFormat implements ExportFormat<SimpleJsonResult> {
  readonly name = 'simple-json'

  convert(strokes: readonly Stroke[], options?: ExportFormatOptions): SimpleJsonResult {
    if (strokes.length === 0) {
      return { strokes: [], boundingBox: null }
    }

    const useToBBoxOrigin = options?.toBBoxOrigin === true
    const bbox = useToBBoxOrigin ? computeBBox(strokes) : null
    const offsetX = bbox?.minX ?? 0
    const offsetY = bbox?.minY ?? 0

    return {
      strokes: strokes.map(stroke => ({
        id: stroke.id,
        points: stroke.points.map(point => ({
          x: useToBBoxOrigin ? point.x - offsetX : point.x,
          y: useToBBoxOrigin ? point.y - offsetY : point.y,
          t: point.t,
          p: point.p
        })),
        style: {
          type: stroke.style.type,
          color: stroke.style.color,
          size: stroke.style.size
        }
      })),
      boundingBox: bbox
    }
  }
}
