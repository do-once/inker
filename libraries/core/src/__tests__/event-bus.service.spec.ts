import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../event-bus.service'

describe('EventBus', () => {
  describe('基本发布订阅', () => {
    it('on(event, handler) + emit(event, data) — handler 被调用且收到正确 data', () => {
      const bus = new EventBus()
      const handler = vi.fn()

      bus.on('test', handler)
      bus.emit('test', { value: 42 })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ value: 42 })
    })

    it('同一事件多个 handler 全部被调用', () => {
      const bus = new EventBus()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      bus.on('event', handler1)
      bus.on('event', handler2)
      bus.on('event', handler3)

      bus.emit('event', 'data')

      expect(handler1).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledOnce()
      expect(handler3).toHaveBeenCalledOnce()
      expect(handler1).toHaveBeenCalledWith('data')
      expect(handler2).toHaveBeenCalledWith('data')
      expect(handler3).toHaveBeenCalledWith('data')
    })

    it('不同事件的 handler 互不影响', () => {
      const bus = new EventBus()
      const handlerA = vi.fn()
      const handlerB = vi.fn()

      bus.on('eventA', handlerA)
      bus.on('eventB', handlerB)

      bus.emit('eventA', 'a')

      expect(handlerA).toHaveBeenCalledOnce()
      expect(handlerB).not.toHaveBeenCalled()
    })
  })

  describe('取消订阅', () => {
    it('off(event, handler) 移除后不再调用', () => {
      const bus = new EventBus()
      const handler = vi.fn()

      bus.on('test', handler)
      bus.off('test', handler)
      bus.emit('test', 'data')

      expect(handler).not.toHaveBeenCalled()
    })

    it('off 只移除指定的 handler，不影响其他 handler', () => {
      const bus = new EventBus()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.on('test', handler1)
      bus.on('test', handler2)
      bus.off('test', handler1)

      bus.emit('test', 'data')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('on 返回取消函数，调用后移除监听', () => {
      const bus = new EventBus()
      const handler = vi.fn()

      const unsubscribe = bus.on('test', handler)
      unsubscribe()
      bus.emit('test', 'data')

      expect(handler).not.toHaveBeenCalled()
    })

    it('取消函数多次调用不报错', () => {
      const bus = new EventBus()
      const handler = vi.fn()

      const unsubscribe = bus.on('test', handler)
      unsubscribe()
      expect(() => unsubscribe()).not.toThrow()
    })
  })

  describe('once', () => {
    it('once(event, handler) 只触发一次', () => {
      const bus = new EventBus()
      const handler = vi.fn()

      bus.once('test', handler)
      bus.emit('test', 'first')
      bus.emit('test', 'second')

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith('first')
    })

    it('once 不影响同一事件的其他 on 监听器', () => {
      const bus = new EventBus()
      const onceHandler = vi.fn()
      const onHandler = vi.fn()

      bus.once('test', onceHandler)
      bus.on('test', onHandler)

      bus.emit('test', 'first')
      bus.emit('test', 'second')

      expect(onceHandler).toHaveBeenCalledOnce()
      expect(onHandler).toHaveBeenCalledTimes(2)
    })
  })

  describe('边界情况', () => {
    it('emit 未注册的事件不报错', () => {
      const bus = new EventBus()
      expect(() => bus.emit('nonexistent', 'data')).not.toThrow()
    })

    it('off 未注册的事件不报错', () => {
      const bus = new EventBus()
      const handler = vi.fn()
      expect(() => bus.off('nonexistent', handler)).not.toThrow()
    })

    it('emit 不传 data 时 handler 收到 undefined', () => {
      const bus = new EventBus()
      const handler = vi.fn()

      bus.on('test', handler)
      bus.emit('test')

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(undefined)
    })
  })

  describe('dispose', () => {
    it('dispose 清除所有监听器', () => {
      const bus = new EventBus()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.on('eventA', handler1)
      bus.on('eventB', handler2)

      bus.dispose()

      bus.emit('eventA', 'data')
      bus.emit('eventB', 'data')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('dispose 后 emit 不报错，handler 不被调用', () => {
      const bus = new EventBus()
      const handler = vi.fn()

      bus.on('test', handler)
      bus.dispose()

      expect(() => bus.emit('test', 'data')).not.toThrow()
      expect(handler).not.toHaveBeenCalled()
    })

    it('dispose 后仍可注册新监听器', () => {
      const bus = new EventBus()
      const oldHandler = vi.fn()
      const newHandler = vi.fn()

      bus.on('test', oldHandler)
      bus.dispose()

      bus.on('test', newHandler)
      bus.emit('test', 'data')

      expect(oldHandler).not.toHaveBeenCalled()
      expect(newHandler).toHaveBeenCalledOnce()
    })
  })
})
