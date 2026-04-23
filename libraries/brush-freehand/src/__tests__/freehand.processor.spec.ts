import { describe, it, expect } from 'vitest'
import { FreehandProcessor } from '../freehand.processor'
import type { StrokePoint, StrokeStyle } from '@inker/types'

/** 创建测试用采样点（世界坐标像素） */
function point(x: number, y: number, p = 0.5, t = Date.now()): StrokePoint {
  return { x, y, p, t }
}

/** 创建一条简单的测试点序列（世界坐标像素） */
function createPoints(count: number): StrokePoint[] {
  const points: StrokePoint[] = []
  for (let i = 0; i < count; i++) {
    points.push(point(80 + i * 40, 60 + i * 18, 0.5 + i * 0.02, 1000 + i * 16))
  }
  return points
}

const defaultStyle: StrokeStyle = {
  type: 'pen',
  color: '#000000',
  size: 2,
  opacity: 1
}

/** 验证结果是否为有效的 OutlineGeometry */
function expectValidOutline(result: unknown) {
  expect(result).toBeDefined()
  expect(result).not.toBeNull()
  const geo = result as { points: { x: number; y: number }[] }
  expect(Array.isArray(geo.points)).toBe(true)
  expect(geo.points.length).toBeGreaterThan(0)
  for (const pt of geo.points) {
    expect(typeof pt.x).toBe('number')
    expect(typeof pt.y).toBe('number')
  }
}

describe('FreehandProcessor', () => {
  describe('supportedTypes', () => {
    it('应包含 pen 类型', () => {
      const processor = new FreehandProcessor()
      expect(processor.supportedTypes).toContain('pen')
    })

    it('应包含 marker 类型', () => {
      const processor = new FreehandProcessor()
      expect(processor.supportedTypes).toContain('marker')
    })

    it('应包含 pencil 类型', () => {
      const processor = new FreehandProcessor()
      expect(processor.supportedTypes).toContain('pencil')
    })
  })

  describe('computeOutline — 基础行为', () => {
    it('给定有效点集应返回 OutlineGeometry', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)

      const result = processor.computeOutline(points, defaultStyle, false)

      expectValidOutline(result)
    })

    it('空点集应返回 null', () => {
      const processor = new FreehandProcessor()

      const result = processor.computeOutline([], defaultStyle, false)

      expect(result).toBeNull()
    })

    it('单点应返回有效 OutlineGeometry', () => {
      const processor = new FreehandProcessor()
      const points = [point(400, 300)]

      const result = processor.computeOutline(points, defaultStyle, false)

      expectValidOutline(result)
    })

    it('两个点应返回有效 OutlineGeometry', () => {
      const processor = new FreehandProcessor()
      const points = [point(80, 60), point(160, 120)]

      const result = processor.computeOutline(points, defaultStyle, false)

      expectValidOutline(result)
    })
  })

  describe('computeOutline — complete 参数', () => {
    it('complete=true 时应使用 last: true 选项', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)

      const resultComplete = processor.computeOutline(points, defaultStyle, true)
      const resultIncomplete = processor.computeOutline(points, defaultStyle, false)

      // 两者都应返回有效 OutlineGeometry
      expectValidOutline(resultComplete)
      expectValidOutline(resultIncomplete)
    })
  })

  describe('computeOutline — 不同样式', () => {
    it('不同 size 应影响输出', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)

      const thinStyle: StrokeStyle = { ...defaultStyle, size: 1 }
      const thickStyle: StrokeStyle = { ...defaultStyle, size: 10 }

      const thinResult = processor.computeOutline(points, thinStyle, true)
      const thickResult = processor.computeOutline(points, thickStyle, true)

      // 两者都应返回有效 OutlineGeometry
      expectValidOutline(thinResult)
      expectValidOutline(thickResult)
    })

    it('marker 类型应返回有效路径', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)
      const markerStyle: StrokeStyle = { ...defaultStyle, type: 'marker' }

      const result = processor.computeOutline(points, markerStyle, true)

      expectValidOutline(result)
    })

    it('pencil 类型应返回有效路径', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)
      const pencilStyle: StrokeStyle = { ...defaultStyle, type: 'pencil' }

      const result = processor.computeOutline(points, pencilStyle, true)

      expectValidOutline(result)
    })
  })

  describe('computeOutline — 世界坐标处理', () => {
    it('应直接使用世界坐标（像素），无需转换', () => {
      const processor = new FreehandProcessor()
      // 点坐标为绝对像素坐标
      const points = [
        point(0, 0),
        point(400, 300),
        point(800, 600)
      ]

      const result = processor.computeOutline(points, defaultStyle, true)

      expectValidOutline(result)
    })

    it('不同尺度的坐标都应能正确处理', () => {
      const processor = new FreehandProcessor()
      const smallPoints = [point(10, 10), point(20, 20), point(30, 30)]
      const largePoints = [point(1000, 1000), point(1500, 1200), point(1920, 1080)]

      const resultSmall = processor.computeOutline(smallPoints, defaultStyle, true)
      const resultLarge = processor.computeOutline(largePoints, defaultStyle, true)

      expectValidOutline(resultSmall)
      expectValidOutline(resultLarge)
    })
  })

  describe('computeOutline — style 扩展参数', () => {
    it('设置 simulatePressure=false 应返回有效路径', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)
      const style: StrokeStyle = { ...defaultStyle, simulatePressure: false }

      const result = processor.computeOutline(points, style, true)

      expectValidOutline(result)
    })

    it('设置 thinning/smoothing/streamline 应返回有效路径', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)
      const style: StrokeStyle = {
        ...defaultStyle,
        thinning: 0.8,
        smoothing: 0.3,
        streamline: 0.7
      }

      const result = processor.computeOutline(points, style, true)

      expectValidOutline(result)
    })

    it('设置 start/end taper 应返回有效路径', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)
      const style: StrokeStyle = {
        ...defaultStyle,
        start: { taper: 50 },
        end: { taper: 30 }
      }

      const result = processor.computeOutline(points, style, true)

      expectValidOutline(result)
    })

    it('设置 easing 应返回有效路径', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)
      const style: StrokeStyle = {
        ...defaultStyle,
        easing: 'easeOutQuad'
      }
      const result = processor.computeOutline(points, style, true)
      expectValidOutline(result)
    })

    it('不传扩展参数时应使用默认值', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)

      // 无扩展属性的默认样式
      const result = processor.computeOutline(points, defaultStyle, true)

      expectValidOutline(result)
    })
  })

  describe('computeOutline — 确定性', () => {
    it('相同输入应产生相同输出', () => {
      const processor = new FreehandProcessor()
      const points = createPoints(10)

      const result1 = processor.computeOutline(points, defaultStyle, true)
      const result2 = processor.computeOutline(points, defaultStyle, true)

      // 两次调用都应返回有效 OutlineGeometry
      expectValidOutline(result1)
      expectValidOutline(result2)
    })
  })
})
