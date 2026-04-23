import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorKernel } from '../editor-kernel.service'
import type {
  InputAdapterInterface,
  RenderAdapterInterface,
  StrokeProcessorInterface,
  StrokeStyle,
  StrokeType,
  RawPoint,
  Camera
} from '@inker/types'

// ===== Mock 工厂函数 =====

/** 创建全套 mock 依赖 */
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
      toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
      exportAsBlob: vi.fn(() => Promise.resolve(new Blob([], { type: 'image/png' }))),
      dispose: vi.fn()
    } satisfies RenderAdapterInterface,
    document: {
      apply: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      getSnapshot: vi.fn(() => ({
        strokes: new Map() as Map<string, any>,
        strokeOrder: [] as string[],
        timestamp: 0
      })),
      getOperations: vi.fn(() => [] as unknown[]),
      canUndo: false,
      canRedo: false
    },
    coordinateSystem: {
      screenToWorld: vi.fn((p: { x: number; y: number }) => ({
        x: p.x,
        y: p.y
      })),
      worldToScreen: vi.fn((p: { x: number; y: number }) => ({
        x: p.x,
        y: p.y
      })),
      resizeContainer: vi.fn(),
      computeFitCamera: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
      camera: { x: 0, y: 0, zoom: 1 } as Camera,
      setCamera: vi.fn(),
      toNormalized: vi.fn((p: { x: number; y: number }) => ({
        x: p.x / 800,
        y: p.y / 600
      })),
      fromNormalized: vi.fn((p: { x: number; y: number }) => ({
        x: p.x * 800,
        y: p.y * 600
      })),
      documentWidth: 800,
      documentHeight: 600,
      containerWidth: 800,
      containerHeight: 600
    },
    eraserProcessor: undefined as StrokeProcessorInterface | undefined
  }
}

const defaultStyle: StrokeStyle = {
  type: 'pen',
  color: '#000000',
  size: 2,
  opacity: 1
}

/** 构造 RawPoint */
function raw(x: number, y: number, pressure = 0.5): RawPoint {
  return { x, y, pressure }
}

