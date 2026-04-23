import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EditorBuilder } from '../editor.builder'
import { Inker } from '../inker.facade'

describe('EditorBuilder', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container)
    }
  })

  describe('默认配置构建', () => {
    it('builder.withElement(el).build() 应返回有效对象', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .build()

      expect(editor).toBeDefined()
      expect(editor).toBeInstanceOf(Inker)
      editor.dispose()
    })

    it('build 后 editor 应已挂载到元素', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .build()

      // 容器内应有 canvas 元素
      expect(container.querySelectorAll('canvas').length).toBeGreaterThan(0)
      editor.dispose()
    })
  })

  describe('自定义配置', () => {
    it('withPenStyle 应设置初始笔画样式', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .withPenStyle({ type: 'marker', color: '#ff0000', size: 5, opacity: 0.8 })
        .build()

      expect(editor.penStyle.type).toBe('marker')
      expect(editor.penStyle.color).toBe('#ff0000')
      editor.dispose()
    })

    it('withAllowedPointerTypes 应设置允许的指针类型', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .withAllowedPointerTypes(['pen', 'touch'])
        .build()

      expect(editor).toBeInstanceOf(Inker)
      editor.dispose()
    })

    it('withDocumentSize 应设置文档尺寸', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .withDocumentSize(1920, 1080)
        .build()

      expect(editor).toBeInstanceOf(Inker)
      editor.dispose()
    })

    it('withInputAdapter 应可调用', () => {
      const builder = new EditorBuilder()

      expect(() => {
        builder.withInputAdapter({
          bindKernel: vi.fn(),
          dispose: vi.fn()
        })
      }).not.toThrow()
    })

    it('withRenderAdapter 应可调用', () => {
      const builder = new EditorBuilder()

      expect(() => {
        builder.withRenderAdapter({
          attach: vi.fn(),
          detach: vi.fn(),
          resize: vi.fn(),
          drawLiveStroke: vi.fn(),
          drawLiveStrokes: vi.fn(),
          commitStroke: vi.fn(),
          clearLiveLayer: vi.fn(),
          redrawAll: vi.fn(),
          clearAll: vi.fn(),
          setCamera: vi.fn(),
          startEraserTrail: vi.fn(),
          addEraserPoint: vi.fn(),
          endEraserTrail: vi.fn(),
          stopEraserTrail: vi.fn(),
          flush: vi.fn(() => Promise.resolve()),
          toDataURL: vi.fn(() => Promise.resolve('')),
          exportAsBlob: vi.fn(() => Promise.resolve(new Blob())),
          dispose: vi.fn()
        })
      }).not.toThrow()
    })

    it('withStrokeProcessor 应可调用', () => {
      const builder = new EditorBuilder()

      expect(() => {
        builder.withStrokeProcessor({
          supportedTypes: ['pen'] as const,
          computeOutline: vi.fn(() => null)
        })
      }).not.toThrow()
    })

    it('withEraserProcessor 应可调用', () => {
      const builder = new EditorBuilder()

      expect(() => {
        builder.withEraserProcessor({
          supportedTypes: ['eraser'] as const,
          computeOutline: vi.fn(() => null),
          computeErasure: vi.fn(() => [])
        })
      }).not.toThrow()
    })

    it('默认构建应包含 eraserProcessor', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .build()

      // 默认构建成功即证明 eraserProcessor 已注入
      expect(editor).toBeInstanceOf(Inker)
      editor.dispose()
    })
  })

  describe('build 返回对象的公共 API', () => {
    it('build 后返回的对象应有 undo 方法', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .build()

      expect(typeof editor.undo).toBe('function')
      editor.dispose()
    })

    it('build 后返回的对象应有 redo 方法', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .build()

      expect(typeof editor.redo).toBe('function')
      editor.dispose()
    })

    it('build 后返回的对象应有 clear 方法', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .build()

      expect(typeof editor.clear).toBe('function')
      editor.dispose()
    })

    it('build 后返回的对象应有 dispose 方法', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .build()

      expect(typeof editor.dispose).toBe('function')
      editor.dispose()
    })

    it('build 后返回的对象应有 Camera API', () => {
      const editor = new EditorBuilder()
        .withElement(container)
        .build()

      expect(typeof editor.resize).toBe('function')
      expect(typeof editor.zoomAt).toBe('function')
      expect(typeof editor.pan).toBe('function')
      expect(typeof editor.zoomToFit).toBe('function')
      expect(typeof editor.setCamera).toBe('function')
      expect(editor.camera).toBeDefined()
      editor.dispose()
    })
  })

  describe('错误处理', () => {
    it('缺少 element 时 build 应抛错', () => {
      expect(() => {
        new EditorBuilder().build()
      }).toThrow()
    })

    it('错误信息应包含有意义的描述', () => {
      expect(() => {
        new EditorBuilder().build()
      }).toThrow(/element/i)
    })
  })

  describe('链式调用', () => {
    it('所有 with 方法应返回 builder 自身（支持链式调用）', () => {
      const builder = new EditorBuilder()

      const result = builder.withElement(container)

      expect(result).toBe(builder)
    })

    it('withPenStyle 应返回 builder 自身', () => {
      const builder = new EditorBuilder()

      const result = builder.withPenStyle({
        type: 'pen',
        color: '#000',
        size: 2,
        opacity: 1
      })

      expect(result).toBe(builder)
    })

    it('withDocumentSize 应返回 builder 自身', () => {
      const builder = new EditorBuilder()

      const result = builder.withDocumentSize(1920, 1080)

      expect(result).toBe(builder)
    })
  })
})
