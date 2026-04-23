import { describe, it, expect } from 'vitest'
import { CoordinateSystem } from '../coordinate-system.service'

describe('CoordinateSystem', () => {
  describe('screenToWorld', () => {
    it('zoom=1, offset=0 时屏幕坐标等于世界坐标', () => {
      const cs = new CoordinateSystem(1000, 600)
      cs.setCamera({ x: 0, y: 0, zoom: 1 })
      const result = cs.screenToWorld({ x: 500, y: 300 })
      expect(result.x).toBeCloseTo(500)
      expect(result.y).toBeCloseTo(300)
    })

    it('zoom=2 时屏幕坐标 → 世界坐标缩小一半', () => {
      const cs = new CoordinateSystem(1000, 600)
      cs.setCamera({ x: 0, y: 0, zoom: 2 })
      const result = cs.screenToWorld({ x: 400, y: 200 })
      expect(result.x).toBeCloseTo(200)
      expect(result.y).toBeCloseTo(100)
    })

    it('有偏移时应加上 camera offset', () => {
      const cs = new CoordinateSystem(1000, 600)
      cs.setCamera({ x: 100, y: 50, zoom: 1 })
      const result = cs.screenToWorld({ x: 200, y: 150 })
      expect(result.x).toBeCloseTo(300)
      expect(result.y).toBeCloseTo(200)
    })

    it('左上角 (0, 0) 映射到 camera 位置', () => {
      const cs = new CoordinateSystem(1000, 600)
      cs.setCamera({ x: 100, y: 200, zoom: 1 })
      const result = cs.screenToWorld({ x: 0, y: 0 })
      expect(result.x).toBeCloseTo(100)
      expect(result.y).toBeCloseTo(200)
    })
  })

  describe('worldToScreen', () => {
    it('zoom=1, offset=0 时世界坐标等于屏幕坐标', () => {
      const cs = new CoordinateSystem(1000, 600)
      cs.setCamera({ x: 0, y: 0, zoom: 1 })
      const result = cs.worldToScreen({ x: 500, y: 300 })
      expect(result.x).toBeCloseTo(500)
      expect(result.y).toBeCloseTo(300)
    })

    it('zoom=2 时世界坐标 → 屏幕坐标放大一倍', () => {
      const cs = new CoordinateSystem(1000, 600)
      cs.setCamera({ x: 0, y: 0, zoom: 2 })
      const result = cs.worldToScreen({ x: 200, y: 100 })
      expect(result.x).toBeCloseTo(400)
      expect(result.y).toBeCloseTo(200)
    })
  })

  describe('screenToWorld ↔ worldToScreen 互逆', () => {
    it('往返转换应保持精度', () => {
      const cs = new CoordinateSystem(1000, 800)
      cs.setCamera({ x: 50, y: 30, zoom: 1.5 })
      const original = { x: 345.67, y: 678.90 }
      const world = cs.screenToWorld(original)
      const restored = cs.worldToScreen(world)
      expect(restored.x).toBeCloseTo(original.x, 4)
      expect(restored.y).toBeCloseTo(original.y, 4)
    })

    it('反向往返转换也应保持精度', () => {
      const cs = new CoordinateSystem(1920, 1080)
      cs.setCamera({ x: 100, y: 200, zoom: 2 })
      const original = { x: 500, y: 400 }
      const screen = cs.worldToScreen(original)
      const restored = cs.screenToWorld(screen)
      expect(restored.x).toBeCloseTo(original.x, 4)
      expect(restored.y).toBeCloseTo(original.y, 4)
    })
  })

  describe('toNormalized / fromNormalized', () => {
    it('将世界坐标归一化到 0-1 范围', () => {
      const cs = new CoordinateSystem(1000, 600)
      const result = cs.toNormalized({ x: 500, y: 300 })
      expect(result.x).toBeCloseTo(0.5)
      expect(result.y).toBeCloseTo(0.5)
    })

    it('将归一化坐标还原为世界坐标', () => {
      const cs = new CoordinateSystem(1000, 600)
      const result = cs.fromNormalized({ x: 0.5, y: 0.5 })
      expect(result.x).toBeCloseTo(500)
      expect(result.y).toBeCloseTo(300)
    })

    it('归一化和反归一化互逆', () => {
      const cs = new CoordinateSystem(1000, 800)
      const original = { x: 345.67, y: 678.90 }
      const normalized = cs.toNormalized(original)
      const restored = cs.fromNormalized(normalized)
      expect(restored.x).toBeCloseTo(original.x, 4)
      expect(restored.y).toBeCloseTo(original.y, 4)
    })
  })

  describe('resizeContainer', () => {
    it('resizeContainer 应更新容器尺寸', () => {
      const cs = new CoordinateSystem(1000, 600)
      cs.resizeContainer(2000, 1200)
      expect(cs.containerWidth).toBe(2000)
      expect(cs.containerHeight).toBe(1200)
    })

    it('resizeContainer 不影响文档尺寸', () => {
      const cs = new CoordinateSystem(1000, 600)
      cs.resizeContainer(2000, 1200)
      expect(cs.documentWidth).toBe(1000)
      expect(cs.documentHeight).toBe(600)
    })
  })

  describe('computeFitCamera', () => {
    it('文档尺寸等于容器尺寸时 zoom=1', () => {
      const cs = new CoordinateSystem(1000, 600)
      const camera = cs.computeFitCamera()
      expect(camera.zoom).toBeCloseTo(1)
    })

    it('文档比容器大时 zoom<1', () => {
      const cs = new CoordinateSystem(500, 300, 1000, 600)
      const camera = cs.computeFitCamera()
      expect(camera.zoom).toBeCloseTo(0.5)
    })

    it('文档比容器小时 zoom>1', () => {
      const cs = new CoordinateSystem(2000, 1200, 1000, 600)
      const camera = cs.computeFitCamera()
      expect(camera.zoom).toBeCloseTo(2)
    })
  })

  describe('documentWidth / documentHeight / containerWidth / containerHeight', () => {
    it('应暴露构造时的容器和文档尺寸', () => {
      const cs = new CoordinateSystem(800, 600, 1920, 1080)
      expect(cs.containerWidth).toBe(800)
      expect(cs.containerHeight).toBe(600)
      expect(cs.documentWidth).toBe(1920)
      expect(cs.documentHeight).toBe(1080)
    })

    it('不指定文档尺寸时默认等于容器尺寸', () => {
      const cs = new CoordinateSystem(800, 600)
      expect(cs.documentWidth).toBe(800)
      expect(cs.documentHeight).toBe(600)
    })
  })

  describe('camera 管理', () => {
    it('初始 camera 应是 auto-fit 状态', () => {
      const cs = new CoordinateSystem(800, 600)
      const camera = cs.camera
      expect(camera.zoom).toBeGreaterThan(0)
    })

    it('setCamera 应更新 camera 状态', () => {
      const cs = new CoordinateSystem(800, 600)
      cs.setCamera({ x: 10, y: 20, zoom: 1.5 })
      expect(cs.camera.x).toBe(10)
      expect(cs.camera.y).toBe(20)
      expect(cs.camera.zoom).toBe(1.5)
    })
  })

  describe('边界值', () => {
    it('负坐标处理', () => {
      const cs = new CoordinateSystem(1000, 1000)
      cs.setCamera({ x: 0, y: 0, zoom: 1 })
      const result = cs.screenToWorld({ x: -100, y: -200 })
      expect(result.x).toBeCloseTo(-100)
      expect(result.y).toBeCloseTo(-200)
    })

    it('零尺寸容器应抛错', () => {
      expect(() => new CoordinateSystem(0, 0)).toThrow()
    })

    it('宽度为零抛错', () => {
      expect(() => new CoordinateSystem(0, 100)).toThrow()
    })

    it('高度为零抛错', () => {
      expect(() => new CoordinateSystem(100, 0)).toThrow()
    })
  })
})
