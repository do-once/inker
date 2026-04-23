import type { RawPoint } from '@inker/types'

/**
 * 坐标点提取器
 * 从 PointerEvent 中提取坐标，支持点去重
 */
export class PointExtractor {
  /** 上一个有效点（用于去重） */
  private lastPoint: RawPoint | null = null

  /**
   * 从 PointerEvent 中提取原始坐标点
   * @param event 指针事件
   * @param offset 容器偏移量 { left, top }
   * @returns 提取的坐标点，坐标无效时返回 null
   */
  extract(
    event: PointerEvent,
    offset: { left: number; top: number }
  ): RawPoint | null {
    const x = event.clientX - offset.left
    const y = event.clientY - offset.top

    // 校验坐标有效性
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }

    return {
      x,
      y,
      pressure: event.pressure
    }
  }

  /**
   * 判断点是否应保留（去重）
   * 基于距离阈值过滤重复点，阈值与笔宽相关
   * 公式：delta = 1 + min(width^0.75, 8)
   * @param point 待检测的点
   * @param width 当前笔宽
   * @returns true 表示保留，false 表示过滤
   */
  filterDuplicate(point: RawPoint, width: number): boolean {
    if (this.lastPoint === null) {
      this.lastPoint = point
      return true
    }

    const delta = 1 + Math.min(Math.pow(width, 0.75), 8)

    if (
      Math.abs(point.x - this.lastPoint.x) >= delta ||
      Math.abs(point.y - this.lastPoint.y) >= delta
    ) {
      this.lastPoint = point
      return true
    }

    return false
  }
}
