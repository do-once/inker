import { describe, it, expect } from 'vitest'
import { PointExtractor } from '../point-extractor.service'

describe('PointExtractor', () => {
  describe('extract — 从 PointerEvent 提取坐标', () => {
    it('应从 PointerEvent 中提取 x, y, pressure', () => {
      const extractor = new PointExtractor()
      const event = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 200,
        pressure: 0.5
      })

      const result = extractor.extract(event, { left: 10, top: 20 })

      expect(result).toEqual({
        x: 90,
        y: 180,
        pressure: 0.5
      })
    })

    it('应正确减去容器偏移量', () => {
      const extractor = new PointExtractor()
      const event = new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 400,
        pressure: 0.8
      })

      const result = extractor.extract(event, { left: 50, top: 100 })

      expect(result!.x).toBe(250)
      expect(result!.y).toBe(300)
    })

    it('pressure 为 0 时应保留为 0', () => {
      const extractor = new PointExtractor()
      const event = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        pressure: 0
      })

      const result = extractor.extract(event, { left: 0, top: 0 })

      expect(result!.pressure).toBe(0)
    })
  })

  describe('filterDuplicate — 点去重', () => {
    it('第一个点不应被过滤', () => {
      const extractor = new PointExtractor()
      const point = { x: 100, y: 200, pressure: 0.5 }

      const result = extractor.filterDuplicate(point, 2)

      expect(result).toBe(true)
    })

    it('连续相同坐标的点应被过滤', () => {
      const extractor = new PointExtractor()
      const point1 = { x: 100, y: 200, pressure: 0.5 }
      const point2 = { x: 100, y: 200, pressure: 0.6 }

      extractor.filterDuplicate(point1, 2)
      const result = extractor.filterDuplicate(point2, 2)

      expect(result).toBe(false)
    })

    it('坐标差值超过阈值的点不应被过滤', () => {
      const extractor = new PointExtractor()
      const point1 = { x: 100, y: 200, pressure: 0.5 }
      const point2 = { x: 110, y: 200, pressure: 0.6 }

      extractor.filterDuplicate(point1, 2)
      const result = extractor.filterDuplicate(point2, 2)

      expect(result).toBe(true)
    })

    it('笔宽越大去重阈值越大', () => {
      const extractor = new PointExtractor()
      const point1 = { x: 100, y: 200, pressure: 0.5 }
      // 小偏移量：对细笔宽应通过，对粗笔宽应被过滤
      const point2 = { x: 103, y: 200, pressure: 0.5 }

      // 细笔宽（width=1）：delta = 1 + min(1^0.75, 8) = 2，偏移 3 >= 2，通过
      extractor.filterDuplicate(point1, 1)
      const thinResult = extractor.filterDuplicate(point2, 1)
      expect(thinResult).toBe(true)

      // 重置
      const extractor2 = new PointExtractor()
      // 粗笔宽（width=20）：delta = 1 + min(20^0.75, 8) = 1 + min(9.46, 8) ≈ 9，偏移 3 < 9，过滤
      extractor2.filterDuplicate(point1, 20)
      const thickResult = extractor2.filterDuplicate(point2, 20)
      expect(thickResult).toBe(false)
    })

    it('delta 计算公式：1 + min(width^0.75, 8)', () => {
      const extractor = new PointExtractor()
      const point1 = { x: 0, y: 0, pressure: 0.5 }

      extractor.filterDuplicate(point1, 4)

      // width=4, delta = 1 + min(4^0.75, 8) = 1 + min(2.83, 8) ≈ 3.83
      // x 偏移 3 < 3.83，应被过滤
      const pointClose = { x: 3, y: 0, pressure: 0.5 }
      expect(extractor.filterDuplicate(pointClose, 4)).toBe(false)

      // x 偏移 4 >= 3.83，应通过
      const pointFar = { x: 4, y: 0, pressure: 0.5 }
      expect(extractor.filterDuplicate(pointFar, 4)).toBe(true)
    })
  })

  describe('边界情况', () => {
    it('NaN 坐标应被标记为无效', () => {
      const extractor = new PointExtractor()
      const event = new PointerEvent('pointermove', {
        clientX: NaN,
        clientY: 100,
        pressure: 0.5
      })

      const result = extractor.extract(event, { left: 0, top: 0 })

      expect(result).toBeNull()
    })

    it('Infinity 坐标应被标记为无效', () => {
      const extractor = new PointExtractor()
      const event = new PointerEvent('pointermove', {
        clientX: Infinity,
        clientY: 100,
        pressure: 0.5
      })

      const result = extractor.extract(event, { left: 0, top: 0 })

      expect(result).toBeNull()
    })

    it('负 Infinity 坐标应被标记为无效', () => {
      const extractor = new PointExtractor()
      const event = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: -Infinity,
        pressure: 0.5
      })

      const result = extractor.extract(event, { left: 0, top: 0 })

      expect(result).toBeNull()
    })
  })
})
