import type { StrokePoint } from '@inker/types'

/**
 * 笔画会话
 * 管理单条活跃笔画状态（strokeId + 采样点序列）
 */
export class StrokeSession {
  readonly strokeId: string
  readonly startTimestamp: number
  private points: StrokePoint[]

  constructor(
    strokeId: string,
    firstPoint: StrokePoint,
    timestamp: number
  ) {
    this.strokeId = strokeId
    this.startTimestamp = timestamp
    this.points = [firstPoint]
  }

  addPoint(point: StrokePoint): void {
    this.points.push(point)
  }

  getPoints(): readonly StrokePoint[] {
    return [...this.points]
  }

  getLastPoint(): StrokePoint {
    return this.points[this.points.length - 1]
  }

  get pointCount(): number {
    return this.points.length
  }
}
