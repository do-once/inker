import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CanvasLayerManager } from '../canvas-layer-manager.service'

describe('CanvasLayerManager', () => {
  let container: HTMLElement
  let manager: CanvasLayerManager

  beforeEach(() => {
    container = document.createElement('div')
    // 模拟容器尺寸
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (manager) {
      manager.dispose()
    }
    document.body.removeChild(container)
  })

  describe('创建 — 双层 Canvas 架构', () => {
    it('创建时应生成两个 canvas 元素', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      const canvases = container.querySelectorAll('canvas')
      expect(canvases.length).toBe(2)
    })

    it('两层 canvas 应叠放在同一容器中（position: absolute）', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      const canvases = container.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        expect(canvas.style.position).toBe('absolute')
      })
    })

    it('rendering layer 的 pointerEvents 应为 none', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      const renderContext = manager.getRenderContext()
      const renderCanvas = renderContext.canvas as HTMLCanvasElement
      expect(renderCanvas.style.pointerEvents).toBe('none')
    })

    it('capturing layer 的 pointerEvents 不应为 none', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      const liveContext = manager.getLiveContext()
      const liveCanvas = liveContext.canvas as HTMLCanvasElement
      expect(liveCanvas.style.pointerEvents).not.toBe('none')
    })
  })

  describe('DPI 缩放', () => {
    it('应根据 devicePixelRatio 缩放 canvas 物理尺寸', () => {
      // 模拟 devicePixelRatio = 2
      const originalDpr = window.devicePixelRatio
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })

      manager = new CanvasLayerManager(container, 800, 600)

      const canvases = container.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        // 物理像素应为 CSS 像素 * DPR
        expect(canvas.width).toBe(800 * 2)
        expect(canvas.height).toBe(600 * 2)
      })

      Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true })
    })

    it('CSS 尺寸应与逻辑尺寸一致', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      const canvases = container.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        expect(canvas.style.width).toBe('800px')
        expect(canvas.style.height).toBe('600px')
      })
    })
  })

  describe('resize — 调整尺寸', () => {
    it('resize 应正确调整两层尺寸', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      manager.resize(1024, 768)

      const canvases = container.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        expect(canvas.style.width).toBe('1024px')
        expect(canvas.style.height).toBe('768px')
      })
    })

    it('resize 应重新应用 DPI 缩放', () => {
      const originalDpr = window.devicePixelRatio
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })

      manager = new CanvasLayerManager(container, 800, 600)
      manager.resize(1024, 768)

      const canvases = container.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        expect(canvas.width).toBe(1024 * 2)
        expect(canvas.height).toBe(768 * 2)
      })

      Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true })
    })
  })

  describe('context 获取', () => {
    it('getLiveContext 应返回 capturing layer 的 2D context', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      const ctx = manager.getLiveContext()

      expect(ctx).toBeDefined()
      expect(ctx).toBeInstanceOf(CanvasRenderingContext2D)
    })

    it('getRenderContext 应返回 rendering layer 的 2D context', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      const ctx = manager.getRenderContext()

      expect(ctx).toBeDefined()
      expect(ctx).toBeInstanceOf(CanvasRenderingContext2D)
    })

    it('getLiveContext 和 getRenderContext 应返回不同的 context', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      const liveCtx = manager.getLiveContext()
      const renderCtx = manager.getRenderContext()

      expect(liveCtx).not.toBe(renderCtx)
    })
  })

  describe('dispose — 清理', () => {
    it('dispose 应移除两个 canvas 元素', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      expect(container.querySelectorAll('canvas').length).toBe(2)

      manager.dispose()

      expect(container.querySelectorAll('canvas').length).toBe(0)
    })

    it('dispose 后再次调用不应抛错', () => {
      manager = new CanvasLayerManager(container, 800, 600)

      manager.dispose()

      expect(() => manager.dispose()).not.toThrow()
    })
  })
})
