import { describe, it, expect } from 'vitest'
import { ProcessorRegistry } from '../processor-registry.service'
import type { StrokeProcessorInterface, StrokePoint, StrokeStyle, StrokeType, OutlineGeometry } from '@inker/types'

/** 创建模拟处理器 */
function createMockProcessor(types: StrokeType[]): StrokeProcessorInterface {
  return {
    supportedTypes: types,
    computeOutline(
      _points: readonly StrokePoint[],
      _style: StrokeStyle,
      _complete: boolean
    ): OutlineGeometry | null {
      return { points: [{ x: 0, y: 0 }] }
    }
  }
}

describe('ProcessorRegistry', () => {
  describe('register — 注册处理器', () => {
    it('register 应成功注册处理器', () => {
      const registry = new ProcessorRegistry()
      const processor = createMockProcessor(['pen'])

      expect(() => registry.register(processor)).not.toThrow()
    })

    it('register 应根据 supportedTypes 自动注册所有类型', () => {
      const registry = new ProcessorRegistry()
      const processor = createMockProcessor(['pen', 'marker'])

      registry.register(processor)

      expect(registry.get('pen')).toBe(processor)
      expect(registry.get('marker')).toBe(processor)
    })
  })

  describe('get — 获取处理器', () => {
    it('get 应返回对应类型的处理器', () => {
      const registry = new ProcessorRegistry()
      const processor = createMockProcessor(['pen'])

      registry.register(processor)

      expect(registry.get('pen')).toBe(processor)
    })

    it('get 未注册类型应抛错', () => {
      const registry = new ProcessorRegistry()

      expect(() => registry.get('pen')).toThrow()
    })

    it('get 未注册类型的错误信息应包含类型名', () => {
      const registry = new ProcessorRegistry()

      expect(() => registry.get('pencil')).toThrow(/pencil/)
    })
  })

  describe('多处理器注册', () => {
    it('不同处理器注册不同类型不应冲突', () => {
      const registry = new ProcessorRegistry()
      const penProcessor = createMockProcessor(['pen', 'marker', 'pencil'])
      const eraserProcessor = createMockProcessor(['eraser', 'wiper'])

      registry.register(penProcessor)
      registry.register(eraserProcessor)

      expect(registry.get('pen')).toBe(penProcessor)
      expect(registry.get('marker')).toBe(penProcessor)
      expect(registry.get('pencil')).toBe(penProcessor)
      expect(registry.get('eraser')).toBe(eraserProcessor)
      expect(registry.get('wiper')).toBe(eraserProcessor)
    })

    it('同类型重复注册应覆盖之前的处理器', () => {
      const registry = new ProcessorRegistry()
      const processor1 = createMockProcessor(['pen'])
      const processor2 = createMockProcessor(['pen'])

      registry.register(processor1)
      expect(registry.get('pen')).toBe(processor1)

      registry.register(processor2)
      expect(registry.get('pen')).toBe(processor2)
    })

    it('部分类型被覆盖时，未被覆盖的类型应保持原处理器', () => {
      const registry = new ProcessorRegistry()
      const processorA = createMockProcessor(['pen', 'marker'])
      const processorB = createMockProcessor(['pen'])

      registry.register(processorA)
      registry.register(processorB)

      // pen 被 processorB 覆盖
      expect(registry.get('pen')).toBe(processorB)
      // marker 仍然是 processorA
      expect(registry.get('marker')).toBe(processorA)
    })

    it('注册 supportedTypes 为空数组的处理器不应影响已有注册', () => {
      const registry = new ProcessorRegistry()
      const processorA = createMockProcessor(['pen'])
      const emptyProcessor = createMockProcessor([])

      registry.register(processorA)
      registry.register(emptyProcessor)

      // pen 应仍然是 processorA
      expect(registry.get('pen')).toBe(processorA)
    })
  })

  describe('has — 检查是否已注册', () => {
    it('has 已注册类型应返回 true', () => {
      const registry = new ProcessorRegistry()
      const processor = createMockProcessor(['pen'])

      registry.register(processor)

      expect(registry.has('pen')).toBe(true)
    })

    it('has 未注册类型应返回 false', () => {
      const registry = new ProcessorRegistry()

      expect(registry.has('pen')).toBe(false)
    })
  })
})
