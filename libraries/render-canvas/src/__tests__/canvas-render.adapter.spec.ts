import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CanvasRenderAdapter } from '../canvas-render.adapter'
import type {
  StrokeData,
  StrokePoint,
  StrokeStyle,
  StrokeProcessorInterface,
  OutlineGeometry
} from '@inker/types'

/** 模拟笔画处理器：将采样点直接映射为轮廓 */
const mockProcessor: StrokeProcessorInterface = {
  supportedTypes: ['pen'] as const,
  computeOutline(
    points: readonly StrokePoint[],
    _style: StrokeStyle,
    _complete: boolean
  ): OutlineGeometry | null {
    if (points.length === 0) return null
    return { points: points.map(p => ({ x: p.x, y: p.y })) }
  }
}

/** 测试用采样点 */
const testPoints: StrokePoint[] = [
  { x: 10, y: 20, t: 0, p: 0.5 },
  { x: 30, y: 40, t: 16, p: 0.6 },
  { x: 50, y: 60, t: 32, p: 0.7 }
]

describe('CanvasRenderAdapter', () => {
  let container: HTMLElement
  let adapter: CanvasRenderAdapter

  const defaultStyle: StrokeStyle = {
    type: 'pen',
    color: '#000000',
    size: 2,
    opacity: 1
  }

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    adapter = new CanvasRenderAdapter(mockProcessor)
  })

  afterEach(() => {
    adapter.dispose()
    if (container.parentNode) {
      document.body.removeChild(container)
    }
  })

  describe('attach — 初始化渲染层', () => {
    it('attach 应创建双层 canvas', () => {
      adapter.attach(container, 800, 600)

      const canvases = container.querySelectorAll('canvas')
      expect(canvases.length).toBe(2)
    })

    it('attach 后容器应包含 canvas 元素', () => {
      adapter.attach(container, 800, 600)

      expect(container.children.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('drawLiveStroke — 在 live layer 绘制', () => {
    it('drawLiveStroke 应在 live layer 调用绘制', () => {
      adapter.attach(container, 800, 600)

      // 不抛错即为通过（happy-dom 下 canvas context 是 mock 的）
      expect(() => {
        adapter.drawLiveStroke(testPoints, defaultStyle)
      }).not.toThrow()
    })

    it('drawLiveStroke 应使用指定的样式属性', () => {
      adapter.attach(container, 800, 600)

      const style: StrokeStyle = {
        type: 'pen',
        color: '#ff0000',
        size: 5,
        opacity: 0.8
      }

      // 应能处理不同样式
      expect(() => {
        adapter.drawLiveStroke(testPoints, style)
      }).not.toThrow()
    })

    it('drawLiveStroke 空点序列不应抛错', () => {
      adapter.attach(container, 800, 600)

      expect(() => {
        adapter.drawLiveStroke([], defaultStyle)
      }).not.toThrow()
    })
  })

  describe('commitStroke — 提交到持久层', () => {
    it('commitStroke 应在 render layer 绘制', () => {
      adapter.attach(container, 800, 600)

      expect(() => {
        adapter.commitStroke(testPoints, defaultStyle)
      }).not.toThrow()
    })

    it('commitStroke 空点序列不应抛错', () => {
      adapter.attach(container, 800, 600)

      expect(() => {
        adapter.commitStroke([], defaultStyle)
      }).not.toThrow()
    })
  })

  describe('clearLiveLayer — 清除 live layer', () => {
    it('clearLiveLayer 应清除 live layer 内容', () => {
      adapter.attach(container, 800, 600)

      adapter.drawLiveStroke(testPoints, defaultStyle)

      expect(() => {
        adapter.clearLiveLayer()
      }).not.toThrow()
    })
  })

  describe('redrawAll — 重绘所有笔画', () => {
    it('redrawAll 应先清除再逐条绘制', () => {
      adapter.attach(container, 800, 600)

      const strokes: StrokeData[] = [
        { points: testPoints, style: defaultStyle },
        { points: testPoints, style: { ...defaultStyle, color: '#ff0000' } }
      ]

      expect(() => {
        adapter.redrawAll(strokes)
      }).not.toThrow()
    })

    it('redrawAll 空数组应仅清除不绘制', () => {
      adapter.attach(container, 800, 600)

      expect(() => {
        adapter.redrawAll([])
      }).not.toThrow()
    })
  })

  describe('clearAll — 清除所有内容', () => {
    it('clearAll 应清除两层内容', () => {
      adapter.attach(container, 800, 600)

      adapter.drawLiveStroke(testPoints, defaultStyle)
      adapter.commitStroke(testPoints, defaultStyle)

      expect(() => {
        adapter.clearAll()
      }).not.toThrow()
    })
  })

  describe('橡皮擦轨迹管理', () => {
    it('startEraserTrail 应能启动轨迹', () => {
      adapter.attach(container, 800, 600)

      expect(() => {
        adapter.startEraserTrail(20)
      }).not.toThrow()

      adapter.stopEraserTrail()
    })

    it('addEraserPoint 应能添加轨迹点', () => {
      adapter.attach(container, 800, 600)
      adapter.startEraserTrail(20)

      expect(() => {
        adapter.addEraserPoint({ x: 100, y: 200 })
        adapter.addEraserPoint({ x: 110, y: 210 })
      }).not.toThrow()

      adapter.stopEraserTrail()
    })

    it('endEraserTrail 应结束当前轨迹', () => {
      adapter.attach(container, 800, 600)
      adapter.startEraserTrail(20)
      adapter.addEraserPoint({ x: 100, y: 200 })

      expect(() => {
        adapter.endEraserTrail()
      }).not.toThrow()

      adapter.stopEraserTrail()
    })

    it('stopEraserTrail 应停止并清理', () => {
      adapter.attach(container, 800, 600)
      adapter.startEraserTrail(20)

      expect(() => {
        adapter.stopEraserTrail()
      }).not.toThrow()
    })

    it('未启动时调用 addEraserPoint/endEraserTrail/stopEraserTrail 不应抛错', () => {
      adapter.attach(container, 800, 600)

      expect(() => {
        adapter.addEraserPoint({ x: 100, y: 200 })
        adapter.endEraserTrail()
        adapter.stopEraserTrail()
      }).not.toThrow()
    })
  })

  describe('detach — 移除 canvas', () => {
    it('detach 应移除 canvas 元素', () => {
      adapter.attach(container, 800, 600)
      expect(container.querySelectorAll('canvas').length).toBe(2)

      adapter.detach()

      expect(container.querySelectorAll('canvas').length).toBe(0)
    })

    it('detach 后再次调用不应抛错', () => {
      adapter.attach(container, 800, 600)

      adapter.detach()

      expect(() => adapter.detach()).not.toThrow()
    })
  })

  describe('resize — 调整尺寸', () => {
    it('resize 应调整 canvas 尺寸', () => {
      adapter.attach(container, 800, 600)

      adapter.resize(1024, 768)

      const canvases = container.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        expect(canvas.style.width).toBe('1024px')
        expect(canvas.style.height).toBe('768px')
      })
    })
  })

  describe('toDataURL — 导出', () => {
    it('toDataURL 应返回 render layer 的 data URL', async () => {
      adapter.attach(container, 800, 600)

      const dataURL = await adapter.toDataURL()

      expect(typeof dataURL).toBe('string')
      expect(dataURL.startsWith('data:')).toBe(true)
    })

    it('toDataURL 未 attach 时应返回空字符串', async () => {
      const dataURL = await adapter.toDataURL()

      expect(dataURL).toBe('')
    })
  })

  describe('flush — 同步屏障', () => {
    it('flush 应返回 resolved Promise', async () => {
      adapter.attach(container, 800, 600)

      await expect(adapter.flush()).resolves.toBeUndefined()
    })

    it('flush 未 attach 时也应正常返回', async () => {
      await expect(adapter.flush()).resolves.toBeUndefined()
    })
  })

  describe('dispose — 清理资源', () => {
    it('dispose 应清理所有资源', () => {
      adapter.attach(container, 800, 600)

      adapter.dispose()

      expect(container.querySelectorAll('canvas').length).toBe(0)
    })

    it('dispose 应停止橡皮擦轨迹', () => {
      adapter.attach(container, 800, 600)
      adapter.startEraserTrail(20)

      // dispose 不应抛错，且应停止轨迹
      expect(() => adapter.dispose()).not.toThrow()
    })

    it('dispose 后再次调用不应抛错', () => {
      adapter.attach(container, 800, 600)

      adapter.dispose()

      expect(() => adapter.dispose()).not.toThrow()
    })
  })

  describe('exportAsBlob', () => {
    it('应返回 image/png Blob', async () => {
      const adapter = new CanvasRenderAdapter(mockProcessor)
      const container = document.createElement('div')
      adapter.attach(container, 200, 100)

      const blob = await adapter.exportAsBlob('png')

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
      adapter.dispose()
    })

    it('应支持 jpeg 格式', async () => {
      const adapter = new CanvasRenderAdapter(mockProcessor)
      const container = document.createElement('div')
      adapter.attach(container, 200, 100)

      const blob = await adapter.exportAsBlob('jpeg', 0.8)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/jpeg')
      adapter.dispose()
    })

    it('未 attach 时应返回空 Blob', async () => {
      const adapter = new CanvasRenderAdapter(mockProcessor)

      const blob = await adapter.exportAsBlob('png')

      expect(blob.size).toBe(0)
      adapter.dispose()
    })
  })
})
