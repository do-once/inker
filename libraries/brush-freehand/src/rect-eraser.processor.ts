import { StrokeProcessor } from '@inker/core'
import type { StrokePoint, StrokeStyle, StrokeType, Stroke, OutlineGeometry } from '@inker/types'

/** 碰撞检测最小容差（像素），确保小宽度擦除器仍可命中 */
const MIN_TOLERANCE = 5

/**
 * 计算点 P 到线段 AB 的最短距离
 * 通过将 P 投影到线段上，clamp 参数 t 到 [0,1]
 */
function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy

  // 线段退化为点
  if (lenSq === 0) {
    const ex = px - ax
    const ey = py - ay
    return Math.sqrt(ex * ex + ey * ey)
  }

  // 投影参数 t，clamp 到 [0,1]
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  if (t < 0) t = 0
  else if (t > 1) t = 1

  const closestX = ax + t * dx
  const closestY = ay + t * dy
  const ex = px - closestX
  const ey = py - closestY
  return Math.sqrt(ex * ex + ey * ey)
}

/**
 * 计算线段 AB 与线段 CD 之间的最短距离
 * 通过四次点-线段距离检测取最小值
 */
function segmentToSegmentDist(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): number {
  return Math.min(
    pointToSegmentDist(ax, ay, cx, cy, dx, dy),
    pointToSegmentDist(bx, by, cx, cy, dx, dy),
    pointToSegmentDist(cx, cy, ax, ay, bx, by),
    pointToSegmentDist(dx, dy, ax, ay, bx, by)
  )
}

/**
 * 矩形橡皮擦处理器
 * 使用线段距离检测实现笔画擦除
 * 支持橡皮擦和黑板擦两种类型
 */
export class RectEraserProcessor extends StrokeProcessor {
  readonly supportedTypes: readonly StrokeType[] = ['eraser', 'wiper']

  /**
   * 橡皮擦不绘制可见轮廓，直接返回 null
   */
  computeOutline(
    _points: readonly StrokePoint[],
    _style: StrokeStyle,
    _complete: boolean
  ): OutlineGeometry | null {
    return null
  }

  /**
   * 计算被擦除的笔画 ID 列表
   * 算法：将擦除路径和笔画路径分别构建为线段序列，
   * 检查擦除线段与笔画线段之间的最短距离是否 ≤ 容差。
   * 容差 = max(eraserStyle.size / 2, MIN_TOLERANCE)
   * 所有坐标已是世界坐标，无需转换
   */
  computeErasure(
    eraserPoints: readonly StrokePoint[],
    eraserStyle: StrokeStyle,
    existingStrokes: ReadonlyMap<string, Stroke>
  ): string[] {
    if (eraserPoints.length === 0) return []

    const tolerance = Math.max(eraserStyle.size / 2, MIN_TOLERANCE)
    const result: string[] = []

    for (const [id, stroke] of existingStrokes) {
      if (this.strokeHit(eraserPoints, stroke.points, tolerance)) {
        result.push(id)
      }
    }

    return result
  }

  /**
   * 检测擦除路径与笔画路径是否碰撞
   * 当任一擦除线段与任一笔画线段的距离 ≤ tolerance 时返回 true
   */
  private strokeHit(
    eraserPts: readonly StrokePoint[],
    strokePts: readonly StrokePoint[],
    tolerance: number
  ): boolean {
    // 擦除器只有单点时，退化为点对线段检测
    if (eraserPts.length === 1) {
      const ep = eraserPts[0]
      if (strokePts.length === 1) {
        const sp = strokePts[0]
        const dx = ep.x - sp.x
        const dy = ep.y - sp.y
        return Math.sqrt(dx * dx + dy * dy) <= tolerance
      }
      for (let j = 0; j < strokePts.length - 1; j++) {
        const s0 = strokePts[j]
        const s1 = strokePts[j + 1]
        if (pointToSegmentDist(ep.x, ep.y, s0.x, s0.y, s1.x, s1.y) <= tolerance) {
          return true
        }
      }
      return false
    }

    // 笔画只有单点时，退化为点对线段检测
    if (strokePts.length === 1) {
      const sp = strokePts[0]
      for (let i = 0; i < eraserPts.length - 1; i++) {
        const e0 = eraserPts[i]
        const e1 = eraserPts[i + 1]
        if (pointToSegmentDist(sp.x, sp.y, e0.x, e0.y, e1.x, e1.y) <= tolerance) {
          return true
        }
      }
      return false
    }

    // 线段对线段检测
    for (let i = 0; i < eraserPts.length - 1; i++) {
      const e0 = eraserPts[i]
      const e1 = eraserPts[i + 1]
      for (let j = 0; j < strokePts.length - 1; j++) {
        const s0 = strokePts[j]
        const s1 = strokePts[j + 1]
        if (segmentToSegmentDist(
          e0.x, e0.y, e1.x, e1.y,
          s0.x, s0.y, s1.x, s1.y
        ) <= tolerance) {
          return true
        }
      }
    }

    return false
  }
}
