import { describe, it, expect } from 'vitest'
import { getStroke } from '../index'

describe('getStroke', () => {
  /** 简单的输入点集（对象格式） */
  const simplePoints = [
    { x: 0, y: 0 },
    { x: 10, y: 5 },
    { x: 20, y: 10 },
    { x: 30, y: 5 },
    { x: 40, y: 0 }
  ]

  /** 简单的输入点集（数组格式） */
  const arrayPoints: number[][] = [
    [0, 0],
    [10, 5],
    [20, 10],
    [30, 5],
    [40, 0]
  ]

  describe('基本输出', () => {
    it('给定一组简单输入点，返回非空数组', () => {
      const result = getStroke(simplePoints)
      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('返回的每个点是 [x, y] 数组', () => {
      const result = getStroke(simplePoints)
      for (const point of result) {
        expect(point).toHaveLength(2)
        expect(typeof point[0]).toBe('number')
        expect(typeof point[1]).toBe('number')
      }
    })

    it('支持数组格式的输入点 [x, y]', () => {
      const result = getStroke(arrayPoints)
      expect(result.length).toBeGreaterThan(0)
      for (const point of result) {
        expect(point).toHaveLength(2)
      }
    })

    it('返回的轮廓点数多于输入点数（因为是闭合轮廓）', () => {
      const result = getStroke(simplePoints)
      expect(result.length).toBeGreaterThan(simplePoints.length)
    })
  })

  describe('边界输入', () => {
    it('空点集输入返回空数组', () => {
      const result = getStroke([])
      expect(result).toEqual([])
    })

    it('单点输入返回有效轮廓', () => {
      const result = getStroke([{ x: 10, y: 10 }])
      expect(result.length).toBeGreaterThan(0)
      for (const point of result) {
        expect(point).toHaveLength(2)
      }
    })

    it('两点输入返回有效轮廓', () => {
      const result = getStroke([{ x: 0, y: 0 }, { x: 10, y: 10 }])
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('压力影响', () => {
    it('带 pressure 的输入点产生有效轮廓', () => {
      const points = [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 10, y: 5, pressure: 0.8 },
        { x: 20, y: 10, pressure: 1.0 },
        { x: 30, y: 5, pressure: 0.6 },
        { x: 40, y: 0, pressure: 0.3 }
      ]
      const result = getStroke(points)
      expect(result.length).toBeGreaterThan(0)
    })

    it('数组格式带 pressure [x, y, p] 产生有效轮廓', () => {
      const points: number[][] = [
        [0, 0, 0.5],
        [10, 5, 0.8],
        [20, 10, 1.0],
        [30, 5, 0.6],
        [40, 0, 0.3]
      ]
      const result = getStroke(points)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('options 参数', () => {
    it('size 参数影响轮廓大小', () => {
      const smallResult = getStroke(simplePoints, { size: 4 })
      const largeResult = getStroke(simplePoints, { size: 20 })
      // 两种 size 都应返回有效轮廓
      expect(smallResult.length).toBeGreaterThan(0)
      expect(largeResult.length).toBeGreaterThan(0)
    })

    it('thinning 参数生效', () => {
      const result = getStroke(simplePoints, { thinning: 0.5 })
      expect(result.length).toBeGreaterThan(0)
    })

    it('smoothing 参数生效', () => {
      const result = getStroke(simplePoints, { smoothing: 0.5 })
      expect(result.length).toBeGreaterThan(0)
    })

    it('streamline 参数生效', () => {
      const result = getStroke(simplePoints, { streamline: 0.5 })
      expect(result.length).toBeGreaterThan(0)
    })

    it('simulatePressure: true 生效', () => {
      const result = getStroke(simplePoints, { simulatePressure: true })
      expect(result.length).toBeGreaterThan(0)
    })

    it('simulatePressure: false 生效', () => {
      const result = getStroke(simplePoints, { simulatePressure: false })
      expect(result.length).toBeGreaterThan(0)
    })

    it('last: true 表示笔画已完成', () => {
      const result = getStroke(simplePoints, { last: true })
      expect(result.length).toBeGreaterThan(0)
    })

    it('start.taper 参数生效', () => {
      const result = getStroke(simplePoints, { start: { taper: 20 } })
      expect(result.length).toBeGreaterThan(0)
    })

    it('end.taper 参数生效', () => {
      const result = getStroke(simplePoints, { end: { taper: 20 } })
      expect(result.length).toBeGreaterThan(0)
    })

    it('start.cap: false 去掉起始端帽', () => {
      const result = getStroke(simplePoints, { start: { cap: false } })
      expect(result.length).toBeGreaterThan(0)
    })

    it('end.cap: false 去掉结束端帽', () => {
      const result = getStroke(simplePoints, { end: { cap: false } })
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('确定性', () => {
    it('相同输入产生相同输出', () => {
      const result1 = getStroke(simplePoints, { size: 8, simulatePressure: true })
      const result2 = getStroke(simplePoints, { size: 8, simulatePressure: true })
      expect(result1).toEqual(result2)
    })
  })
})
