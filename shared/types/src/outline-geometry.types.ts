import type { Point } from './geometry.types'

/** 通用笔画轮廓几何数据（渲染器无关） */
export interface OutlineGeometry {
  /** 轮廓多边形顶点（闭合路径），世界坐标 */
  readonly points: readonly Point[]
}
