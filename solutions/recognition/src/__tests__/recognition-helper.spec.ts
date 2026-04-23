import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RecognitionHelper } from '../recognition-helper'
import type { RecognitionTarget } from '../types'
import type { Stroke, DocumentSnapshot } from '@inker/types'

function makeStroke(id: string, points: Array<{ x: number; y: number; t: number }>): Stroke {
  return {
    id,
    points: points.map(p => ({ ...p, p: 0.5 })),
    style: { type: 'pen', color: '#000', size: 2, opacity: 1 } as any,
    createdAt: points[0]?.t ?? 0
  }
}

function makeSnapshot(strokes: Stroke[]): DocumentSnapshot {
  return {
    strokes: new Map(strokes.map(s => [s.id, s])),
    strokeOrder: strokes.map(s => s.id),
    timestamp: Date.now()
  }
}

function createMockTarget(snapshot: DocumentSnapshot): RecognitionTarget & { triggerStrokeEnd: (data: unknown) => void } {
  const handlers = new Map<string, Array<(data: unknown) => void>>()
  return {
    on(event: string, handler: (data: unknown) => void) {
      if (!handlers.has(event)) handlers.set(event, [])
      handlers.get(event)!.push(handler)
      return () => {
        const list = handlers.get(event)
        if (list) {
          const idx = list.indexOf(handler)
          if (idx >= 0) list.splice(idx, 1)
        }
      }
    },
    getSnapshot: vi.fn(() => snapshot),
    triggerStrokeEnd(data: unknown) {
      const list = handlers.get('stroke:end')
      list?.forEach(h => h(data))
    }
  }
}

describe('RecognitionHelper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('bindTo 后监听 stroke:end 事件', () => {
    const helper = new RecognitionHelper()
    const target = createMockTarget(makeSnapshot([]))
    const onSpy = vi.spyOn(target, 'on')
    helper.bindTo(target)
    expect(onSpy).toHaveBeenCalledWith('stroke:end', expect.any(Function))
    helper.dispose()
  })

  it('书写停顿后触发 onWritingComplete', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }, { x: 10, y: 10, t: 200 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()
    helper.onWritingComplete(callback)
    helper.bindTo(target)
    target.triggerStrokeEnd({ stroke: stroke1 })
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0].strokes).toContain(stroke1)
    helper.dispose()
  })

  it('连续书写时重置定时器', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const stroke2 = makeStroke('s2', [{ x: 10, y: 10, t: 400 }])
    const target = createMockTarget(makeSnapshot([stroke1, stroke2]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()
    helper.onWritingComplete(callback)
    helper.bindTo(target)
    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(300)
    expect(callback).not.toHaveBeenCalled()
    target.triggerStrokeEnd({ stroke: stroke2 })
    vi.advanceTimersByTime(300)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(callback).toHaveBeenCalledTimes(1)
    helper.dispose()
  })

  it('不重复触发已处理的笔画', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()
    helper.onWritingComplete(callback)
    helper.bindTo(target)
    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(1)
    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(1)
    helper.dispose()
  })

  it('支持多个 listener', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    helper.onWritingComplete(cb1)
    helper.onWritingComplete(cb2)
    helper.bindTo(target)
    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)
    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).toHaveBeenCalledTimes(1)
    helper.dispose()
  })

  it('取消订阅后不再收到通知', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()
    const unsub = helper.onWritingComplete(callback)
    helper.bindTo(target)
    unsub()
    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)
    expect(callback).not.toHaveBeenCalled()
    helper.dispose()
  })

  it('onWritingComplete 可在 bindTo 之前注册', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()
    helper.onWritingComplete(callback)
    helper.bindTo(target)
    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalledTimes(1)
    helper.dispose()
  })

  it('getCurrentStrokes 返回当前所有笔画', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const stroke2 = makeStroke('s2', [{ x: 10, y: 10, t: 200 }])
    const target = createMockTarget(makeSnapshot([stroke1, stroke2]))
    const helper = new RecognitionHelper()
    helper.bindTo(target)
    const strokes = helper.getCurrentStrokes()
    expect(strokes).toHaveLength(2)
    expect(strokes[0].id).toBe('s1')
    expect(strokes[1].id).toBe('s2')
    helper.dispose()
  })

  it('未 bindTo 时调用 getCurrentStrokes 抛出异常', () => {
    const helper = new RecognitionHelper()
    expect(() => helper.getCurrentStrokes()).toThrow()
  })

  it('dispose 后调用方法抛出异常', () => {
    const helper = new RecognitionHelper()
    helper.dispose()
    expect(() => helper.getCurrentStrokes()).toThrow()
    expect(() => helper.onWritingComplete(() => {})).toThrow()
    expect(() => helper.bindTo({} as any)).toThrow()
  })

  it('重复 dispose 抛出异常', () => {
    const helper = new RecognitionHelper()
    helper.dispose()
    expect(() => helper.dispose()).toThrow()
  })

  it('dispose 清除定时器', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper({ gapMs: 500 })
    const callback = vi.fn()
    helper.onWritingComplete(callback)
    helper.bindTo(target)
    target.triggerStrokeEnd({ stroke: stroke1 })
    helper.dispose()
    vi.advanceTimersByTime(500)
    expect(callback).not.toHaveBeenCalled()
  })

  it('默认 gapMs 为 500', () => {
    const stroke1 = makeStroke('s1', [{ x: 0, y: 0, t: 100 }])
    const target = createMockTarget(makeSnapshot([stroke1]))
    const helper = new RecognitionHelper()
    const callback = vi.fn()
    helper.onWritingComplete(callback)
    helper.bindTo(target)
    target.triggerStrokeEnd({ stroke: stroke1 })
    vi.advanceTimersByTime(499)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
    helper.dispose()
  })
})
