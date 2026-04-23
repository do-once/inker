import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Inker } from '../inker.facade'

describe('Inker', () => {
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

  /** 辅助函数：创建默认实例 */
  function createEditor() {
    return Inker.create({ element: container })
  }

  // ===== 1. create — 静态工厂方法 =====

  describe('create — 静态工厂方法', () => {
    it('Inker.create({ element }) 应返回 Inker 实例', () => {
      const editor = createEditor()

      expect(editor).toBeInstanceOf(Inker)
      editor.dispose()
    })

    it('创建后容器内应有 canvas 元素', () => {
      const editor = createEditor()

      expect(container.querySelectorAll('canvas').length).toBeGreaterThan(0)
      editor.dispose()
    })
  })

  // ===== 2. penStyle getter/setter =====

  describe('penStyle — 笔画样式', () => {
    it('penStyle getter 应返回当前样式', () => {
      const editor = createEditor()

      const style = editor.penStyle

      expect(style).toBeDefined()
      expect(style.type).toBeDefined()
      expect(style.color).toBeDefined()
      expect(style.size).toBeGreaterThan(0)
      editor.dispose()
    })

    it('penStyle setter 应更新样式', () => {
      const editor = createEditor()

      editor.penStyle = {
        type: 'marker',
        color: '#ff0000',
        size: 8,
        opacity: 0.5
      }

      expect(editor.penStyle.type).toBe('marker')
      expect(editor.penStyle.color).toBe('#ff0000')
      editor.dispose()
    })
  })

  // ===== 3. undo / redo / clear =====

  describe('undo / redo / clear', () => {
    it('undo 方法应可调用', () => {
      const editor = createEditor()

      expect(() => editor.undo()).not.toThrow()
      editor.dispose()
    })

    it('redo 方法应可调用', () => {
      const editor = createEditor()

      expect(() => editor.redo()).not.toThrow()
      editor.dispose()
    })

    it('clear 方法应可调用', () => {
      const editor = createEditor()

      expect(() => editor.clear()).not.toThrow()
      editor.dispose()
    })
  })

  // ===== 4. 状态属性 =====

  describe('状态属性', () => {
    it('canUndo 初始应为 false', () => {
      const editor = createEditor()

      expect(editor.canUndo).toBe(false)
      editor.dispose()
    })

    it('canRedo 初始应为 false', () => {
      const editor = createEditor()

      expect(editor.canRedo).toBe(false)
      editor.dispose()
    })

    it('isEmpty 初始应为 true', () => {
      const editor = createEditor()

      expect(editor.isEmpty).toBe(true)
      editor.dispose()
    })

    it('strokeCount 初始应为 0', () => {
      const editor = createEditor()

      expect(editor.strokeCount).toBe(0)
      editor.dispose()
    })
  })

  // ===== 5. Camera API =====

  describe('Camera API', () => {
    it('camera 应返回初始 camera', () => {
      const editor = createEditor()

      const camera = editor.camera
      expect(camera).toBeDefined()
      expect(camera.zoom).toBeGreaterThan(0)
      editor.dispose()
    })

    it('setCamera 应可调用', () => {
      const editor = createEditor()

      expect(() => editor.setCamera({ x: 10, y: 20, zoom: 1.5 })).not.toThrow()
      editor.dispose()
    })

    it('resize 应可调用', () => {
      const editor = createEditor()

      expect(() => editor.resize(1024, 768)).not.toThrow()
      editor.dispose()
    })

    it('zoomAt 应可调用', () => {
      const editor = createEditor()

      expect(() => editor.zoomAt(400, 300, 2.0)).not.toThrow()
      editor.dispose()
    })

    it('pan 应可调用', () => {
      const editor = createEditor()

      expect(() => editor.pan(100, 50)).not.toThrow()
      editor.dispose()
    })

    it('zoomToFit 应可调用', () => {
      const editor = createEditor()

      expect(() => editor.zoomToFit()).not.toThrow()
      editor.dispose()
    })
  })

  // ===== 6. 事件订阅 =====

  describe('事件订阅', () => {
    it('on 应注册事件监听器', () => {
      const editor = createEditor()
      const handler = vi.fn()

      expect(() => editor.on('document:changed', handler)).not.toThrow()
      editor.dispose()
    })

    it('off 应移除事件监听器', () => {
      const editor = createEditor()
      const handler = vi.fn()

      editor.on('document:changed', handler)

      expect(() => editor.off('document:changed', handler)).not.toThrow()
      editor.dispose()
    })

    it('on 应返回取消订阅函数', () => {
      const editor = createEditor()
      const handler = vi.fn()

      const unsubscribe = editor.on('document:changed', handler)

      expect(typeof unsubscribe).toBe('function')
      editor.dispose()
    })
  })

  // ===== 新增 API =====

  describe('getSnapshot', () => {
    it('应返回文档快照', () => {
      const editor = createEditor()

      const snapshot = editor.getSnapshot()

      expect(snapshot).toBeDefined()
      expect(snapshot.strokes).toBeInstanceOf(Map)
      expect(snapshot.strokeOrder).toBeInstanceOf(Array)
      editor.dispose()
    })
  })

  describe('getOperations', () => {
    it('应返回操作数组', () => {
      const editor = createEditor()

      const ops = editor.getOperations()

      expect(Array.isArray(ops)).toBe(true)
      editor.dispose()
    })
  })

  describe('renderAdapter', () => {
    it('应返回渲染适配器引用', () => {
      const editor = createEditor()

      const adapter = editor.renderAdapter

      expect(adapter).toBeDefined()
      expect(typeof adapter.exportAsBlob).toBe('function')
      editor.dispose()
    })
  })

  describe('applyOperation', () => {
    it('应可调用而不抛出错误', () => {
      const editor = createEditor()

      expect(() => editor.applyOperation({
        type: 'stroke:clear',
        timestamp: Date.now()
      })).not.toThrow()
      editor.dispose()
    })
  })

  // ===== 7. dispose — 销毁 =====

  describe('dispose — 销毁', () => {
    it('dispose 应清理所有资源', () => {
      const editor = createEditor()

      editor.dispose()

      // dispose 后容器内 canvas 应被移除
      expect(container.querySelectorAll('canvas').length).toBe(0)
    })

    it('dispose 后再次调用不应抛错', () => {
      const editor = createEditor()

      editor.dispose()

      expect(() => editor.dispose()).not.toThrow()
    })

    it('dispose 后调用 undo/redo/clear 不应抛出未处理异常', () => {
      const editor = createEditor()

      editor.dispose()

      // dispose 后调用方法应不抛错，或抛出已销毁错误（均可接受）
      const safeCall = (fn: () => void) => {
        try {
          fn()
        } catch (e: any) {
          // 如果抛错，应该是"已销毁"相关的错误，而非未定义属性等运行时错误
          expect(e.message).toMatch(/dispos|destroy/i)
        }
      }

      safeCall(() => editor.undo())
      safeCall(() => editor.redo())
      safeCall(() => editor.clear())
    })
  })
})
