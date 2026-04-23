import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OffscreenRenderAdapter } from '../offscreen-render.adapter'
import type { StrokePoint, StrokeStyle, StrokeData } from '@inker/types'

/** Mock Worker，拦截 postMessage 并支持模拟回复 */
function createMockWorker() {
  let messageHandler: ((e: MessageEvent) => void) | null = null
  let errorHandler: ((e: ErrorEvent) => void) | null = null
  const posted: unknown[] = []
  return {
    postMessage: vi.fn((data: unknown) => { posted.push(data) }),
    set onmessage(fn: ((e: MessageEvent) => void) | null) { messageHandler = fn },
    get onmessage() { return messageHandler },
    set onerror(fn: ((e: ErrorEvent) => void) | null) { errorHandler = fn },
    get onerror() { return errorHandler },
    terminate: vi.fn(),
    simulateResponse(data: unknown) {
      messageHandler?.({ data } as MessageEvent)
    },
    posted
  }
}

const testPoints: StrokePoint[] = [
  { x: 10, y: 20, t: 0, p: 0.5 },
  { x: 30, y: 40, t: 16, p: 0.6 },
  { x: 50, y: 60, t: 32, p: 0.7 }
]

const defaultStyle: StrokeStyle = {
  type: 'pen',
  color: '#000000',
  size: 2,
  opacity: 1
}

