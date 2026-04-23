import { describe, it, expect, vi } from 'vitest'
import { WorkerStrategy } from '../worker.strategy'
import type { StrokeProcessorInterface, StrokePoint, StrokeStyle, StrokeType, OutlineGeometry } from '@inker/types'

/** 创建测试用采样点（世界坐标像素） */
function point(x: number, y: number, p = 0.5, t = Date.now()): StrokePoint {
  return { x, y, p, t }
}

const defaultStyle: StrokeStyle = {
  type: 'pen',
  color: '#000000',
  width: 2,
  opacity: 1
}

/** 创建 mock processor */
function createMockProcessor(result: OutlineGeometry | null = { points: [{ x: 0, y: 0 }] }): StrokeProcessorInterface {
  return {
    supportedTypes: ['pen'] as readonly StrokeType[],
    computeOutline: vi.fn().mockReturnValue(result)
  }
}

describe('WorkerStrategy', () => {
  describe('降级行为（happy-dom 环境下 Worker 不可用）', () => {
    it('应正常构造不抛错', () => {
      expect(() => new WorkerStrategy()).not.toThrow()
    })

    it('computeOutline 应返回 Promise', () => {
      const strategy = new WorkerStrategy()
      const processor = createMockProcessor()
      const points = [point(80, 60), point(160, 120)]

      const result = strategy.computeOutline(
        processor,
        points,
        defaultStyle,
        false
      )

      expect(result).toBeInstanceOf(Promise)
    })

    it('返回值应与 processor.computeOutline 结果一致', async () => {
      const strategy = new WorkerStrategy()
      const expectedGeometry: OutlineGeometry = { points: [{ x: 10, y: 20 }] }
      const processor = createMockProcessor(expectedGeometry)
      const points = [point(80, 60), point(160, 120)]

      const result = await strategy.computeOutline(
        processor,
        points,
        defaultStyle,
        true
      )

      expect(result).toBe(expectedGeometry)
    })

    it('processor 返回 null 时应返回 Promise<null>', async () => {
      const strategy = new WorkerStrategy()
      const processor = createMockProcessor(null)
      const points: StrokePoint[] = []

      const result = await strategy.computeOutline(
        processor,
        points,
        defaultStyle,
        false
      )

      expect(result).toBeNull()
    })
  })

  describe('参数传递', () => {
    it('应将所有参数传递给 processor.computeOutline（降级模式）', async () => {
      const strategy = new WorkerStrategy()
      const processor = createMockProcessor()
      const points = [point(240, 320)]

      await strategy.computeOutline(
        processor,
        points,
        defaultStyle,
        true
      )

      expect(processor.computeOutline).toHaveBeenCalledWith(
        points,
        defaultStyle,
        true
      )
    })

    it('complete 为 false 时也应正确传递', async () => {
      const strategy = new WorkerStrategy()
      const processor = createMockProcessor()
      const points = [point(80, 60), point(400, 300)]

      await strategy.computeOutline(
        processor,
        points,
        defaultStyle,
        false
      )

      expect(processor.computeOutline).toHaveBeenCalledWith(
        points,
        defaultStyle,
        false
      )
    })
  })

  describe('dispose', () => {
    it('dispose 不应抛错', () => {
      const strategy = new WorkerStrategy()

      expect(() => strategy.dispose()).not.toThrow()
    })

    it('dispose 后再次调用不应抛错', () => {
      const strategy = new WorkerStrategy()

      strategy.dispose()

      expect(() => strategy.dispose()).not.toThrow()
    })
  })

  describe('Worker 可用性检测', () => {
    it('在 happy-dom 环境下 isWorkerAvailable 应为 false', () => {
      const strategy = new WorkerStrategy()

      expect(strategy.isWorkerAvailable).toBe(false)
    })

    it('降级后 computeOutline 仍能正常工作', async () => {
      const strategy = new WorkerStrategy()
      // 确认处于降级模式
      expect(strategy.isWorkerAvailable).toBe(false)

      const expectedGeometry: OutlineGeometry = { points: [{ x: 160, y: 240 }, { x: 320, y: 400 }] }
      const processor = createMockProcessor(expectedGeometry)
      const points = [point(160, 240), point(320, 400), point(480, 560)]

      const result = await strategy.computeOutline(
        processor,
        points,
        defaultStyle,
        true
      )

      expect(result).toBe(expectedGeometry)
      expect(processor.computeOutline).toHaveBeenCalledOnce()
    })
  })
})
