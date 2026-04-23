import { describe, it, expect, vi } from 'vitest'
import { MainThreadStrategy } from '../main-thread.strategy'
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

describe('MainThreadStrategy', () => {
  describe('computeOutline', () => {
    it('应调用 processor.computeOutline 并返回 Promise', async () => {
      const strategy = new MainThreadStrategy()
      const processor = createMockProcessor()
      const points = [point(80, 60), point(160, 120)]

      const result = strategy.computeOutline(
        processor,
        points,
        defaultStyle,
        false
      )

      expect(result).toBeInstanceOf(Promise)
      const resolved = await result
      expect(resolved).toHaveProperty('points')
    })

    it('返回值应与 processor 的结果一致', async () => {
      const strategy = new MainThreadStrategy()
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
      const strategy = new MainThreadStrategy()
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

    it('应将所有参数传递给 processor.computeOutline', async () => {
      const strategy = new MainThreadStrategy()
      const processor = createMockProcessor()
      const points = [point(80, 60)]

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
  })

  describe('dispose', () => {
    it('dispose 不应抛错', () => {
      const strategy = new MainThreadStrategy()

      expect(() => strategy.dispose()).not.toThrow()
    })

    it('dispose 后再次调用不应抛错', () => {
      const strategy = new MainThreadStrategy()

      strategy.dispose()

      expect(() => strategy.dispose()).not.toThrow()
    })
  })
})
