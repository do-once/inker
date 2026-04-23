import { describe, it, expect } from 'vitest'
import { PlaybackTimeline } from '../playback-timeline.model'
import type { Operation } from '@inker/types'

/**
 * 创建测试用操作序列
 *
 * 包含两条笔画：
 * - s1：1000ms 开始，1050ms 结束，中间有两个 addPoint（point.t: 1016, 1032）
 * - s2：2000ms 开始，2050ms 结束，中间有一个 addPoint（point.t: 2016）
 *
 * 总时长：2050 - 1000 = 1050ms
 */
function createTestOperations(): Operation[] {
  return [
    {
      type: 'stroke:start',
      strokeId: 's1',
      style: { type: 'pen', color: '#000', size: 2, opacity: 1 },
      point: { x: 0.1, y: 0.1, t: 1000, p: 0.5 },
      timestamp: 1000
    },
    {
      type: 'stroke:addPoint',
      strokeId: 's1',
      point: { x: 0.2, y: 0.2, t: 1016, p: 0.6 }
    },
    {
      type: 'stroke:addPoint',
      strokeId: 's1',
      point: { x: 0.3, y: 0.3, t: 1032, p: 0.7 }
    },
    {
      type: 'stroke:end',
      strokeId: 's1',
      timestamp: 1050
    },
    {
      type: 'stroke:start',
      strokeId: 's2',
      style: { type: 'pen', color: '#000', size: 2, opacity: 1 },
      point: { x: 0.5, y: 0.5, t: 2000, p: 0.5 },
      timestamp: 2000
    },
    {
      type: 'stroke:addPoint',
      strokeId: 's2',
      point: { x: 0.6, y: 0.6, t: 2016, p: 0.6 }
    },
    {
      type: 'stroke:end',
      strokeId: 's2',
      timestamp: 2050
    }
  ]
}

describe('PlaybackTimeline', () => {
  describe('duration 计算', () => {
    it('空操作列表的 duration 应为 0', () => {
      const timeline = new PlaybackTimeline([])
      expect(timeline.duration).toBe(0)
    })

    it('单操作的 duration 应为 0', () => {
      const singleOp: Operation[] = [
        {
          type: 'stroke:start',
          strokeId: 's1',
          style: { type: 'pen', color: '#000', size: 2, opacity: 1 },
          point: { x: 0.1, y: 0.1, t: 1000, p: 0.5 },
          timestamp: 1000
        }
      ]
      const timeline = new PlaybackTimeline(singleOp)
      expect(timeline.duration).toBe(0)
    })

    it('多操作的 duration 应正确计算（最后时间 - 第一个时间）', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)
      // 第一个操作 timestamp=1000，最后一个操作 timestamp=2050
      // duration = 2050 - 1000 = 1050
      expect(timeline.duration).toBe(1050)
    })
  })

  describe('getOperationsUntil', () => {
    it('getOperationsUntil(0) 应返回第一个操作', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)
      // 时间 0 是相对时间，对应绝对时间 1000
      // 只有第一个操作（timestamp=1000）在 t=0 处
      const result = timeline.getOperationsUntil(0)
      expect(result.length).toBe(1)
      expect(result[0].type).toBe('stroke:start')
      if (result[0].type === 'stroke:start') {
        expect(result[0].strokeId).toBe('s1')
      }
    })

    it('getOperationsUntil(duration) 应返回所有操作', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)
      const result = timeline.getOperationsUntil(timeline.duration)
      expect(result.length).toBe(ops.length)
    })

    it('getOperationsUntil 中间时间点应返回部分操作', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)
      // 相对时间 50ms 对应绝对时间 1050
      // 应包含 s1 的全部操作（1000, 1016, 1032, 1050）
      const result = timeline.getOperationsUntil(50)
      expect(result.length).toBe(4) // stroke:start + 2x addPoint + stroke:end（s1）
    })

    it('getOperationsUntil 负数时间应返回空数组', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)
      const result = timeline.getOperationsUntil(-1)
      expect(result.length).toBe(0)
    })
  })

  describe('getOperationsBetween', () => {
    it('应正确筛选两个时间点之间的操作', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)
      // 相对时间 100~1050 对应绝对时间 1100~2050
      // 应包含 s2 的全部操作（2000, 2016, 2050）
      const result = timeline.getOperationsBetween(1000, 1050)
      expect(result.length).toBe(3) // stroke:start(s2) + addPoint(s2) + stroke:end(s2)
    })

    it('相同起止时间应返回该时间点的操作', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)
      // 相对时间 0 对应绝对时间 1000，只有 stroke:start(s1)
      const result = timeline.getOperationsBetween(0, 0)
      expect(result.length).toBe(1)
    })

    it('不包含任何操作的时间范围应返回空数组', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)
      // 相对时间 60~90 对应绝对时间 1060~1090，这个区间无操作
      const result = timeline.getOperationsBetween(60, 90)
      expect(result.length).toBe(0)
    })
  })

  describe('reset', () => {
    it('reset 后状态应清除', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)

      // 先获取一些操作（模拟回放推进）
      timeline.getOperationsUntil(50)

      // reset 后重新获取应返回相同结果
      timeline.reset()
      const result = timeline.getOperationsUntil(0)
      expect(result.length).toBe(1)
      expect(result[0].type).toBe('stroke:start')
    })

    it('reset 不应影响 duration', () => {
      const ops = createTestOperations()
      const timeline = new PlaybackTimeline(ops)
      const durationBefore = timeline.duration

      timeline.reset()

      expect(timeline.duration).toBe(durationBefore)
    })
  })
})
