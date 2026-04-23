import type { Operation } from '@inker/types'

/** 带时间标记的操作 */
interface TimedOperation {
  /** 相对时间（毫秒，从 0 开始） */
  readonly relativeTime: number
  /** 原始操作 */
  readonly operation: Operation
}

/**
 * 从操作中提取绝对时间戳
 * stroke:start/end 使用 timestamp 字段
 * stroke:addPoint 使用 point.t 字段
 * stroke:delete/clear 使用 timestamp 字段
 */
function extractTimestamp(op: Operation): number {
  switch (op.type) {
    case 'stroke:start':
      return op.timestamp
    case 'stroke:addPoint':
      return op.point.t
    case 'stroke:end':
      return op.timestamp
    case 'stroke:delete':
      return op.timestamp
    case 'stroke:clear':
      return op.timestamp
  }
}

/**
 * PlaybackTimeline — 时间线管理
 *
 * 管理操作序列的时间线，使用相对时间（0 = 第一个操作时间戳）
 * 支持按时间范围查询操作
 */
export class PlaybackTimeline {
  /** 带相对时间标记的操作列表 */
  private readonly timedOps: readonly TimedOperation[]
  /** 回放总时长 */
  private readonly _duration: number
  /** 基准时间戳（第一个操作的绝对时间） */
  private readonly baseTime: number

  constructor(operations: readonly Operation[]) {
    if (operations.length === 0) {
      this.timedOps = []
      this._duration = 0
      this.baseTime = 0
      return
    }

    this.baseTime = extractTimestamp(operations[0])

    this.timedOps = operations.map(op => ({
      relativeTime: extractTimestamp(op) - this.baseTime,
      operation: op
    }))

    const lastTime = extractTimestamp(operations[operations.length - 1])
    this._duration = lastTime - this.baseTime
  }

  /** 回放总时长（最后操作时间戳 - 第一个操作时间戳） */
  get duration(): number {
    return this._duration
  }

  /** 获取到指定相对时间点为止的操作（包含该时间点） */
  getOperationsUntil(time: number): readonly Operation[] {
    if (time < 0) return []
    return this.timedOps
      .filter(to => to.relativeTime <= time)
      .map(to => to.operation)
  }

  /** 获取两个相对时间点之间的操作（包含两端） */
  getOperationsBetween(startTime: number, endTime: number): readonly Operation[] {
    return this.timedOps
      .filter(to => to.relativeTime >= startTime && to.relativeTime <= endTime)
      .map(to => to.operation)
  }

  /** 重置时间线状态 */
  reset(): void {
    // 当前实现是无状态的，reset 为空操作
    // 预留给未来有状态缓存时使用
  }
}