describe('OffscreenRenderAdapter', () => {
  let container: HTMLElement
  let mockWorker: ReturnType<typeof createMockWorker>
  let adapter: OffscreenRenderAdapter

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)

    // 拦截 Worker 构造函数
    mockWorker = createMockWorker()
    vi.stubGlobal('Worker', vi.fn(() => mockWorker))

    adapter = new OffscreenRenderAdapter('worker.js')
  })

  afterEach(() => {
    adapter.dispose()
    if (container.parentElement) container.parentElement.removeChild(container)
    vi.restoreAllMocks()
  })

  describe('生命周期', () => {
    it('attach 应创建两个 Canvas 并发送 init 消息', () => {
      adapter.attach(container, 800, 600)

      // 应创建两个 canvas 子元素
      const canvases = container.querySelectorAll('canvas')
      expect(canvases.length).toBe(2)

      // 第一个 canvas（renderCanvas）应禁止指针事件
      expect(canvases[0].style.pointerEvents).toBe('none')

      // Worker 应收到 init 消息
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
      const initMsg = mockWorker.posted[0] as { cmd: string }
      expect(initMsg.cmd).toBe('init')
    })

    it('detach 应移除 Canvas 元素', () => {
      adapter.attach(container, 800, 600)
      expect(container.querySelectorAll('canvas').length).toBe(2)

      adapter.detach()
      expect(container.querySelectorAll('canvas').length).toBe(0)
    })

    it('dispose 应终止 Worker 并移除 Canvas', () => {
      adapter.attach(container, 800, 600)
      adapter.dispose()

      expect(mockWorker.terminate).toHaveBeenCalled()
      expect(container.querySelectorAll('canvas').length).toBe(0)
    })

    it('dispose 多次调用不应抛错', () => {
      adapter.attach(container, 800, 600)
      expect(() => {
        adapter.dispose()
        adapter.dispose()
      }).not.toThrow()
    })
  })

  describe('resize', () => {
    it('resize 应发送 resize 指令到 Worker', () => {
      adapter.attach(container, 800, 600)
      mockWorker.posted.length = 0 // 清除 init 消息

      adapter.resize(1024, 768)

      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        cmd: 'resize', width: 1024, height: 768
      })
    })

    it('resize 应同步更新 Canvas CSS 尺寸', () => {
      adapter.attach(container, 800, 600)
      adapter.resize(1024, 768)

      const canvases = container.querySelectorAll('canvas')
      for (const canvas of canvases) {
        expect(canvas.style.width).toBe('1024px')
        expect(canvas.style.height).toBe('768px')
      }
    })
  })

  describe('fire-and-forget 绘制指令', () => {
    beforeEach(() => {
      adapter.attach(container, 800, 600)
      mockWorker.posted.length = 0
    })

    it('drawLiveStroke 应发送 drawLive 指令', () => {
      adapter.drawLiveStroke(testPoints, defaultStyle)

      const msg = mockWorker.posted[0] as { cmd: string; points: StrokePoint[]; style: StrokeStyle }
      expect(msg.cmd).toBe('drawLive')
      expect(msg.points).toEqual(testPoints)
      expect(msg.style).toBe(defaultStyle)
    })

    it('commitStroke 应发送 commit 指令', () => {
      adapter.commitStroke(testPoints, defaultStyle)

      const msg = mockWorker.posted[0] as { cmd: string }
      expect(msg.cmd).toBe('commit')
    })

    it('clearLiveLayer 应发送 clearLive 指令', () => {
      adapter.clearLiveLayer()
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ cmd: 'clearLive' })
    })

    it('clearAll 应发送 clearAll 指令', () => {
      adapter.clearAll()
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ cmd: 'clearAll' })
    })

    it('setCamera 应发送 setCamera 指令', () => {
      const camera = { x: 100, y: 200, zoom: 1.5 }
      adapter.setCamera(camera)
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ cmd: 'setCamera', camera })
    })

    it('redrawAll 应发送 redrawAll 指令', () => {
      const strokes: StrokeData[] = [
        { points: testPoints, style: defaultStyle }
      ]
      adapter.redrawAll(strokes)

      const msg = mockWorker.posted[0] as { cmd: string; strokes: StrokeData[] }
      expect(msg.cmd).toBe('redrawAll')
      expect(msg.strokes).toHaveLength(1)
    })
  })

  describe('橡皮擦轨迹指令', () => {
    beforeEach(() => {
      adapter.attach(container, 800, 600)
      mockWorker.posted.length = 0
    })

    it('startEraserTrail 应发送 startEraserTrail 指令', () => {
      adapter.startEraserTrail(20)
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ cmd: 'startEraserTrail', baseSize: 20 })
    })

    it('addEraserPoint 应发送 addEraserPoint 指令', () => {
      adapter.addEraserPoint({ x: 100, y: 200 })
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ cmd: 'addEraserPoint', point: { x: 100, y: 200 } })
    })

    it('endEraserTrail 应发送 endEraserTrail 指令', () => {
      adapter.endEraserTrail()
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ cmd: 'endEraserTrail' })
    })

    it('stopEraserTrail 应发送 stopEraserTrail 指令', () => {
      adapter.stopEraserTrail()
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ cmd: 'stopEraserTrail' })
    })
  })

  describe('request-response 异步方法', () => {
    beforeEach(() => {
      adapter.attach(container, 800, 600)
      mockWorker.posted.length = 0
    })

    it('flush 应发送 flush 指令并等待回复', async () => {
      const promise = adapter.flush()

      const msg = mockWorker.posted[0] as { cmd: string; id: number }
      expect(msg.cmd).toBe('flush')
      expect(msg.id).toBeGreaterThan(0)

      mockWorker.simulateResponse({ cmd: 'flushed', id: msg.id })
      await expect(promise).resolves.toBeUndefined()
    })

    it('exportAsBlob 应发送 export 指令并返回 Blob', async () => {
      const promise = adapter.exportAsBlob('png')

      const msg = mockWorker.posted[0] as { cmd: string; id: number; format: string }
      expect(msg.cmd).toBe('export')
      expect(msg.format).toBe('png')

      const blob = new Blob(['test'], { type: 'image/png' })
      mockWorker.simulateResponse({ cmd: 'exported', id: msg.id, blob })

      const result = await promise
      expect(result).toBe(blob)
    })

    it('exportAsBlob 支持 jpeg + quality', async () => {
      const promise = adapter.exportAsBlob('jpeg', 0.8)

      const msg = mockWorker.posted[0] as { cmd: string; format: string; quality: number }
      expect(msg.format).toBe('jpeg')
      expect(msg.quality).toBe(0.8)

      mockWorker.simulateResponse({ cmd: 'exported', id: (msg as any).id, blob: new Blob() })
      await promise
    })

    it('toDataURL 应发送 toDataURL 指令并返回字符串', async () => {
      const promise = adapter.toDataURL()

      const msg = mockWorker.posted[0] as { cmd: string; id: number }
      expect(msg.cmd).toBe('toDataURL')

      mockWorker.simulateResponse({ cmd: 'dataURL', id: msg.id, url: 'data:image/png;base64,abc' })

      const result = await promise
      expect(result).toBe('data:image/png;base64,abc')
    })
  })

  describe('guard 行为（未 attach）', () => {
    it('drawLiveStroke 在 attach 前调用不应抛错', () => {
      expect(() => adapter.drawLiveStroke(testPoints, defaultStyle)).not.toThrow()
    })

    it('commitStroke 在 attach 前调用不应抛错', () => {
      expect(() => adapter.commitStroke(testPoints, defaultStyle)).not.toThrow()
    })

    it('flush 在 attach 前应返回 resolved Promise', async () => {
      await expect(adapter.flush()).resolves.toBeUndefined()
    })

    it('exportAsBlob 在 attach 前应返回空 Blob', async () => {
      const blob = await adapter.exportAsBlob('png')
      expect(blob.size).toBe(0)
    })

    it('toDataURL 在 attach 前应返回空字符串', async () => {
      const url = await adapter.toDataURL()
      expect(url).toBe('')
    })
  })
})
