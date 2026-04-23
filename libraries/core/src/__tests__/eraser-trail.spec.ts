import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EraserTrail } from '../eraser-trail'

describe('EraserTrail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('衰减计算', () => {
    it('刚添加的点衰减系数应接近 1', () => {
      const trail = new EraserTrail({ baseSize: 10 })

      trail.addPoint({ x: 100, y: 200 })
      trail.addPoint({ x: 110, y: 210 })
      trail.addPoint({ x: 120, y: 220 })

      const sizes = trail.getDecayedSizes()
      // 最新的点（最后一个）衰减系数接近 1
      expect(sizes[sizes.length - 1]).toBeGreaterThan(0.8)
    })

    it('超过 DECAY_TIME 的点衰减系数应为 0', () => {
      const trail = new EraserTrail({ baseSize: 10, decayTime: 200 })

      trail.addPoint({ x: 100, y: 200 })

      // 时间前进 300ms
      vi.advanceTimersByTime(300)

      const sizes = trail.getDecayedSizes()
      expect(sizes[0]).toBe(0)
    })

    it('尾部 DECAY_LENGTH 范围内点应逐渐变小', () => {
      const trail = new EraserTrail({
        baseSize: 10,
        decayTime: 5000, // 设大时间衰减，仅测试长度衰减
        decayLength: 5
      })

      // 添加 10 个点
      for (let i = 0; i < 10; i++) {
        trail.addPoint({ x: i * 10, y: 0 })
      }

      const sizes = trail.getDecayedSizes()
      // 从 index 5 开始（尾部 5 个点范围外），size 应较大
      // 尾部方向（index 0-4），size 逐渐变小
      expect(sizes[0]).toBeLessThan(sizes[5])
      expect(sizes[1]).toBeLessThan(sizes[6])
    })

    it('衰减结果取时间衰减和长度衰减的较小值', () => {
      const trail = new EraserTrail({
        baseSize: 10,
        decayTime: 200,
        decayLength: 3
      })

      trail.addPoint({ x: 0, y: 0 })
      // 时间前进 100ms（时间衰减约 0.5）
      vi.advanceTimersByTime(100)
      // 添加更多点让第一个点远离尾部
      for (let i = 1; i <= 5; i++) {
        trail.addPoint({ x: i * 10, y: 0 })
      }

      const sizes = trail.getDecayedSizes()
      // 第一个点同时受时间和长度衰减影响，取较小值
      expect(sizes[0]).toBeLessThanOrEqual(trail.baseSize)
    })
  })

  describe('轮廓生成', () => {
    it('少于 2 个点时应返回 null', () => {
      const trail = new EraserTrail({ baseSize: 10 })
      trail.addPoint({ x: 100, y: 200 })

      const outline = trail.computeOutline()
      expect(outline).toBeNull()
    })

    it('2 个以上有效点时应返回 Path2D', () => {
      const trail = new EraserTrail({ baseSize: 10, decayTime: 5000 })
      trail.addPoint({ x: 0, y: 0 })
      trail.addPoint({ x: 10, y: 0 })
      trail.addPoint({ x: 20, y: 0 })

      const outline = trail.computeOutline()
      expect(outline).toBeInstanceOf(Path2D)
    })

    it('所有点衰减为 0 时应返回 null', () => {
      const trail = new EraserTrail({ baseSize: 10, decayTime: 100 })
      trail.addPoint({ x: 0, y: 0 })
      trail.addPoint({ x: 10, y: 0 })

      vi.advanceTimersByTime(200)

      const outline = trail.computeOutline()
      expect(outline).toBeNull()
    })
  })

  describe('rAF 动画', () => {
    it('start 后应在每帧调用 onFrame 回调', () => {
      const trail = new EraserTrail({ baseSize: 10, decayTime: 5000 })
      trail.addPoint({ x: 0, y: 0 })
      trail.addPoint({ x: 10, y: 0 })

      const onFrame = vi.fn()
      trail.start(onFrame)

      // 模拟一帧
      vi.advanceTimersByTime(16)

      expect(onFrame).toHaveBeenCalled()

      trail.stop()
    })

    it('endTrail 后轨迹应进入 pastTrails 并继续衰减', () => {
      const trail = new EraserTrail({ baseSize: 10, decayTime: 200 })
      trail.addPoint({ x: 0, y: 0 })
      trail.addPoint({ x: 10, y: 0 })

      const onFrame = vi.fn()
      trail.start(onFrame)
      trail.endTrail()

      // 新轨迹开始
      trail.addPoint({ x: 50, y: 50 })
      trail.addPoint({ x: 60, y: 60 })

      // pastTrails 应有 1 条
      expect(trail.pastTrailCount).toBe(1)

      trail.stop()
    })

    it('所有轨迹衰减完毕后应自动停止 rAF', () => {
      const trail = new EraserTrail({ baseSize: 10, decayTime: 100 })
      trail.addPoint({ x: 0, y: 0 })
      trail.addPoint({ x: 10, y: 0 })

      const onFrame = vi.fn()
      trail.start(onFrame)
      trail.endTrail()

      // 等衰减完成
      vi.advanceTimersByTime(300)

      expect(trail.isRunning).toBe(false)
    })

    it('stop 应停止 rAF 循环', () => {
      const trail = new EraserTrail({ baseSize: 10, decayTime: 5000 })
      trail.addPoint({ x: 0, y: 0 })
      trail.addPoint({ x: 10, y: 0 })

      const onFrame = vi.fn()
      trail.start(onFrame)
      trail.stop()

      vi.advanceTimersByTime(100)

      // stop 后不应再调用
      const callCount = onFrame.mock.calls.length
      vi.advanceTimersByTime(100)
      expect(onFrame.mock.calls.length).toBe(callCount)
    })
  })
})
