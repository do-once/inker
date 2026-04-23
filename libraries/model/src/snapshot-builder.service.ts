import type { Operation, DocumentSnapshot, Stroke, StrokePoint, StrokeStyle } from '@inker/types'

/** 构建中的笔画（未完成） */
interface PendingStroke {
  id: string
  points: StrokePoint[]
  style: StrokeStyle
  createdAt: number
}

/**
 * 快照构建器
 * 从操作序列构建 DocumentSnapshot
 */
export class SnapshotBuilder {
  /**
   * 从操作序列全量构建 snapshot
   * @param operations 操作列表
   * @returns 文档快照
   */
  static build(operations: readonly Operation[]): DocumentSnapshot {
    const strokes = new Map<string, Stroke>()
    const strokeOrder: string[] = []
    const pending = new Map<string, PendingStroke>()

    for (const op of operations) {
      SnapshotBuilder.applyOp(op, strokes, strokeOrder, pending)
    }

    return {
      strokes,
      strokeOrder,
      timestamp: Date.now()
    }
  }

  /**
   * 从 checkpoint 增量构建 snapshot
   * @param checkpoint 已有的快照（作为基础）
   * @param operations 增量操作列表
   * @returns 新的文档快照
   */
  static buildFromCheckpoint(
    checkpoint: DocumentSnapshot,
    operations: readonly Operation[]
  ): DocumentSnapshot {
    // 从 checkpoint 复制数据
    const strokes = new Map(checkpoint.strokes)
    const strokeOrder = [...checkpoint.strokeOrder]
    const pending = new Map<string, PendingStroke>()

    for (const op of operations) {
      SnapshotBuilder.applyOp(op, strokes, strokeOrder, pending)
    }

    return {
      strokes,
      strokeOrder,
      timestamp: Date.now()
    }
  }

  /** 应用单个操作到可变状态 */
  private static applyOp(
    op: Operation,
    strokes: Map<string, Stroke>,
    strokeOrder: string[],
    pending: Map<string, PendingStroke>
  ): void {
    switch (op.type) {
      case 'stroke:start': {
        pending.set(op.strokeId, {
          id: op.strokeId,
          points: [op.point],
          style: op.style,
          createdAt: op.timestamp
        })
        break
      }
      case 'stroke:addPoint': {
        const p = pending.get(op.strokeId)
        if (p) {
          p.points.push(op.point)
        }
        break
      }
      case 'stroke:end': {
        const p = pending.get(op.strokeId)
        if (p) {
          const stroke: Stroke = {
            id: p.id,
            points: p.points,
            style: p.style,
            createdAt: p.createdAt
          }
          strokes.set(p.id, stroke)
          strokeOrder.push(p.id)
          pending.delete(op.strokeId)
        }
        break
      }
      case 'stroke:delete': {
        for (const id of op.strokeIds) {
          strokes.delete(id)
          const idx = strokeOrder.indexOf(id)
          if (idx !== -1) {
            strokeOrder.splice(idx, 1)
          }
        }
        break
      }
      case 'stroke:clear': {
        strokes.clear()
        strokeOrder.length = 0
        pending.clear()
        break
      }
    }
  }
}