describe('EditorKernel', () => {
  let deps: ReturnType<typeof createMockDeps>

  beforeEach(() => {
    deps = createMockDeps()
  })

  function createKernel() {
    return new EditorKernel(deps)
  }

  // ===== 1. 构造 & 初始化 =====

  describe('构造 & 初始化', () => {
    it('应能正常构造（传入全部 mock 依赖）', () => {
      const kernel = createKernel()

      expect(kernel).toBeDefined()
      expect(kernel).toBeInstanceOf(EditorKernel)
    })

    it('构造后不再自动注册 inputAdapter.onInput（改用 bindKernel）', () => {
      createKernel()

      // bindKernel 由 EditorBuilder 在构造后调用，kernel 本身不主动调用
      expect(deps.inputAdapter.bindKernel).not.toHaveBeenCalled()
    })
  })

  // ===== 2. startStroke — pointerDown 语义 =====

  describe('startStroke', () => {
    it('调用 startStroke 时应调用 coordinateSystem.screenToWorld 转换坐标', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)

      expect(deps.coordinateSystem.screenToWorld).toHaveBeenCalled()
      const callArg = (deps.coordinateSystem.screenToWorld as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArg.x).toBe(100)
      expect(callArg.y).toBe(200)
    })

    it('startStroke 应调用 document.apply 传入 stroke:start 操作', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)

      expect(deps.document.apply).toHaveBeenCalled()
      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.type).toBe('stroke:start')
    })

    it('stroke:start 操作应包含世界坐标点', () => {
      deps.coordinateSystem.screenToWorld = vi.fn((p: { x: number; y: number }) => ({
        x: p.x * 2,
        y: p.y * 2
      }))
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200, 0.5), 1000)

      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.type).toBe('stroke:start')
      expect(op.point.x).toBe(200)
      expect(op.point.y).toBe(400)
    })

    it('stroke:start 操作应包含传入的笔画样式和时间戳', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200, 0.5), 1000)

      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.type).toBe('stroke:start')
      expect(op.style).toMatchObject(defaultStyle)
      expect(op.timestamp).toBe(1000)
    })
  })

  // ===== 3. addStrokePoint — pointerMove 语义 =====

  describe('addStrokePoint', () => {
    it('调用 addStrokePoint 时应调用 document.apply 传入 stroke:addPoint 操作', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6), 1016)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const addPointCall = calls.find((c: any[]) => c[0].type === 'stroke:addPoint')
      expect(addPointCall).toBeDefined()
    })

    it('addStrokePoint 应触发渲染（drawLiveStrokes 被调用）', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6), 1016)

      expect(deps.renderAdapter.drawLiveStrokes).toHaveBeenCalled()
    })

    it('未 startStroke 直接 addStrokePoint 不应触发任何操作', () => {
      const kernel = createKernel()

      kernel.addStrokePoint('nonexistent', raw(110, 210), 1000)

      expect(deps.document.apply).not.toHaveBeenCalled()
      expect(deps.renderAdapter.drawLiveStrokes).not.toHaveBeenCalled()
    })
  })

  // ===== 4. endStroke — pointerUp 语义 =====

  describe('endStroke', () => {
    it('调用 endStroke 时应调用 document.apply 传入 stroke:end 操作', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const endCall = calls.find((c: any[]) => c[0].type === 'stroke:end')
      expect(endCall).toBeDefined()
    })

    it('stroke:end 操作应包含时间戳', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const endCall = calls.find((c: any[]) => c[0].type === 'stroke:end')
      expect(endCall![0].timestamp).toBe(1100)
    })

    it('endStroke 应调用 renderAdapter.commitStroke', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalled()
    })

    it('endStroke 应调用 renderAdapter.clearLiveLayer', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    })

    it('endStroke 应通过 eventBus 发出 document:changed 事件', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'document:changed',
        expect.anything()
      )
    })

    it('未 startStroke 直接 endStroke 不应触发任何操作', () => {
      const kernel = createKernel()

      kernel.endStroke('nonexistent', 1100)

      expect(deps.document.apply).not.toHaveBeenCalled()
      expect(deps.renderAdapter.commitStroke).not.toHaveBeenCalled()
    })

    it('画笔结束时应 emit stroke:end 事件，payload 包含完整 stroke 对象', () => {
      const strokeId = 's1'
      const mockStroke = {
        id: strokeId,
        points: [{ x: 100, y: 200, p: 0.5, t: 1000 }],
        style: defaultStyle,
        createdAt: 1000
      }
      deps.document.getSnapshot = vi.fn(() => ({
        strokes: new Map([[strokeId, mockStroke]]),
        strokeOrder: [strokeId],
        timestamp: 1100
      }))
      const kernel = createKernel()

      kernel.startStroke(strokeId, raw(100, 200), 1000)
      kernel.endStroke(strokeId, 1100)

      expect(deps.eventBus.emit).toHaveBeenCalledWith('stroke:end', { stroke: mockStroke })
    })

    it('stroke:end 事件应在 document:changed 事件之前触发', () => {
      const strokeId = 's1'
      const mockStroke = {
        id: strokeId,
        points: [{ x: 100, y: 200, p: 0.5, t: 1000 }],
        style: defaultStyle,
        createdAt: 1000
      }
      deps.document.getSnapshot = vi.fn(() => ({
        strokes: new Map([[strokeId, mockStroke]]),
        strokeOrder: [strokeId],
        timestamp: 1100
      }))
      const kernel = createKernel()
      const emitOrder: string[] = []
      deps.eventBus.emit = vi.fn((event: string) => {
        emitOrder.push(event)
      })

      kernel.startStroke(strokeId, raw(100, 200), 1000)
      kernel.endStroke(strokeId, 1100)

      const strokeEndIndex = emitOrder.indexOf('stroke:end')
      const documentChangedIndex = emitOrder.indexOf('document:changed')
      expect(strokeEndIndex).toBeGreaterThanOrEqual(0)
      expect(documentChangedIndex).toBeGreaterThanOrEqual(0)
      expect(strokeEndIndex).toBeLessThan(documentChangedIndex)
    })

    it('橡皮擦结束时不应 emit stroke:end 事件', () => {
      const eraserStyle: StrokeStyle = { type: 'eraser', color: '#ffffff', size: 20, opacity: 1 }
      deps.eraserProcessor = {
        supportedTypes: ['eraser', 'wiper'] as readonly StrokeType[],
        computeOutline: vi.fn(() => null),
        computeErasure: vi.fn(() => [])
      } satisfies StrokeProcessorInterface
      const kernel = createKernel()
      kernel.penStyle = eraserStyle

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      const emitCalls = (deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls
      const strokeEndCall = emitCalls.find((c: any[]) => c[0] === 'stroke:end')
      expect(strokeEndCall).toBeUndefined()
    })
  })

  // ===== 4.5 渲染委托参数 =====

  describe('渲染委托参数', () => {
    it('addStrokePoint 时 drawLiveStrokes 传入包含 (points, style) 的笔画数组', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6), 1016)

      expect(deps.renderAdapter.drawLiveStrokes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            points: expect.any(Array),
            style: expect.objectContaining({ type: 'pen' })
          })
        ])
      )
    })

    it('endStroke 时 commitStroke 传入 (points, style)', () => {
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.endStroke('s1', 1100)

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ type: 'pen' })
      )
    })

    it('redrawFromSnapshot 使用 redrawAll(strokes)', () => {
      const strokeMap = new Map([
        ['s1', { id: 's1', points: [{ x: 400, y: 300, p: 0.5, t: 0 }], style: defaultStyle, createdAt: 0 }]
      ])
      deps.document.getSnapshot = vi.fn(() => ({
        strokes: strokeMap,
        strokeOrder: ['s1'],
        timestamp: 0
      }))
      const kernel = createKernel()

      kernel.undo()

      expect(deps.renderAdapter.redrawAll).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            points: expect.any(Array),
            style: expect.objectContaining({ type: 'pen' })
          })
        ])
      )
    })
  })

  // ===== 5. undo / redo / clear =====

  describe('undo / redo / clear', () => {
    it('undo() 应调用 document.undo()', () => {
      const kernel = createKernel()
      kernel.undo()
      expect(deps.document.undo).toHaveBeenCalled()
    })

    it('undo() 应触发 redrawAll', () => {
      const kernel = createKernel()
      kernel.undo()
      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
    })

    it('redo() 应调用 document.redo()', () => {
      const kernel = createKernel()
      kernel.redo()
      expect(deps.document.redo).toHaveBeenCalled()
    })

    it('redo() 应触发 redrawAll', () => {
      const kernel = createKernel()
      kernel.redo()
      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
    })

    it('clear() 应调用 document.apply(stroke:clear)', () => {
      const kernel = createKernel()
      kernel.clear()

      expect(deps.document.apply).toHaveBeenCalled()
      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.type).toBe('stroke:clear')
    })

    it('clear() 应调用 renderAdapter.clearAll', () => {
      const kernel = createKernel()
      kernel.clear()
      expect(deps.renderAdapter.clearAll).toHaveBeenCalled()
    })
  })

  // ===== 6. penStyle getter/setter =====

  describe('penStyle getter/setter', () => {
    it('get penStyle 应返回当前样式', () => {
      const kernel = createKernel()
      const style = kernel.penStyle

      expect(style).toBeDefined()
      expect(style.type).toBeDefined()
      expect(style.color).toBeDefined()
      expect(style.size).toBeGreaterThan(0)
    })

    it('set penStyle 应更新样式', () => {
      const kernel = createKernel()
      const newStyle: StrokeStyle = { type: 'marker', color: '#ff0000', size: 5, opacity: 0.8 }

      kernel.penStyle = newStyle

      expect(kernel.penStyle.type).toBe('marker')
      expect(kernel.penStyle.color).toBe('#ff0000')
    })

    it('设置 penStyle 后，新笔画应使用新样式', () => {
      const kernel = createKernel()
      const markerStyle: StrokeStyle = { type: 'marker', color: '#00ff00', size: 10, opacity: 0.6 }

      kernel.penStyle = markerStyle
      kernel.startStroke('s1', raw(100, 200), 1000)

      const op = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(op.style.type).toBe('marker')
      expect(op.style.color).toBe('#00ff00')
    })
  })

  // ===== 7. 状态代理属性 =====

  describe('状态代理属性', () => {
    it('canUndo 应代理到 document.canUndo', () => {
      deps.document.canUndo = false
      const kernel = createKernel()
      expect(kernel.canUndo).toBe(false)

      deps.document.canUndo = true
      expect(kernel.canUndo).toBe(true)
    })

    it('canRedo 应代理到 document.canRedo', () => {
      deps.document.canRedo = false
      const kernel = createKernel()
      expect(kernel.canRedo).toBe(false)

      deps.document.canRedo = true
      expect(kernel.canRedo).toBe(true)
    })

    it('isEmpty 应基于 document snapshot 判断', () => {
      const kernel = createKernel()
      expect(kernel.isEmpty).toBe(true)
    })

    it('isEmpty 在有笔画时应返回 false', () => {
      const strokeMap = new Map([['stroke-1', { id: 'stroke-1', points: [], style: defaultStyle, createdAt: 0 }]])
      deps.document.getSnapshot = vi.fn(() => ({
        strokes: strokeMap,
        strokeOrder: ['stroke-1'],
        timestamp: 0
      }))
      const kernel = createKernel()
      expect(kernel.isEmpty).toBe(false)
    })

    it('strokeCount 应返回 document snapshot 中的笔画数量', () => {
      const kernel = createKernel()
      expect(kernel.strokeCount).toBe(0)
    })
  })

  // ===== 8. 橡皮擦模式 =====

  describe('橡皮擦模式', () => {
    const eraserStyle: StrokeStyle = { type: 'eraser', color: '#ffffff', size: 20, opacity: 1 }

    function addEraserProcessor() {
      deps.eraserProcessor = {
        supportedTypes: ['eraser', 'wiper'] as readonly StrokeType[],
        computeOutline: vi.fn(() => null),
        computeErasure: vi.fn(() => ['stroke-1'])
      } satisfies StrokeProcessorInterface
    }

    function setupSnapshotWithStrokes() {
      const strokeMap = new Map([
        ['stroke-1', { id: 'stroke-1', points: [{ x: 400, y: 300, p: 0.5, t: 0 }], style: defaultStyle, createdAt: 0 }],
        ['stroke-2', { id: 'stroke-2', points: [{ x: 640, y: 480, p: 0.5, t: 0 }], style: defaultStyle, createdAt: 0 }]
      ])
      deps.document.getSnapshot = vi.fn(() => ({
        strokes: strokeMap,
        strokeOrder: ['stroke-1', 'stroke-2'],
        timestamp: 0
      }))
    }

    it('eraser 模式 startStroke 时不应生成 stroke:start', () => {
      addEraserProcessor()
      const kernel = createKernel()
      kernel.penStyle = eraserStyle

      kernel.startStroke('s1', raw(100, 200), 1000)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      expect(calls.length).toBe(0)
    })

    it('eraser 模式 addStrokePoint 时应调用 eraserProcessor.computeErasure', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()
      kernel.penStyle = eraserStyle

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6), 1016)

      expect(deps.eraserProcessor!.computeErasure).toHaveBeenCalled()
    })

    it('eraser 模式 addStrokePoint 时应调用 redrawAll（高亮重绘）', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()
      kernel.penStyle = eraserStyle

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6), 1016)

      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
    })

    it('eraser 模式 endStroke 时应生成 stroke:delete 操作', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()
      kernel.penStyle = eraserStyle

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6), 1016)
      kernel.endStroke('s1', 1100)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const deleteCall = calls.find((c: any[]) => c[0].type === 'stroke:delete')
      expect(deleteCall).toBeDefined()
      expect(deleteCall![0].strokeIds).toContain('stroke-1')
    })

    it('eraser 模式 endStroke 后应触发 redrawFromSnapshot', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()
      kernel.penStyle = eraserStyle

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6), 1016)
      kernel.endStroke('s1', 1100)

      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
    })

    it('eraser 模式 endStroke 后应发出 document:changed 事件', () => {
      addEraserProcessor()
      setupSnapshotWithStrokes()
      const kernel = createKernel()
      kernel.penStyle = eraserStyle

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6), 1016)
      kernel.endStroke('s1', 1100)

      expect(deps.eventBus.emit).toHaveBeenCalledWith('document:changed', expect.anything())
    })

    it('无命中时 endStroke 不应生成 stroke:delete', () => {
      deps.eraserProcessor = {
        supportedTypes: ['eraser', 'wiper'] as readonly StrokeType[],
        computeOutline: vi.fn(() => null),
        computeErasure: vi.fn(() => [])
      } satisfies StrokeProcessorInterface
      const kernel = createKernel()
      kernel.penStyle = eraserStyle

      kernel.startStroke('s1', raw(100, 200), 1000)
      kernel.addStrokePoint('s1', raw(110, 210, 0.6), 1016)
      kernel.endStroke('s1', 1100)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      const deleteCall = calls.find((c: any[]) => c[0].type === 'stroke:delete')
      expect(deleteCall).toBeUndefined()
    })

    it('非 eraser 模式不受影响（回归测试）', () => {
      addEraserProcessor()
      const kernel = createKernel()

      kernel.startStroke('s1', raw(100, 200), 1000)

      const calls = (deps.document.apply as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0][0].type).toBe('stroke:start')
    })
  })

  // ===== 9. Camera API =====

  describe('Camera API', () => {
    it('camera 应返回 coordinateSystem 的 camera', () => {
      deps.coordinateSystem.camera = { x: 10, y: 20, zoom: 2 }
      const kernel = createKernel()
      expect(kernel.camera).toEqual({ x: 10, y: 20, zoom: 2 })
    })

    it('setCamera 应同步更新 coordinateSystem 和 renderAdapter', () => {
      const kernel = createKernel()
      const newCamera: Camera = { x: 50, y: 100, zoom: 1.5 }

      kernel.setCamera(newCamera)

      expect(deps.coordinateSystem.setCamera).toHaveBeenCalledWith(newCamera)
      expect(deps.renderAdapter.setCamera).toHaveBeenCalledWith(newCamera)
    })

    it('resize 应更新容器尺寸并自动 fit', () => {
      const kernel = createKernel()
      kernel.resize(1024, 768)

      expect(deps.coordinateSystem.resizeContainer).toHaveBeenCalledWith(1024, 768)
      expect(deps.renderAdapter.resize).toHaveBeenCalledWith(1024, 768)
      expect(deps.coordinateSystem.computeFitCamera).toHaveBeenCalled()
    })

    it('zoomToFit 应调用 computeFitCamera 并设置 camera', () => {
      deps.coordinateSystem.computeFitCamera = vi.fn(() => ({ x: 5, y: 10, zoom: 0.8 }))
      const kernel = createKernel()

      kernel.zoomToFit()

      expect(deps.coordinateSystem.computeFitCamera).toHaveBeenCalled()
      expect(deps.coordinateSystem.setCamera).toHaveBeenCalledWith({ x: 5, y: 10, zoom: 0.8 })
    })

    it('pan 应偏移 camera 位置', () => {
      deps.coordinateSystem.camera = { x: 0, y: 0, zoom: 1 }
      const kernel = createKernel()

      kernel.pan(100, 50)

      expect(deps.coordinateSystem.setCamera).toHaveBeenCalledWith(
        expect.objectContaining({ x: -100, y: -50, zoom: 1 })
      )
    })
  })

  // ===== 10. getSnapshot =====

  describe('getSnapshot', () => {
    it('应委托给 document.getSnapshot()', () => {
      const expectedSnapshot = {
        strokes: new Map([['s1', { id: 's1', points: [], style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 }, createdAt: 0 }]]),
        strokeOrder: ['s1'],
        timestamp: 123
      }
      deps.document.getSnapshot.mockReturnValue(expectedSnapshot)
      const kernel = createKernel()

      const snapshot = kernel.getSnapshot()

      expect(snapshot).toBe(expectedSnapshot)
      expect(deps.document.getSnapshot).toHaveBeenCalled()
      kernel.dispose()
    })
  })

  // ===== 11. getOperations =====

  describe('getOperations', () => {
    it('应委托给 document.getOperations()', () => {
      const ops = [{ type: 'stroke:clear', timestamp: 100 }]
      deps.document.getOperations.mockReturnValue(ops)
      const kernel = createKernel()

      const result = kernel.getOperations()

      expect(result).toBe(ops)
      kernel.dispose()
    })
  })

  // ===== 12. renderAdapter =====

  describe('renderAdapter', () => {
    it('应返回 deps 中的 renderAdapter 引用', () => {
      const kernel = createKernel()

      expect(kernel.renderAdapter).toBe(deps.renderAdapter)
      kernel.dispose()
    })
  })

  // ===== 13. applyOperation =====

  describe('applyOperation', () => {
    it('stroke:start 应调用 document.apply', () => {
      const kernel = createKernel()
      const op = {
        type: 'stroke:start' as const,
        strokeId: 's1',
        style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
        point: { x: 10, y: 20, p: 0.5, t: 100 },
        timestamp: 100
      }

      kernel.applyOperation(op)

      expect(deps.document.apply).toHaveBeenCalledWith(op)
      kernel.dispose()
    })

    it('stroke:addPoint 应渲染到 live layer', () => {
      const kernel = createKernel()

      kernel.applyOperation({
        type: 'stroke:start',
        strokeId: 's1',
        style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
        point: { x: 10, y: 20, p: 0.5, t: 100 },
        timestamp: 100
      })

      kernel.applyOperation({
        type: 'stroke:addPoint',
        strokeId: 's1',
        point: { x: 30, y: 40, p: 0.6, t: 150 }
      })

      expect(deps.renderAdapter.drawLiveStrokes).toHaveBeenCalled()
      kernel.dispose()
    })

    it('stroke:end 应提交到持久层并发出事件', () => {
      const kernel = createKernel()

      kernel.applyOperation({
        type: 'stroke:start',
        strokeId: 's1',
        style: { type: 'pen' as const, color: '#000', size: 2, opacity: 1 },
        point: { x: 10, y: 20, p: 0.5, t: 100 },
        timestamp: 100
      })
      kernel.applyOperation({
        type: 'stroke:end',
        strokeId: 's1',
        timestamp: 200
      })

      expect(deps.renderAdapter.commitStroke).toHaveBeenCalled()
      expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
      expect(deps.eventBus.emit).toHaveBeenCalledWith('document:changed', expect.anything())
      kernel.dispose()
    })

    it('stroke:clear 应清除所有渲染', () => {
      const kernel = createKernel()

      kernel.applyOperation({ type: 'stroke:clear', timestamp: 100 })

      expect(deps.document.apply).toHaveBeenCalled()
      expect(deps.renderAdapter.clearAll).toHaveBeenCalled()
      kernel.dispose()
    })

    it('stroke:delete 应重绘快照', () => {
      const kernel = createKernel()

      kernel.applyOperation({
        type: 'stroke:delete',
        strokeIds: ['s1'],
        timestamp: 100
      })

      expect(deps.document.apply).toHaveBeenCalled()
      expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
      kernel.dispose()
    })
  })

  // ===== 14. dispose =====

  describe('dispose', () => {
    it('dispose 应调用 inputAdapter.dispose', () => {
      const kernel = createKernel()
      kernel.dispose()
      expect(deps.inputAdapter.dispose).toHaveBeenCalled()
    })

    it('dispose 应调用 renderAdapter.dispose', () => {
      const kernel = createKernel()
      kernel.dispose()
      expect(deps.renderAdapter.dispose).toHaveBeenCalled()
    })

    it('dispose 应调用 eventBus.dispose', () => {
      const kernel = createKernel()
      kernel.dispose()
      expect(deps.eventBus.dispose).toHaveBeenCalled()
    })

    it('dispose 后再次调用不应抛错', () => {
      const kernel = createKernel()
      kernel.dispose()
      expect(() => kernel.dispose()).not.toThrow()
    })
  })
})
