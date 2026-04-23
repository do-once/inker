import { describe, it, expect } from 'vitest'
import { groupByTime } from '../group-by-time'
import type { Stroke } from '@inker/types'

function makeStroke(id: string, points: Array<{ x: number; y: number; t: number }>): Stroke {
  return {
    id,
    points: points.map(p => ({ ...p, p: 0.5 })),
    style: { type: 'pen', color: '#000', size: 2, opacity: 1 } as any,
    createdAt: points[0]?.t ?? 0
  }
}

describe('groupByTime', () => {
  it('单个笔画形成一个组', () => {
    const strokes = [makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 150 }])]
    const groups = groupByTime(strokes, 500)
    expect(groups).toHaveLength(1)
    expect(groups[0].strokes).toHaveLength(1)
    expect(groups[0].startTime).toBe(100)
    expect(groups[0].endTime).toBe(150)
  })

  it('时间间隔小于 gapMs 的连续笔画归为一组', () => {
    const strokes = [
      makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }]),
      makeStroke('s2', [{ x: 20, y: 20, t: 500 }, { x: 30, y: 30, t: 600 }])
    ]
    const groups = groupByTime(strokes, 500)
    expect(groups).toHaveLength(1)
    expect(groups[0].strokes).toHaveLength(2)
  })

  it('时间间隔大于等于 gapMs 的笔画分为不同组', () => {
    const strokes = [
      makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }]),
      makeStroke('s2', [{ x: 20, y: 20, t: 800 }, { x: 30, y: 30, t: 900 }])
    ]
    const groups = groupByTime(strokes, 500)
    expect(groups).toHaveLength(2)
    expect(groups[0].strokes[0].id).toBe('s1')
    expect(groups[1].strokes[0].id).toBe('s2')
  })

  it('三个笔画分为两组', () => {
    const strokes = [
      makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }]),
      makeStroke('s2', [{ x: 20, y: 20, t: 400 }, { x: 30, y: 30, t: 500 }]),
      makeStroke('s3', [{ x: 50, y: 50, t: 1500 }, { x: 60, y: 60, t: 1600 }])
    ]
    const groups = groupByTime(strokes, 500)
    expect(groups).toHaveLength(2)
    expect(groups[0].strokes).toHaveLength(2)
    expect(groups[1].strokes).toHaveLength(1)
  })

  it('时间间隔恰好等于 gapMs 时分为不同组', () => {
    const strokes = [
      makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }]),
      makeStroke('s2', [{ x: 20, y: 20, t: 700 }, { x: 30, y: 30, t: 800 }])
    ]
    // gap = 700 - 200 = 500 == gapMs
    const groups = groupByTime(strokes, 500)
    expect(groups).toHaveLength(2)
  })

  it('空数组返回空数组', () => {
    expect(groupByTime([], 500)).toHaveLength(0)
  })

  it('笔画组的 startTime/endTime 基于点的时间戳', () => {
    const strokes = [
      makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }]),
      makeStroke('s2', [{ x: 20, y: 20, t: 300 }, { x: 30, y: 30, t: 400 }])
    ]
    const groups = groupByTime(strokes, 500)
    expect(groups[0].startTime).toBe(100)
    expect(groups[0].endTime).toBe(400)
  })
})
