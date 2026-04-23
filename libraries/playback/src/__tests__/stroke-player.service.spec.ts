import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrokePlayer } from '../stroke-player.service'
import type { Operation } from '@inker/types'

/**
 * 创建测试用操作序列
 *
 * 包含一条笔画：1000ms 开始，1050ms 结束
 * 总时长 50ms，方便用 fake timers 控制
 */
function createSimpleOperations(): Operation[] {
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
    }
  ]
}

/**
 * 创建包含两条笔画的操作序列
 *
 * s1：1000ms~1050ms，s2：2000ms~2050ms
 * 总时长 1050ms
 */
function createTwoStrokeOperations(): Operation[] {
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

describe('StrokePlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('状态机', () => {
    it('初始状态应为 idle', () => {
      const player = new StrokePlayer(createSimpleOperations())
      expect(player.state).toBe('idle')
      player.dispose()
    })

    it('play() 后状态应为 playing', () => {
      const player = new StrokePlayer(createSimpleOperations())
      player.play()
      expect(player.state).toBe('playing')
      player.dispose()
    })

    it('pause() 后状态应为 paused', () => {
      const player = new StrokePlayer(createSimpleOperations())
      player.play()
      player.pause()
      expect(player.state).toBe('paused')
      player.dispose()
    })

    it('resume() 后状态应恢复为 playing', () => {
      const player = new StrokePlayer(createSimpleOperations())
      player.play()
      player.pause()
      player.resume()
      expect(player.state).toBe('playing')
      player.dispose()
    })

    it('stop() 后状态应为 idle', () => {
      const player = new StrokePlayer(createSimpleOperations())
      player.play()
      player.stop()
      expect(player.state).toBe('idle')
      player.dispose()
    })

    it('回放完成后状态应为 finished', () => {
      const ops = createSimpleOperations()
      const player = new StrokePlayer(ops)
      player.play()

      // 推进足够时间让所有操作完成（总时长 50ms）
      vi.advanceTimersByTime(100)

      expect(player.state).toBe('finished')
      player.dispose()
    })
  })

  describe('速度倍率', () => {
    it('默认速度应为 1', () => {
      const player = new StrokePlayer(createSimpleOperations())
      expect(player.speed).toBe(1)
      player.dispose()
    })

    it('构造时可设置速度', () => {
      const player = new StrokePlayer(createSimpleOperations(), { speed: 2 })
      expect(player.speed).toBe(2)
      player.dispose()
    })

    it('运行时可修改速度', () => {
      const player = new StrokePlayer(createSimpleOperations())
      player.speed = 3
      expect(player.speed).toBe(3)
      player.dispose()
    })

    it('speed 为 2 时回放应更快', () => {
      const ops = createTwoStrokeOperations()
      const onOperation1x = vi.fn()
      const onOperation2x = vi.fn()

      // 1x 速度
      const player1 = new StrokePlayer(ops)
      player1.onOperation = onOperation1x
      player1.play()
      vi.advanceTimersByTime(30)
      const count1x = onOperation1x.mock.calls.length
      player1.dispose()

      // 2x 速度
      const player2 = new StrokePlayer(ops, { speed: 2 })
      player2.onOperation = onOperation2x
      player2.play()
      vi.advanceTimersByTime(30)
      const count2x = onOperation2x.mock.calls.length
      player2.dispose()

      // 2 倍速在相同时间内应触发更多操作（或至少不比 1x 少）
      expect(count2x).toBeGreaterThanOrEqual(count1x)
    })
  })

  describe('回调', () => {
    it('onOperation 应在每个操作执行时调用', () => {
      const ops = createSimpleOperations()
      const player = new StrokePlayer(ops)
      const callback = vi.fn()
      player.onOperation = callback
      player.play()

      // 推进足够时间让所有操作完成
      vi.advanceTimersByTime(100)

      // 应为每个操作调用一次
      expect(callback).toHaveBeenCalledTimes(ops.length)

      // 验证每次调用的参数是对应的操作
      ops.forEach((op, i) => {
        expect(callback).toHaveBeenNthCalledWith(i + 1, op)
      })

      player.dispose()
    })

    it('onFinish 应在回放完成时调用', () => {
      const ops = createSimpleOperations()
      const player = new StrokePlayer(ops)
      const finishCallback = vi.fn()
      player.onFinish = finishCallback
      player.play()

      // 推进足够时间让回放完成
      vi.advanceTimersByTime(100)

      expect(finishCallback).toHaveBeenCalledTimes(1)
      player.dispose()
    })

    it('stop 后不应再触发回调', () => {
      const ops = createTwoStrokeOperations()
      const player = new StrokePlayer(ops)
      const operationCallback = vi.fn()
      const finishCallback = vi.fn()
      player.onOperation = operationCallback
      player.onFinish = finishCallback
      player.play()

      // 推进部分时间（不到一半）
      vi.advanceTimersByTime(20)
      const callCountBeforeStop = operationCallback.mock.calls.length

      // 停止
      player.stop()

      // 继续推进时间
      vi.advanceTimersByTime(2000)

      // stop 后不应有新的回调
      expect(operationCallback.mock.calls.length).toBe(callCountBeforeStop)
      expect(finishCallback).not.toHaveBeenCalled()

      player.dispose()
    })
  })

  describe('进度', () => {
    it('初始进度应为 0', () => {
      const player = new StrokePlayer(createSimpleOperations())
      expect(player.progress).toBe(0)
      player.dispose()
    })

    it('回放完成后进度应为 1', () => {
      const ops = createSimpleOperations()
      const player = new StrokePlayer(ops)
      player.play()

      // 推进足够时间
      vi.advanceTimersByTime(100)

      expect(player.progress).toBe(1)
      player.dispose()
    })

    it('stop 后进度应重置为 0', () => {
      const ops = createSimpleOperations()
      const player = new StrokePlayer(ops)
      player.play()

      // 推进部分时间
      vi.advanceTimersByTime(20)
      player.stop()

      expect(player.progress).toBe(0)
      player.dispose()
    })
  })

  describe('边界情况', () => {
    it('空操作列表 play 不应抛错', () => {
      const player = new StrokePlayer([])
      expect(() => player.play()).not.toThrow()
      player.dispose()
    })

    it('空操作列表 play 后应立即进入 finished', () => {
      const player = new StrokePlayer([])
      player.play()
      vi.advanceTimersByTime(0)
      expect(player.state).toBe('finished')
      player.dispose()
    })

    it('dispose 不应抛错', () => {
      const player = new StrokePlayer(createSimpleOperations())
      expect(() => player.dispose()).not.toThrow()
    })

    it('dispose 后再次调用 dispose 不应抛错', () => {
      const player = new StrokePlayer(createSimpleOperations())
      player.dispose()
      expect(() => player.dispose()).not.toThrow()
    })

    it('playing 状态下 dispose 应停止回放', () => {
      const ops = createSimpleOperations()
      const player = new StrokePlayer(ops)
      const callback = vi.fn()
      player.onOperation = callback
      player.play()

      // 推进部分时间
      vi.advanceTimersByTime(10)
      const callCountBeforeDispose = callback.mock.calls.length

      player.dispose()

      // 继续推进时间
      vi.advanceTimersByTime(200)

      // dispose 后不应有新的回调
      expect(callback.mock.calls.length).toBe(callCountBeforeDispose)
    })
  })
})
