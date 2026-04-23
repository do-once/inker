import { describe, it, expect } from 'vitest'
import { SimpleJsonFormat } from '../formats/simple-json.format'
import type { Stroke } from '@inker/types'

function makeStroke(id: string, points: Array<{ x: number; y: number; t: number }>): Stroke {
  return {
    id,
    points: points.map(p => ({ ...p, p: 0.5 })),
    style: { type: 'pen', color: '#000', size: 2, opacity: 1 } as any,
    createdAt: points[0]?.t ?? 0
  }
}

describe('SimpleJsonFormat', () => {
  const format = new SimpleJsonFormat()

  it('name 属性为 simple-json', () => {
    expect(format.name).toBe('simple-json')
  })

  it('不带 toBBoxOrigin 选项时输出原始坐标', () => {
    const strokes = [makeStroke('s1', [
      { x: 100, y: 200, t: 0 },
      { x: 150, y: 250, t: 1 }
    ])]
    const result = format.convert(strokes)
    expect(result.strokes).toHaveLength(1)
    expect(result.strokes[0].id).toBe('s1')
    expect(result.strokes[0].points[0]).toEqual({ x: 100, y: 200, t: 0, p: 0.5 })
    expect(result.strokes[0].style).toEqual({ type: 'pen', color: '#000', size: 2 })
    expect(result.boundingBox).toBeNull()
  })

  it('带 toBBoxOrigin: true 时坐标平移到包围盒原点', () => {
    const strokes = [makeStroke('s1', [
      { x: 100, y: 200, t: 0 },
      { x: 150, y: 250, t: 1 }
    ])]
    const result = format.convert(strokes, { toBBoxOrigin: true })
    expect(result.strokes[0].points[0]).toEqual({ x: 0, y: 0, t: 0, p: 0.5 })
    expect(result.strokes[0].points[1]).toEqual({ x: 50, y: 50, t: 1, p: 0.5 })
    expect(result.boundingBox).not.toBeNull()
    expect(result.boundingBox!.minX).toBe(100)
    expect(result.boundingBox!.minY).toBe(200)
    expect(result.boundingBox!.width).toBe(50)
    expect(result.boundingBox!.height).toBe(50)
  })

  it('toBBoxOrigin: false 与不传等效', () => {
    const strokes = [makeStroke('s1', [{ x: 100, y: 200, t: 0 }])]
    const result = format.convert(strokes, { toBBoxOrigin: false })
    expect(result.strokes[0].points[0].x).toBe(100)
    expect(result.boundingBox).toBeNull()
  })

  it('多个笔画的联合输出', () => {
    const strokes = [
      makeStroke('s1', [{ x: 10, y: 20, t: 0 }]),
      makeStroke('s2', [{ x: 50, y: 60, t: 1 }])
    ]
    const result = format.convert(strokes, { toBBoxOrigin: true })
    expect(result.strokes).toHaveLength(2)
    expect(result.strokes[0].points[0]).toEqual({ x: 0, y: 0, t: 0, p: 0.5 })
    expect(result.strokes[1].points[0]).toEqual({ x: 40, y: 40, t: 1, p: 0.5 })
  })

  it('style 只保留 type/color/size 三个字段', () => {
    const strokes = [makeStroke('s1', [{ x: 0, y: 0, t: 0 }])]
    const result = format.convert(strokes)
    expect(Object.keys(result.strokes[0].style)).toEqual(['type', 'color', 'size'])
  })

  it('空数组返回空结果', () => {
    const result = format.convert([])
    expect(result.strokes).toHaveLength(0)
    expect(result.boundingBox).toBeNull()
  })
})
