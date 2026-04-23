import type { OutlineGeometry } from '@inker/types'

/**
 * 将 OutlineGeometry 转换为 Path2D
 * 供 Canvas 2D 渲染器和 OffscreenCanvas Worker 共享使用
 *
 * 点数 >= 4 时采用 Chaikin 式二次贝塞尔平滑：
 *   - 用相邻两点的中点作为曲线锚点（终点），原始点作为控制点
 *   - 第一段：moveTo 第 0 点与第 1 点的中点
 *   - 中间段：quadraticCurveTo(原始点, 下一个中点)
 *   - 最后一段：quadraticCurveTo(最后一个原始点, 起始中点)
 *   - closePath()
 * 点数 < 4 时 fallback 到 lineTo 直线连接。
 */
export function geometryToPath2D(geometry: OutlineGeometry): Path2D {
  const path = new Path2D()
  const pts = geometry.points

  if (pts.length < 2) return path

  // 点数较少时直接使用 lineTo，避免贝塞尔曲线变形
  if (pts.length < 4) {
    path.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      path.lineTo(pts[i].x, pts[i].y)
    }
    path.closePath()
    return path
  }

  // 计算第 0 点与第 1 点的中点，作为路径起始锚点
  const startMidX = (pts[0].x + pts[1].x) / 2
  const startMidY = (pts[0].y + pts[1].y) / 2
  path.moveTo(startMidX, startMidY)

  // 中间段：以原始点为控制点，相邻中点为锚点，绘制二次贝塞尔曲线
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2
    const midY = (pts[i].y + pts[i + 1].y) / 2
    path.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY)
  }

  // 最后一段：以最后一个原始点为控制点，回到起始中点形成闭合
  path.quadraticCurveTo(pts[pts.length - 1].x, pts[pts.length - 1].y, startMidX, startMidY)

  path.closePath()
  return path
}
