import { describe, it, expect } from 'vitest'
import { SnapshotBuilder } from '../snapshot-builder.service'
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

describe('SnapshotBuilder', () => {
  it('空操作列表 → 空 snapshot', () => {
    const snapshot = SnapshotBuilder.build([])
    expect(snapshot.strokes.size).toBe(0)
    expect(snapshot.strokeOrder).toHaveLength(0)
  })

  it('一条完整笔画的操作序列 → 正确 snapshot', () => {
    const ops = createStrokeOps('s1', [
      point(0.1, 0.1),
      point(0.2, 0.2),
      point(0.3, 0.3)
    ])
    const snapshot = SnapshotBuilder.build(ops)
    expect(snapshot.strokes.size).toBe(1)
    const stroke = snapshot.strokes.get('s1')!
    expect(stroke.points).toHaveLength(3)
    expect(stroke.style).toEqual(defaultStyle)
    expect(snapshot.strokeOrder).toEqual(['s1'])
  })

  it('多条笔画 → strokeOrder 顺序正确', () => {
    const ops1 = createStrokeOps('s1', [point(0.1, 0.1)])
    const ops2 = createStrokeOps('s2', [point(0.2, 0.2)])
    const ops3 = createStrokeOps('s3', [point(0.3, 0.3)])
    const snapshot = SnapshotBuilder.build([...ops1, ...ops2, ...ops3])
    expect(snapshot.strokeOrder).toEqual(['s1', 's2', 's3'])
    expect(snapshot.strokes.size).toBe(3)
  })

  it('包含 delete 操作 → 对应笔画被移除', () => {
    const ops1 = createStrokeOps('s1', [point(0.1, 0.1)])
    const ops2 = createStrokeOps('s2', [point(0.2, 0.2)])
    const deleteOp: Operation = {
      type: 'stroke:delete',
      strokeIds: ['s1'],
      timestamp: Date.now()
    }
    const snapshot = SnapshotBuilder.build([...ops1, ...ops2, deleteOp])
    expect(snapshot.strokes.size).toBe(1)
    expect(snapshot.strokes.has('s1')).toBe(false)
    expect(snapshot.strokes.has('s2')).toBe(true)
    expect(snapshot.strokeOrder).toEqual(['s2'])
  })

  it('包含 clear 操作 → snapshot 为空', () => {
    const ops1 = createStrokeOps('s1', [point(0.1, 0.1)])
    const ops2 = createStrokeOps('s2', [point(0.2, 0.2)])
    const clearOp: Operation = {
      type: 'stroke:clear',
      timestamp: Date.now()
    }
    const snapshot = SnapshotBuilder.build([...ops1, ...ops2, clearOp])
    expect(snapshot.strokes.size).toBe(0)
    expect(snapshot.strokeOrder).toHaveLength(0)
  })

  it('从 checkpoint 增量重建与全量重建结果一致', () => {
    const ops1 = createStrokeOps('s1', [point(0.1, 0.1)])
    const ops2 = createStrokeOps('s2', [point(0.2, 0.2)])
    const ops3 = createStrokeOps('s3', [point(0.3, 0.3)])
    const allOps = [...ops1, ...ops2, ...ops3]

    // 全量重建
    const fullSnapshot = SnapshotBuilder.build(allOps)

    // 从 checkpoint（前两条笔画的 snapshot）增量重建
    const checkpointOps = [...ops1, ...ops2]
    const checkpoint = SnapshotBuilder.build(checkpointOps)
    const incrementalSnapshot = SnapshotBuilder.buildFromCheckpoint(checkpoint, ops3)

    expect(incrementalSnapshot.strokes.size).toBe(fullSnapshot.strokes.size)
    expect(incrementalSnapshot.strokeOrder).toEqual(fullSnapshot.strokeOrder)
  })
})
