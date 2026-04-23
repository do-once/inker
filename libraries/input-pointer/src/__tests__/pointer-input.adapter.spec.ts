import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PointerInputAdapter } from '../pointer-input.adapter'
import type { StrokeInputReceiver, PointerType } from '@inker/types'

/** 创建 mock StrokeInputReceiver */
function createMockKernel(): StrokeInputReceiver {
  return {
    startStroke: vi.fn(),
    addStrokePoint: vi.fn(),
    endStroke: vi.fn()
  }
}

describe('PointerInputAdapter', () => {
  let element: HTMLElement
  let adapter: PointerInputAdapter

  beforeEach(() => {
    element = document.createElement('div')
    document.body.appendChild(element)
    adapter = new PointerInputAdapter()
  })

  afterEach(() => {
    adapter.dispose()
    document.body.removeChild(element)
  })

  /** 创建 PointerEvent 的辅助函数 */
  function createPointerEvent(
    type: string,
    options: PointerEventInit = {}
  ): PointerEvent {
    return new PointerEvent(type, {
      clientX: 100,
      clientY: 200,
      pressure: 0.5,
      pointerId: 1,
      pointerType: 'mouse',
      bubbles: true,
      ...options
    })
  }

  describe('attach — 绑定事件监听', () => {
    it('attach 到 HTMLElement 后应注册事件监听', () => {
      const spy = vi.spyOn(element, 'addEventListener')

      adapter.attach(element)

      const eventTypes = spy.mock.calls.map(call => call[0])
      expect(eventTypes).toContain('pointerdown')
      expect(eventTypes).toContain('pointermove')
      expect(eventTypes).toContain('pointerup')
      expect(eventTypes).toContain('pointercancel')
    })

    it('attach 后应设置 touch-action: none', () => {
      adapter.attach(element)
      expect(element.style.touchAction).toBe('none')
    })

    it('attach 前有 touchAction 值时，detach 后应恢复', () => {
      element.style.touchAction = 'auto'

      adapter.attach(element)
      expect(element.style.touchAction).toBe('none')

      adapter.detach()
      expect(element.style.touchAction).toBe('auto')
    })
  })

  describe('bindKernel — 绑定内核', () => {
    it('bindKernel 后 pointerdown 应调用 kernel.startStroke', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))

      expect(kernel.startStroke).toHaveBeenCalledTimes(1)
    })

    it('bindKernel 后 pointermove 应调用 kernel.addStrokePoint', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))
      element.dispatchEvent(createPointerEvent('pointermove', { clientX: 110, clientY: 210 }))

      expect(kernel.addStrokePoint).toHaveBeenCalledTimes(1)
    })

    it('bindKernel 后 pointerup 应调用 kernel.endStroke', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))
      element.dispatchEvent(createPointerEvent('pointerup'))

      expect(kernel.endStroke).toHaveBeenCalledTimes(1)
    })

    it('pointercancel 应转换为 kernel.endStroke（不泄漏 cancel 到内核）', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))
      element.dispatchEvent(createPointerEvent('pointercancel'))

      expect(kernel.endStroke).toHaveBeenCalledTimes(1)
    })

    it('startStroke 应传入 strokeId、RawPoint 和 timestamp', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown'))

      expect(kernel.startStroke).toHaveBeenCalledWith(
        expect.any(String),   // strokeId (UUID)
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), pressure: expect.any(Number) }),
        expect.any(Number)    // timestamp
      )
    })
  })

  describe('pointerToStroke 映射', () => {
    it('每次 pointerdown 应生成不同的 strokeId', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))

      const strokeIds = (kernel.startStroke as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])
      expect(strokeIds[0]).not.toBe(strokeIds[1])
    })

    it('双指 down：同一 addStrokePoint 调用传入正确的 strokeId', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2 }))

      const strokeId1 = (kernel.startStroke as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const strokeId2 = (kernel.startStroke as ReturnType<typeof vi.fn>).mock.calls[1][0]
      expect(strokeId1).not.toBe(strokeId2)

      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 110 }))
      const moveStrokeId = (kernel.addStrokePoint as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(moveStrokeId).toBe(strokeId1)
    })

    it('pointerup 后该 pointerId 的映射应被删除（后续 move 被忽略）', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 120 }))

      expect(kernel.addStrokePoint).not.toHaveBeenCalled()
    })
  })

  describe('setAllowedPointerTypes — 指针类型过滤', () => {
    it('默认允许所有指针类型', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'mouse', pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'touch', pointerId: 2 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 2 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'pen', pointerId: 3 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 3 }))

      expect(kernel.startStroke).toHaveBeenCalledTimes(3)
    })

    it('setAllowedPointerTypes 应过滤非允许类型', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.setAllowedPointerTypes(['pen'] as PointerType[])
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'mouse', pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerType: 'pen', pointerId: 2 }))

      expect(kernel.startStroke).toHaveBeenCalledTimes(1)
    })
  })

  describe('detach — 解绑事件', () => {
    it('detach 后不再触发事件', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)
      adapter.detach()

      element.dispatchEvent(createPointerEvent('pointerdown'))

      expect(kernel.startStroke).not.toHaveBeenCalled()
    })
  })

  describe('dispose — 清理所有监听', () => {
    it('dispose 应清理所有事件监听', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)
      adapter.dispose()

      element.dispatchEvent(createPointerEvent('pointerdown'))

      expect(kernel.startStroke).not.toHaveBeenCalled()
    })

    it('dispose 后再次调用 dispose 不应抛错', () => {
      adapter.attach(element)
      adapter.dispose()
      expect(() => adapter.dispose()).not.toThrow()
    })
  })

  describe('多指针追踪', () => {
    it('双指 down：两次 startStroke 均被调用', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2 }))

      expect(kernel.startStroke).toHaveBeenCalledTimes(2)
    })

    it('一指 up 另一指继续（未知 pointerId 的 move 被忽略）', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1 }))
      element.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2 }))
      element.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
      // 指针 2 继续 move（应正常触发）
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 210 }))
      // 指针 1 move（应被忽略，因为已 up）
      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 120 }))

      expect(kernel.addStrokePoint).toHaveBeenCalledTimes(1)
    })

    it('未知 pointerId 的 move 被忽略', () => {
      const kernel = createMockKernel()
      adapter.bindKernel(kernel)
      adapter.attach(element)

      element.dispatchEvent(createPointerEvent('pointermove', { pointerId: 99, clientX: 150 }))

      expect(kernel.addStrokePoint).not.toHaveBeenCalled()
    })
  })
})
