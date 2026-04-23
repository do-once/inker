import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorKernel } from '../editor-kernel.service'
import type {
  InputAdapterInterface,
  RenderAdapterInterface,
  StrokeStyle,
  RawPoint,
  Camera
} from '@inker/types'

function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      dispose: vi.fn()
    },
    inputAdapter: {
      bindKernel: vi.fn(),
      dispose: vi.fn()
    } satisfies InputAdapterInterface,
    renderAdapter: {
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
    } satisfies RenderAdapterInterface,
    document: {
      apply: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      getSnapshot: vi.fn(() => ({
        strokes: new Map(),
        strokeOrder: [],
        timestamp: 0
      })),
      getOperations: vi.fn(() => []),
      canUndo: false,
      canRedo: false
    },
    coordinateSystem: {
      screenToWorld: vi.fn((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
      worldToScreen: vi.fn((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
      resizeContainer: vi.fn(),
      computeFitCamera: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
      camera: { x: 0, y: 0, zoom: 1 } as Camera,
      setCamera: vi.fn(),
      toNormalized: vi.fn((p: { x: number; y: number }) => ({ x: p.x / 800, y: p.y / 600 })),
      fromNormalized: vi.fn((p: { x: number; y: number }) => ({ x: p.x * 800, y: p.y * 600 })),
      documentWidth: 800,
      documentHeight: 600,
      containerWidth: 800,
      containerHeight: 600
    }
  }
}

const penStyle: StrokeStyle = { type: 'pen', color: '#000', size: 2, opacity: 1 }
const eraserStyle: StrokeStyle = { type: 'eraser', color: '#000', size: 10, opacity: 1 }

function raw(x = 100, y = 200, pressure = 0.5): RawPoint {
  return { x, y, pressure }
}

describe('EditorKernel 多指针', () => {
  let deps: ReturnType<typeof createMockDeps>
  let kernel: EditorKernel

  beforeEach(() => {
    deps = createMockDeps()
    kernel = new EditorKernel(deps)
  })

  describe('画笔模式 — 多指并发', () => {
    it('双指同时画笔：应产生两个独立的 stroke:start', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)

      const startCalls = deps.document.apply.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'stroke:start'
      )
      expect(startCalls).toHaveLength(2)
      expect(startCalls[0][0].strokeId).toBe('stroke-1')
      expect(startCalls[1][0].strokeId).toBe('stroke-2')
    })

    it('双指 addStrokePoint 应各自触发 drawLiveStrokes（包含两条笔画）', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)
      kernel.addStrokePoint('stroke-1', raw(110, 210), 1016)
      kernel.addStrokePoint('stroke-2', raw(210, 310), 1017)

      const lastCall = deps.renderAdapter.drawLiveStrokes.mock.calls.at(-1)
      expect(lastCall).toBeDefined()
      expect(lastCall![0]).toHaveLength(2)
    })

    it('一指先 endStroke 应 commitStroke，另一指继续', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)
      kernel.addStrokePoint('stroke-1', raw(110, 210), 1016)
      kernel.addStrokePoint('stroke-2', raw(210, 310), 1017)
      kernel.endStroke('stroke-1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
      const lastCall = deps.renderAdapter.drawLiveStrokes.mock.calls.at(-1)
      expect(lastCall![0]).toHaveLength(1)
    })

    it('所有指都 endStroke 后应 clearLiveLayer', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.addStrokePoint('stroke-1', raw(110, 210), 1016)
      kernel.endStroke('stroke-1', 1100)

      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })

    it('三指画笔，中间一指先 endStroke，剩余两指继续', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)
      kernel.startStroke('stroke-3', raw(300, 400), 1002)
      kernel.addStrokePoint('stroke-1', raw(110, 210), 1016)
      kernel.addStrokePoint('stroke-2', raw(210, 310), 1017)
      kernel.addStrokePoint('stroke-3', raw(310, 410), 1018)
      kernel.endStroke('stroke-2', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
      const lastCall = deps.renderAdapter.drawLiveStrokes.mock.calls.at(-1)
      expect(lastCall![0]).toHaveLength(2)
    })
  })

  describe('橡皮擦模式 — 单笔画锁', () => {
    beforeEach(() => {
      kernel.penStyle = eraserStyle
    })

    it('橡皮擦模式第一笔应锁定', () => {
      kernel.startStroke('eraser-1', raw(100, 200), 1000)
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(1)
    })

    it('橡皮擦模式第二笔 startStroke 应被忽略', () => {
      kernel.startStroke('eraser-1', raw(100, 200), 1000)
      kernel.startStroke('eraser-2', raw(200, 300), 1001)
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(1)
    })

    it('橡皮擦锁定笔画 endStroke 后应释放锁', () => {
      kernel.startStroke('eraser-1', raw(100, 200), 1000)
      kernel.endStroke('eraser-1', 1100)
      kernel.startStroke('eraser-3', raw(300, 400), 1200)
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(2)
    })
  })

  describe('模式切换 — 活跃笔画处理', () => {
    it('画笔→橡皮擦切换应结束所有活跃画笔 session', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)
      kernel.addStrokePoint('stroke-1', raw(110, 210), 1016)
      kernel.addStrokePoint('stroke-2', raw(210, 310), 1017)

      kernel.penStyle = eraserStyle

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(2)
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })

    it('橡皮擦→画笔切换应结束橡皮擦 session 并释放锁', () => {
      kernel.penStyle = eraserStyle
      kernel.startStroke('eraser-1', raw(100, 200), 1000)
      expect(deps.renderAdapter.startEraserTrail).toHaveBeenCalledTimes(1)

      kernel.penStyle = penStyle

      expect(deps.renderAdapter.endEraserTrail).toHaveBeenCalled()
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()

      kernel.startStroke('stroke-2', raw(200, 300), 1200)
      const startCalls = deps.document.apply.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'stroke:start'
      )
      expect(startCalls).toHaveLength(1)
    })
  })

  describe('边界情况', () => {
    it('pointercancel 语义（endStroke）应正常提交笔画', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.addStrokePoint('stroke-1', raw(110, 210), 1016)
      // cancel 由适配器转换为 endStroke，kernel 层无需区分
      kernel.endStroke('stroke-1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
    })

    it('undo 在多指绘制中应先结束所有活跃 session', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)

      kernel.undo()

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(2)
      expect(deps.document.undo).toHaveBeenCalledTimes(1)
    })

    it('快速点触（仅 startStroke+endStroke，无 addStrokePoint）应正常提交', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.endStroke('stroke-1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(1)
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })
  })

  describe('visibilitychange', () => {
    it('页面隐藏时应结束所有活跃 session', () => {
      kernel.startStroke('stroke-1', raw(100, 200), 1000)
      kernel.startStroke('stroke-2', raw(200, 300), 1001)

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledTimes(2)
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()

      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })
    })
  })
})
