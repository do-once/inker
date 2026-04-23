import type { Stroke } from '@inker/types'
import { groupByTime } from './group-by-time'
import type { RecognitionTarget, StrokeGroup } from './types'

/**
 * 事件驱动的识别辅助类
 * 绑定 Inker 实例后，在用户书写停顿时自动触发回调
 */
export class RecognitionHelper {
  private readonly gapMs: number
  private callbacks: Array<(group: StrokeGroup) => void> = []
  private target: RecognitionTarget | null = null
  private unsubscribe: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private processedStrokeIds = new Set<string>()
  private disposed = false

  constructor(options?: { gapMs?: number }) {
    this.gapMs = options?.gapMs ?? 500
  }

  bindTo(target: RecognitionTarget): void {
    this.assertNotDisposed()
    this.target = target
    this.unsubscribe = target.on('stroke:end', () => {
      this.resetTimer()
    })
  }

  onWritingComplete(callback: (group: StrokeGroup) => void): () => void {
    this.assertNotDisposed()
    this.callbacks.push(callback)
    return () => {
      const idx = this.callbacks.indexOf(callback)
      if (idx >= 0) this.callbacks.splice(idx, 1)
    }
  }

  getCurrentStrokes(): Stroke[] {
    this.assertNotDisposed()
    if (!this.target) {
      throw new Error('RecognitionHelper: 请先调用 bindTo 绑定目标')
    }
    const snapshot = this.target.getSnapshot()
    return snapshot.strokeOrder.map(id => snapshot.strokes.get(id)!)
  }

  dispose(): void {
    this.assertNotDisposed()
    this.disposed = true
    this.clearTimer()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.target = null
    this.callbacks = []
    this.processedStrokeIds.clear()
  }

  private resetTimer(): void {
    this.clearTimer()
    this.timer = setTimeout(() => this.onTimerExpired(), this.gapMs)
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private onTimerExpired(): void {
    if (!this.target) return

    const snapshot = this.target.getSnapshot()
    const allStrokes = snapshot.strokeOrder.map(id => snapshot.strokes.get(id)!)
    const newStrokes = allStrokes.filter(s => !this.processedStrokeIds.has(s.id))
    if (newStrokes.length === 0) return

    const groups = groupByTime(allStrokes, this.gapMs)
    const lastGroup = groups[groups.length - 1]
    if (!lastGroup) return

    const hasNew = lastGroup.strokes.some(s => !this.processedStrokeIds.has(s.id))
    if (!hasNew) return

    for (const stroke of lastGroup.strokes) {
      this.processedStrokeIds.add(stroke.id)
    }

    for (const callback of this.callbacks) {
      callback(lastGroup)
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('RecognitionHelper: 已被 dispose')
    }
  }
}
