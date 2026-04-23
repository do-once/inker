import { describe, it, expect } from 'vitest'
import { distance, toNormalized, fromNormalized, computeBBox, translateToBBoxOrigin } from '../geometry.util'
import type { Stroke } from '@inker/types'

describe('distance', () => {
  it('计算两个相同点的距离为 0', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
  })

  it('计算水平距离', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3)
  })

  it('计算垂直距离', () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(4)
  })

  it('计算经典 3-4-5 直角三角形斜边', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('计算负坐标之间的距离', () => {
    expect(distance({ x: -1, y: -1 }, { x: 2, y: 3 })).toBe(5)
  })

  it('参数顺序不影响结果（对称性）', () => {
    const p1 = { x: 1, y: 2 }
    const p2 = { x: 4, y: 6 }
    expect(distance(p1, p2)).toBe(distance(p2, p1))
  })

  it('浮点坐标的距离计算', () => {
    const result = distance({ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.6 })
    expect(result).toBeCloseTo(0.5, 5)
  })
})

describe('toNormalized', () => {
  it('将世界坐标归一化到 0-1 范围', () => {
    const result = toNormalized({ x: 500, y: 300 }, { width: 1000, height: 600 })
    expect(result.x).toBeCloseTo(0.5)
    expect(result.y).toBeCloseTo(0.5)
  })

  it('左上角归一化为 (0, 0)', () => {
    const result = toNormalized({ x: 0, y: 0 }, { width: 1920, height: 1080 })
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('右下角归一化为 (1, 1)', () => {
    const result = toNormalized({ x: 1920, y: 1080 }, { width: 1920, height: 1080 })
    expect(result.x).toBeCloseTo(1)
    expect(result.y).toBeCloseTo(1)
  })

  it('非整数坐标的归一化', () => {
    const result = toNormalized({ x: 123.456, y: 789.012 }, { width: 1000, height: 1000 })
    expect(result.x).toBeCloseTo(0.123456)
    expect(result.y).toBeCloseTo(0.789012)
  })
})

describe('fromNormalized', () => {
  it('将归一化坐标还原为世界坐标', () => {
    const result = fromNormalized({ x: 0.5, y: 0.5 }, { width: 1000, height: 600 })
    expect(result.x).toBeCloseTo(500)
    expect(result.y).toBeCloseTo(300)
  })

  it('(0, 0) 还原为左上角', () => {
    const result = fromNormalized({ x: 0, y: 0 }, { width: 1920, height: 1080 })
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('(1, 1) 还原为右下角', () => {
    const result = fromNormalized({ x: 1, y: 1 }, { width: 1920, height: 1080 })
    expect(result.x).toBeCloseTo(1920)
    expect(result.y).toBeCloseTo(1080)
  })

  it('归一化和反归一化互逆', () => {
    const original = { x: 345, y: 678 }
    const size = { width: 1000, height: 1000 }
    const normalized = toNormalized(original, size)
    const restored = fromNormalized(normalized, size)
    expect(restored.x).toBeCloseTo(original.x)
    expect(restored.y).toBeCloseTo(original.y)
  })

  it('不同尺寸下的反归一化结果不同', () => {
    const point = { x: 0.5, y: 0.5 }
    const result1 = fromNormalized(point, { width: 1000, height: 1000 })
    const result2 = fromNormalized(point, { width: 2000, height: 2000 })
    expect(result2.x).toBe(result1.x * 2)
    expect(result2.y).toBe(result1.y * 2)
  })
})

describe('边界值测试', () => {
  it('距离为 0 的相邻点', () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0)
  })

  it('极大坐标的距离计算', () => {
    const result = distance({ x: 0, y: 0 }, { x: 1e6, y: 1e6 })
    expect(result).toBeCloseTo(Math.sqrt(2) * 1e6)
  })

  it('归一化宽高为 1 时坐标不变', () => {
    const result = toNormalized({ x: 0.5, y: 0.3 }, { width: 1, height: 1 })
    expect(result.x).toBeCloseTo(0.5)
    expect(result.y).toBeCloseTo(0.3)
  })

  it('反归一化宽高为 1 时坐标不变', () => {
    const result = fromNormalized({ x: 0.5, y: 0.3 }, { width: 1, height: 1 })
    expect(result.x).toBeCloseTo(0.5)
    expect(result.y).toBeCloseTo(0.3)
  })
})

describe('computeBBox', () => {
  it('计算单个笔画的包围盒', () => {
    const stroke = {
      id: 's1',
      points: [
        { x: 10, y: 20, t: 0, p: 0.5 },
        { x: 50, y: 80, t: 1, p: 0.5 },
        { x: 30, y: 5, t: 2, p: 0.5 }
      ],
      style: {} as any,
      createdAt: 0
    }
    const box = computeBBox([stroke])
    expect(box.minX).toBe(10)
    expect(box.minY).toBe(5)
    expect(box.maxX).toBe(50)
    expect(box.maxY).toBe(80)
    expect(box.width).toBe(40)
    expect(box.height).toBe(75)
  })

  it('计算多个笔画的联合包围盒', () => {
    const stroke1 = {
      id: 's1',
      points: [
        { x: 0, y: 0, t: 0, p: 0.5 },
        { x: 10, y: 10, t: 1, p: 0.5 }
      ],
      style: {} as any,
      createdAt: 0
    }
    const stroke2 = {
      id: 's2',
      points: [
        { x: 20, y: 5, t: 0, p: 0.5 },
        { x: 30, y: 40, t: 1, p: 0.5 }
      ],
      style: {} as any,
      createdAt: 0
    }
    const box = computeBBox([stroke1, stroke2])
    expect(box.minX).toBe(0)
    expect(box.minY).toBe(0)
    expect(box.maxX).toBe(30)
    expect(box.maxY).toBe(40)
    expect(box.width).toBe(30)
    expect(box.height).toBe(40)
  })

  it('空笔画数组返回零包围盒', () => {
    const box = computeBBox([])
    expect(box.minX).toBe(0)
    expect(box.minY).toBe(0)
    expect(box.maxX).toBe(0)
    expect(box.maxY).toBe(0)
    expect(box.width).toBe(0)
    expect(box.height).toBe(0)
  })

  it('单个点的包围盒 width/height 为 0', () => {
    const stroke = {
      id: 's1',
      points: [{ x: 42, y: 99, t: 0, p: 0.5 }],
      style: {} as any,
      createdAt: 0
    }
    const box = computeBBox([stroke])
    expect(box.minX).toBe(42)
    expect(box.minY).toBe(99)
    expect(box.maxX).toBe(42)
    expect(box.maxY).toBe(99)
    expect(box.width).toBe(0)
    expect(box.height).toBe(0)
  })
})

function makeStroke(id: string, points: Array<{ x: number; y: number; t: number }>): Stroke {
  return {
    id,
    points: points.map(p => ({ ...p, p: 0.5 })),
    style: { type: 'pen', color: '#000', size: 2, opacity: 1 } as any,
    createdAt: points[0]?.t ?? 0
  }
}

describe('translateToBBoxOrigin', () => {
  it('将笔画坐标平移到包围盒左上角为原点', () => {
    const strokes = [makeStroke('s1', [
      { x: 100, y: 200, t: 0 },
      { x: 150, y: 250, t: 1 },
      { x: 120, y: 210, t: 2 }
    ])]
    const result = translateToBBoxOrigin(strokes)
    expect(result[0].points[0].x).toBe(0)
    expect(result[0].points[0].y).toBe(0)
    expect(result[0].points[1].x).toBe(50)
    expect(result[0].points[1].y).toBe(50)
    expect(result[0].points[2].x).toBe(20)
    expect(result[0].points[2].y).toBe(10)
  })

  it('多个笔画基于联合包围盒平移', () => {
    const strokes = [
      makeStroke('s1', [{ x: 50, y: 100, t: 0 }]),
      makeStroke('s2', [{ x: 100, y: 200, t: 1 }])
    ]
    const result = translateToBBoxOrigin(strokes)
    expect(result[0].points[0].x).toBe(0)
    expect(result[0].points[0].y).toBe(0)
    expect(result[1].points[0].x).toBe(50)
    expect(result[1].points[0].y).toBe(100)
  })

  it('保留原始笔画的其他属性', () => {
    const strokes = [makeStroke('s1', [{ x: 10, y: 20, t: 42 }])]
    const result = translateToBBoxOrigin(strokes)
    expect(result[0].id).toBe('s1')
    expect(result[0].points[0].t).toBe(42)
    expect(result[0].points[0].p).toBe(0.5)
    expect(result[0].createdAt).toBe(42)
  })

  it('空数组返回空数组', () => {
    expect(translateToBBoxOrigin([])).toEqual([])
  })

  it('已在原点的笔画不变', () => {
    const strokes = [makeStroke('s1', [{ x: 0, y: 0, t: 0 }, { x: 10, y: 20, t: 1 }])]
    const result = translateToBBoxOrigin(strokes)
    expect(result[0].points[0].x).toBe(0)
    expect(result[0].points[0].y).toBe(0)
    expect(result[0].points[1].x).toBe(10)
    expect(result[0].points[1].y).toBe(20)
  })

  it('不修改原始输入（不可变）', () => {
    const strokes = [makeStroke('s1', [{ x: 100, y: 200, t: 0 }])]
    translateToBBoxOrigin(strokes)
    expect(strokes[0].points[0].x).toBe(100)
    expect(strokes[0].points[0].y).toBe(200)
  })
})
