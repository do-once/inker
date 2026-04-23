import type { Operation } from '@inker/types'
import { PlaybackTimeline } from './playback-timeline.model'

/** 回放状态 */
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished'

/** 回放配置选项 */
export interface StrokePlayerOptions {
  /** 播放速度倍率，默认 1 */
  speed?: number
}

/** 回放 tick 间隔（毫秒） */
const TICK_INTERVAL = 16

/**
 * StrokePlayer — 回放控制器
 *
 * 控制笔迹回放流程（play/pause/resume/stop 状态机）
 * 使用 setInterval 定时推进，按时间触发操作回调
 */
export class StrokePlayer {
  /** 操作回调 */
  onOperation: ((op: Operation) => void) | null = null

  /** 完成回调 */
  onFinish: (() => void) | null = null

  /** 时间线模型 */
  private readonly timeline: PlaybackTimeline
  /** 全部操作（保留引用用于按序回调） */
  private readonly operations: readonly Operation[]

  /** 当前状态 */
  private _state: PlaybackState = 'idle'
  /** 播放速度倍率 */
  private _speed: number
  /** 已发送的操作索引 */
  private cursor = 0
  /** 回放开始的真实时间 */
  private startRealTime = 0
  /** 暂停时已经过的虚拟时间 */
  private elapsedAtPause = 0
  /** 当前虚拟时间偏移量 */
  private _elapsed = 0
  /** 定时器 ID */
  private tickTimer: ReturnType<typeof setInterval> | null = null
  /** 是否已销毁 */
  private disposed = false

  constructor(operations: readonly Operation[], options?: StrokePlayerOptions) {
    this.operations = operations
    this.timeline = new PlaybackTimeline(operations)
    this._speed = options?.speed ?? 1
  }

  /** 当前状态 */
  get state(): PlaybackState {
    return this._state
  }

  /** 播放速度 */
  get speed(): number {
    return this._speed
  }

  /** 设置播放速度 */
  set speed(value: number) {
    // 如果正在播放，需要调整基准时间
    if (this._state === 'playing') {
      this.elapsedAtPause = this._elapsed
      this.startRealTime = Date.now()
    }
    this._speed = value
  }

  /** 进度百分比（0-1） */
  get progress(): number {
    if (this.timeline.duration === 0) {
      return this._state === 'finished' ? 1 : 0
    }
    return Math.min(this._elapsed / this.timeline.duration, 1)
  }

  /** 开始回放 */
  play(): void {
    if (this.disposed) return

    this._state = 'playing'
    this.cursor = 0
    this._elapsed = 0
    this.elapsedAtPause = 0
    this.startRealTime = Date.now()

    this.startTick()
  }

  /** 暂停回放 */
  pause(): void {
    if (this._state !== 'playing') return

    this._state = 'paused'
    this.elapsedAtPause = this._elapsed
    this.stopTick()
  }

  /** 恢复回放 */
  resume(): void {
    if (this._state !== 'paused') return

    this._state = 'playing'
    this.startRealTime = Date.now()
    this.startTick()
  }

  /** 停止回放并重置 */
  stop(): void {
    if (this.disposed) return

    this._state = 'idle'
    this.cursor = 0
    this._elapsed = 0
    this.elapsedAtPause = 0
    this.stopTick()
    this.timeline.reset()
  }

  /** 释放资源 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopTick()
    this.onOperation = null
    this.onFinish = null
  }

  /** 启动定时 tick */
  private startTick(): void {
    this.stopTick()
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL)
    // 立即执行一次 tick（处理 t=0 的操作）
    this.tick()
  }

  /** 停止定时 tick */
  private stopTick(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  /** 每次 tick 更新时间并触发到期的操作 */
  private tick(): void {
    if (this._state !== 'playing') return

    // 计算当前虚拟时间（考虑速度倍率）
    const realElapsed = Date.now() - this.startRealTime
    this._elapsed = this.elapsedAtPause + realElapsed * this._speed

    // 获取到当前时间为止应该触发的操作
    const opsUntilNow = this.timeline.getOperationsUntil(this._elapsed)

    // 触发尚未发送的操作
    while (this.cursor < opsUntilNow.length) {
      const op = this.operations[this.cursor]
      this.cursor++
      if (this.onOperation) {
        this.onOperation(op)
      }
    }

    // 检查是否全部完成
    if (this.cursor >= this.operations.length) {
      this._elapsed = this.timeline.duration
      this._state = 'finished'
      this.stopTick()
      if (this.onFinish) {
        this.onFinish()
      }
    }
  }
}
