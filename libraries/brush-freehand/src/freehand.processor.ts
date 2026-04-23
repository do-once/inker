import { StrokeProcessor } from '@inker/core'
import { getStroke } from '@inker/freehand'
import { EASING_FUNCTIONS } from '@inker/util'
import type { OutlineGeometry, StrokePoint, StrokeStyle, StrokeType } from '@inker/types'

/**
 * Freehand 笔刷处理器
 * 使用 perfect-freehand 算法将采样点转换为平滑的笔画轮廓
 * 支持钢笔、马克笔、铅笔三种笔画类型
 */
export class FreehandProcessor extends StrokeProcessor {
  readonly supportedTypes: readonly StrokeType[] = ['pen', 'marker', 'pencil']

  /**
   * 计算笔画轮廓几何数据
   * 采样点已是世界坐标，直接传入 getStroke
   */
  computeOutline(
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): OutlineGeometry | null {
    // 空点集直接返回 null
    if (points.length === 0) return null

    // 采样点已是世界坐标，直接转换为 getStroke 需要的格式
    const inputPoints = points.map(p => ({
      x: p.x,
      y: p.y,
      pressure: p.p
    }))

    // 调用 getStroke 计算轮廓点，支持从 style 扩展属性读取参数
    const outline = getStroke(inputPoints, {
      size: style.size,
      last: complete,
      simulatePressure: style.simulatePressure ?? true,
      thinning: style.thinning,
      smoothing: style.smoothing,
      streamline: style.streamline,
      easing: style.easing ? EASING_FUNCTIONS[style.easing] : undefined,
      start: style.start,
      end: style.end
    })

    // 轮廓点不足则返回 null
    if (!outline || outline.length < 2) return null

    // 直接返回通用几何数据
    return {
      points: outline.map(([x, y]) => ({ x, y }))
    }
  }
}
