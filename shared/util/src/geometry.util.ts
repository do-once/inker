import type { Point, Size, BBox, Stroke } from '@inker/types'

/**
 * 几何计算工具
 */

/**
 * 计算两点之间的欧几里得距离
 * @param p1 第一个点
 * @param p2 第二个点
 * @returns 两点之间的距离
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 将世界坐标归一化到 0-1 范围（供序列化/导出使用）
 * @param point 世界坐标点（像素）
 * @param size 文档尺寸（像素）
 * @returns 归一化后的坐标点（0-1）
 */
export function toNormalized(point: Point, size: Size): Point {
  return {
    x: point.x / size.width,
    y: point.y / size.height
  }
}

/**
 * 将归一化坐标（0-1）还原为世界坐标（供反序列化/导入使用）
 * @param point 归一化坐标点（0-1）
 * @param size 文档尺寸（像素）
 * @returns 世界坐标点（像素）
 */
export function fromNormalized(point: Point, size: Size): Point {
  return {
    x: point.x * size.width,
    y: point.y * size.height
  }
}

/**
 * 计算一组笔画的最小包围盒
 * @param strokes 笔画数组
 * @returns 最小包围盒（世界坐标像素）
 */
export function computeBBox(strokes: readonly Stroke[]): BBox {
  if (strokes.length === 0 || strokes.every(s => s.points.length === 0)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      if (point.x < minX) minX = point.x
      if (point.y < minY) minY = point.y
      if (point.x > maxX) maxX = point.x
      if (point.y > maxY) maxY = point.y
    }
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * 将笔画坐标平移到包围盒左上角为原点
 * 不修改原始输入，返回新的笔画数组
 * @param strokes 笔画数组
 * @returns 坐标平移后的新笔画数组（单位仍为像素）
 */
export function translateToBBoxOrigin(strokes: readonly Stroke[]): Stroke[] {
  if (strokes.length === 0) return []

  const bbox = computeBBox(strokes)

  return strokes.map(stroke => ({
    ...stroke,
    points: stroke.points.map(point => ({
      ...point,
      x: point.x - bbox.minX,
      y: point.y - bbox.minY
    }))
  }))
}
