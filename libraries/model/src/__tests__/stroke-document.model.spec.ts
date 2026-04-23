import { describe, it, expect } from 'vitest'
import { StrokeDocument } from '../stroke-document.model'
import type { Operation, StrokePoint, StrokeStyle } from '@inker/types'

/** 测试用默认笔画样式 */
const defaultStyle: StrokeStyle = {
  type: 'pen',
  color: '#000000',
  size: 2,
  opacity: 1
}

/** 创建测试用采样点 */
function point(x: number, y: number, t: number = Date.now(), p: number = 0.5): StrokePoint {
  return { x, y, t, p }
}

/** 创建一条完整笔画的操作序列 */
function createStrokeOps(
  strokeId: string,
  points: StrokePoint[],
  style: StrokeStyle = defaultStyle
): Operation[] {
  const now = Date.now()
  const ops: Operation[] = [
    { type: 'stroke:start', strokeId, style, point: points[0], timestamp: now }
  ]
  for (let i = 1; i < points.length; i++) {
    ops.push({ type: 'stroke:addPoint', strokeId, point: points[i] })
  }
  ops.push({ type: 'stroke:end', strokeId, timestamp: now + 100 })
  return ops
}

describe('StrokeDocument', () => {
  describe('apply 基本操作', () => {
    it('apply stroke:start 后 snapshot 中出现 pendingStroke', () => {
      const doc = new StrokeDocument()
      const p = point(0.1, 0.2)
      doc.apply({
        type: 'stroke:start',
        strokeId: 's1',
        style: defaultStyle,
        point: p,
        timestamp: Date.now()
      })
      const snapshot = doc.getSnapshot()
      // pendingStroke 不应在 completed strokes 中
      expect(snapshot.strokes.has('s1')).toBe(false)
    })

    it('apply stroke:addPoint 后 pendingStroke 增加点', () => {
      const doc = new StrokeDocument()
      const p1 = point(0.1, 0.2)
      const p2 = point(0.2, 0.3)
      doc.apply({
        type: 'stroke:start',
        strokeId: 's1',
        style: defaultStyle,
        point: p1,
        timestamp: Date.now()
      })
      doc.apply({
        type: 'stroke:addPoint',
        strokeId: 's1',
        point: p2
      })
      // 笔画尚未完成，不在 snapshot.strokes 中
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.has('s1')).toBe(false)
    })

    it('apply stroke:end 后 pendingStroke 转为 completed stroke', () => {
      const doc = new StrokeDocument()
      const p1 = point(0.1, 0.2)
      doc.apply({
        type: 'stroke:start',
        strokeId: 's1',
        style: defaultStyle,
        point: p1,
        timestamp: Date.now()
      })
      doc.apply({
        type: 'stroke:end',
        strokeId: 's1',
        timestamp: Date.now()
      })
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.has('s1')).toBe(true)
      expect(snapshot.strokeOrder).toContain('s1')
    })
  })

  describe('完整笔画流程', () => {
    it('一条完整笔画：start → addPoint x3 → end', () => {
      const doc = new StrokeDocument()
      const points = [
        point(0.1, 0.1),
        point(0.2, 0.2),
        point(0.3, 0.3),
        point(0.4, 0.4)
      ]
      const ops = createStrokeOps('s1', points)
      for (const op of ops) {
        doc.apply(op)
      }
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(1)
      const stroke = snapshot.strokes.get('s1')!
      expect(stroke.points).toHaveLength(4)
      expect(stroke.style).toEqual(defaultStyle)
    })

    it('两条连续笔画 → snapshot 包含 2 条笔画，strokeOrder 正确', () => {
      const doc = new StrokeDocument()
      const ops1 = createStrokeOps('s1', [point(0.1, 0.1), point(0.2, 0.2)])
      const ops2 = createStrokeOps('s2', [point(0.3, 0.3), point(0.4, 0.4)])
      for (const op of [...ops1, ...ops2]) {
        doc.apply(op)
      }
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(2)
      expect(snapshot.strokeOrder).toEqual(['s1', 's2'])
    })
  })

  describe('Undo/Redo', () => {
    it('1 条笔画后 undo → snapshot 为空', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1), point(0.2, 0.2)])
      for (const op of ops) {
        doc.apply(op)
      }
      doc.undo()
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(0)
      expect(snapshot.strokeOrder).toHaveLength(0)
    })

    it('undo 后 redo → 笔画恢复', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1), point(0.2, 0.2)])
      for (const op of ops) {
        doc.apply(op)
      }
      doc.undo()
      doc.redo()
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(1)
      expect(snapshot.strokes.has('s1')).toBe(true)
    })

    it('2 条笔画后 undo 一次 → 只剩 1 条', () => {
      const doc = new StrokeDocument()
      const ops1 = createStrokeOps('s1', [point(0.1, 0.1), point(0.2, 0.2)])
      const ops2 = createStrokeOps('s2', [point(0.3, 0.3), point(0.4, 0.4)])
      for (const op of [...ops1, ...ops2]) {
        doc.apply(op)
      }
      doc.undo()
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(1)
      expect(snapshot.strokes.has('s1')).toBe(true)
      expect(snapshot.strokes.has('s2')).toBe(false)
    })

    it('2 条笔画后 undo 两次 → 为空', () => {
      const doc = new StrokeDocument()
      const ops1 = createStrokeOps('s1', [point(0.1, 0.1), point(0.2, 0.2)])
      const ops2 = createStrokeOps('s2', [point(0.3, 0.3), point(0.4, 0.4)])
      for (const op of [...ops1, ...ops2]) {
        doc.apply(op)
      }
      doc.undo()
      doc.undo()
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(0)
    })

    it('undo 后 apply 新操作 → 截断 redo 历史', () => {
      const doc = new StrokeDocument()
      const ops1 = createStrokeOps('s1', [point(0.1, 0.1)])
      const ops2 = createStrokeOps('s2', [point(0.2, 0.2)])
      for (const op of [...ops1, ...ops2]) {
        doc.apply(op)
      }
      doc.undo()

      // 新操作
      const ops3 = createStrokeOps('s3', [point(0.3, 0.3)])
      for (const op of ops3) {
        doc.apply(op)
      }

      // redo 不应有效
      expect(doc.canRedo).toBe(false)
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(2)
      expect(snapshot.strokes.has('s1')).toBe(true)
      expect(snapshot.strokes.has('s3')).toBe(true)
      expect(snapshot.strokes.has('s2')).toBe(false)
    })

    it('无操作时 undo → canUndo 为 false，不报错', () => {
      const doc = new StrokeDocument()
      expect(doc.canUndo).toBe(false)
      expect(() => doc.undo()).not.toThrow()
    })

    it('无操作时 redo → canRedo 为 false，不报错', () => {
      const doc = new StrokeDocument()
      expect(doc.canRedo).toBe(false)
      expect(() => doc.redo()).not.toThrow()
    })
  })

  describe('clear 操作', () => {
    it('stroke:clear → snapshot 为空', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1), point(0.2, 0.2)])
      for (const op of ops) {
        doc.apply(op)
      }
      doc.apply({ type: 'stroke:clear', timestamp: Date.now() })
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(0)
      expect(snapshot.strokeOrder).toHaveLength(0)
    })

    it('clear 后 undo → 笔画恢复', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1), point(0.2, 0.2)])
      for (const op of ops) {
        doc.apply(op)
      }
      doc.apply({ type: 'stroke:clear', timestamp: Date.now() })
      doc.undo()
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(1)
      expect(snapshot.strokes.has('s1')).toBe(true)
    })
  })

  describe('delete 操作', () => {
    it('stroke:delete([id]) → 指定笔画被删除', () => {
      const doc = new StrokeDocument()
      const ops1 = createStrokeOps('s1', [point(0.1, 0.1)])
      const ops2 = createStrokeOps('s2', [point(0.2, 0.2)])
      for (const op of [...ops1, ...ops2]) {
        doc.apply(op)
      }
      doc.apply({ type: 'stroke:delete', strokeIds: ['s1'], timestamp: Date.now() })
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(1)
      expect(snapshot.strokes.has('s1')).toBe(false)
      expect(snapshot.strokes.has('s2')).toBe(true)
    })

    it('delete 后 undo → 笔画恢复', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1)])
      for (const op of ops) {
        doc.apply(op)
      }
      doc.apply({ type: 'stroke:delete', strokeIds: ['s1'], timestamp: Date.now() })
      doc.undo()
      const snapshot = doc.getSnapshot()
      expect(snapshot.strokes.size).toBe(1)
      expect(snapshot.strokes.has('s1')).toBe(true)
    })
  })

  describe('Checkpoint', () => {
    it('stroke:end 后 checkpoint 被创建', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1)])
      for (const op of ops) {
        doc.apply(op)
      }
      const checkpoints = doc.getCheckpoints()
      expect(checkpoints.length).toBeGreaterThanOrEqual(1)
    })

    it('checkpoint 数量与完成的笔画数一致', () => {
      const doc = new StrokeDocument()
      const ops1 = createStrokeOps('s1', [point(0.1, 0.1)])
      const ops2 = createStrokeOps('s2', [point(0.2, 0.2)])
      const ops3 = createStrokeOps('s3', [point(0.3, 0.3)])
      for (const op of [...ops1, ...ops2, ...ops3]) {
        doc.apply(op)
      }
      const checkpoints = doc.getCheckpoints()
      expect(checkpoints.length).toBe(3)
    })
  })

  describe('canUndo / canRedo 状态', () => {
    it('初始状态 canUndo=false, canRedo=false', () => {
      const doc = new StrokeDocument()
      expect(doc.canUndo).toBe(false)
      expect(doc.canRedo).toBe(false)
    })

    it('1 条笔画后 canUndo=true, canRedo=false', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1)])
      for (const op of ops) {
        doc.apply(op)
      }
      expect(doc.canUndo).toBe(true)
      expect(doc.canRedo).toBe(false)
    })

    it('undo 后 canUndo=false, canRedo=true', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1)])
      for (const op of ops) {
        doc.apply(op)
      }
      doc.undo()
      expect(doc.canUndo).toBe(false)
      expect(doc.canRedo).toBe(true)
    })
  })

  describe('operations 记录', () => {
    it('getOperations() 返回全部操作记录', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1), point(0.2, 0.2)])
      for (const op of ops) {
        doc.apply(op)
      }
      const allOps = doc.getOperations()
      expect(allOps).toHaveLength(ops.length)
    })

    it('操作顺序正确', () => {
      const doc = new StrokeDocument()
      const ops = createStrokeOps('s1', [point(0.1, 0.1), point(0.2, 0.2)])
      for (const op of ops) {
        doc.apply(op)
      }
      const allOps = doc.getOperations()
      expect(allOps[0].type).toBe('stroke:start')
      expect(allOps[1].type).toBe('stroke:addPoint')
      expect(allOps[allOps.length - 1].type).toBe('stroke:end')
    })
  })
})
