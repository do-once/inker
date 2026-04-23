import type { Operation, DocumentSnapshot } from '@inker/types'
import { SnapshotBuilder } from './snapshot-builder.service'

/** Checkpoint：操作序列中某个位置的快照缓存 */
interface Checkpoint {
  /** 对应的 cursor 位置 */
  readonly cursor: number
  /** 快照 */
  readonly snapshot: DocumentSnapshot
}

/**
 * 笔画文档模型
 * 基于 Operation + Checkpoint 混合模式
 * operations 是 source of truth，undo/redo 粒度为完整笔画
 */
export class StrokeDocument {
  /** 全部操作记录 */
  private operations: Operation[] = []
  /** 当前 cursor 位置（指向有效操作的末尾） */
  private cursor = 0
  /** checkpoint 列表 */
  private checkpoints: Checkpoint[] = []
  /** 快照缓存 */
  private cachedSnapshot: DocumentSnapshot | null = null
  /** 笔画边界位置（每个 stroke:end 对应的 cursor 值） */
  private strokeBoundaries: number[] = []

  /**
   * 应用操作
   * 如果 cursor 不在末尾（undo 后），截断 redo 历史
   */
  apply(op: Operation): void {
    // 截断 redo 历史
    if (this.cursor < this.operations.length) {
      this.operations.length = this.cursor
      // 清理被截断的 checkpoints 和 boundaries
      this.checkpoints = this.checkpoints.filter(cp => cp.cursor <= this.cursor)
      this.strokeBoundaries = this.strokeBoundaries.filter(b => b <= this.cursor)
    }

    this.operations.push(op)
    this.cursor = this.operations.length
    this.cachedSnapshot = null

    // stroke:end 时记录边界并生成 checkpoint
    if (op.type === 'stroke:end') {
      this.strokeBoundaries.push(this.cursor)
      this.checkpoints.push({
        cursor: this.cursor,
        snapshot: this.buildSnapshot()
      })
    }

    // stroke:clear 和 stroke:delete 也是一个 undo 边界
    if (op.type === 'stroke:clear' || op.type === 'stroke:delete') {
      this.strokeBoundaries.push(this.cursor)
      this.checkpoints.push({
        cursor: this.cursor,
        snapshot: this.buildSnapshot()
      })
    }
  }

  /**
   * 撤销到上一个笔画边界
   */
  undo(): void {
    if (!this.canUndo) return

    // 找到 cursor 之前最近的笔画边界
    const prevBoundary = this.findPrevBoundary()
    if (prevBoundary !== null) {
      this.cursor = prevBoundary
    } else {
      this.cursor = 0
    }
    this.cachedSnapshot = null
  }

  /**
   * 重做到下一个笔画边界
   */
  redo(): void {
    if (!this.canRedo) return

    // 找到 cursor 之后最近的笔画边界
    const nextBoundary = this.findNextBoundary()
    if (nextBoundary !== null) {
      this.cursor = nextBoundary
    }
    this.cachedSnapshot = null
  }

  /** 是否可以撤销 */
  get canUndo(): boolean {
    return this.cursor > 0 && this.strokeBoundaries.some(b => b <= this.cursor)
  }

  /** 是否可以重做 */
  get canRedo(): boolean {
    return this.cursor < this.operations.length &&
      this.strokeBoundaries.some(b => b > this.cursor)
  }

  /** 获取当前快照 */
  getSnapshot(): DocumentSnapshot {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = this.buildSnapshot()
    }
    return this.cachedSnapshot
  }

  /** 获取全部操作记录（到 cursor 位置） */
  getOperations(): readonly Operation[] {
    return this.operations.slice(0, this.cursor)
  }

  /** 获取 checkpoint 列表 */
  getCheckpoints(): readonly Checkpoint[] {
    return this.checkpoints.filter(cp => cp.cursor <= this.cursor)
  }

  /**
   * 构建当前 snapshot
   * 优先从最近的 checkpoint 增量构建
   */
  private buildSnapshot(): DocumentSnapshot {
    // 找到 cursor 之前最近的有效 checkpoint
    const validCheckpoints = this.checkpoints.filter(cp => cp.cursor <= this.cursor)
    const nearestCheckpoint = validCheckpoints.length > 0
      ? validCheckpoints[validCheckpoints.length - 1]
      : null

    if (nearestCheckpoint && nearestCheckpoint.cursor === this.cursor) {
      // 刚好在 checkpoint 位置
      return nearestCheckpoint.snapshot
    }

    if (nearestCheckpoint) {
      const remainingOps = this.operations.slice(nearestCheckpoint.cursor, this.cursor)
      // 如果剩余操作包含 stroke:end，可能存在跨越 checkpoint 边界的未完成笔画，
      // buildFromCheckpoint 无法处理这种情况（pending 状态丢失），需要全量构建
      const hasStrokeEnd = remainingOps.some(op => op.type === 'stroke:end')
      if (hasStrokeEnd) {
        return SnapshotBuilder.build(this.operations.slice(0, this.cursor))
      }
      // 从 checkpoint 增量构建
      return SnapshotBuilder.buildFromCheckpoint(nearestCheckpoint.snapshot, remainingOps)
    }

    // 全量构建
    return SnapshotBuilder.build(this.operations.slice(0, this.cursor))
  }

  /** 找到 cursor 之前最近的笔画边界（不包含当前 cursor 位置，除非 cursor 在某个边界上时退到更前面的边界） */
  private findPrevBoundary(): number | null {
    // 找到 cursor 之前的所有边界
    const prev = this.strokeBoundaries.filter(b => b < this.cursor)
    if (prev.length === 0) return null
    // 如果当前 cursor 恰好在一个边界上，退到上一个边界
    // 如果不在边界上，退到最近的边界
    return prev[prev.length - 1] === this.cursor
      ? (prev.length >= 2 ? prev[prev.length - 2] : 0)
      : prev[prev.length - 1]
  }

  /** 找到 cursor 之后最近的笔画边界 */
  private findNextBoundary(): number | null {
    const next = this.strokeBoundaries.filter(b => b > this.cursor)
    return next.length > 0 ? next[0] : null
  }
}
