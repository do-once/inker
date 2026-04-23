import { describe, it, expect } from 'vitest'
import { StrokeSession } from '../stroke-session'
import type { StrokePoint } from '@inker/types'

function point(x: number, y: number, t = 0, p = 0.5): StrokePoint {
  return { x, y, t, p }
}

describe('StrokeSession', () => {
  it('构造时应正确存储 strokeId 和首点', () => {
    const session = new StrokeSession('stroke-001', point(10, 20, 100), 100)
    expect(session.strokeId).toBe('stroke-001')
    expect(session.getPoints()).toEqual([point(10, 20, 100)])
    expect(session.pointCount).toBe(1)
  })

  it('addPoint 应追加到点序列', () => {
    const session = new StrokeSession('s1', point(0, 0), 0)
    session.addPoint(point(10, 10, 16))
    session.addPoint(point(20, 20, 32))
    expect(session.pointCount).toBe(3)
    expect(session.getPoints()).toHaveLength(3)
  })

  it('getPoints 返回的数组不影响内部状态', () => {
    const session = new StrokeSession('s1', point(0, 0), 0)
    const pts = session.getPoints()
    ;(pts as StrokePoint[]).push(point(99, 99))
    expect(session.pointCount).toBe(1)
  })

  it('getLastPoint 应返回最后一个点', () => {
    const session = new StrokeSession('s1', point(0, 0), 0)
    expect(session.getLastPoint()).toEqual(point(0, 0))
    session.addPoint(point(5, 5, 10))
    expect(session.getLastPoint()).toEqual(point(5, 5, 10))
  })

  it('startTimestamp 应返回构造时的时间戳', () => {
    const session = new StrokeSession('s1', point(0, 0), 42)
    expect(session.startTimestamp).toBe(42)
  })
})
