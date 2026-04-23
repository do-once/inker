/**
 * 基础几何类型
 */

/** 二维坐标点 */
export interface Point {
  readonly x: number
  readonly y: number
}

/** 矩形区域 */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 尺寸 */
export interface Size {
  readonly width: number
  readonly height: number
}

/** 最小包围盒 */
export interface BBox {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
  readonly width: number
  readonly height: number
}
