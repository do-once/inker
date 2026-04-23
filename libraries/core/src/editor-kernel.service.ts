import type {
  InputAdapterInterface,
  RenderAdapterInterface,
  StrokeProcessorInterface,
  StrokeStyle,
  StrokeInputReceiver,
  RawPoint,
  StrokePoint,
  StrokeData,
  DocumentSnapshot,
  Camera,
  Point,
  Operation
} from '@inker/types'
import { StrokeSession } from './stroke-session'

/** EditorKernel 的依赖项 */
export interface EditorKernelDeps {
  eventBus: {
    on(event: string, handler: (data: unknown) => void): () => void
    off(event: string, handler: (data: unknown) => void): void
    emit(event: string, data?: unknown): void
    dispose(): void
  }
  inputAdapter: InputAdapterInterface
  renderAdapter: RenderAdapterInterface
  document: {
    apply(op: unknown): void
    undo(): void
    redo(): void
    getSnapshot(): DocumentSnapshot
    getOperations(): readonly unknown[]
    canUndo: boolean
    canRedo: boolean
  }
  coordinateSystem: {
    screenToWorld(point: Point): Point
    worldToScreen(point: Point): Point
    resizeContainer(width: number, height: number): void
    computeFitCamera(): Camera
    get camera(): Camera
    setCamera(camera: Camera): void
    toNormalized(point: Point): Point
    fromNormalized(point: Point): Point
    documentWidth: number
    documentHeight: number
    containerWidth: number
    containerHeight: number
  }
  /** 可选的橡皮擦处理器，用于碰撞检测 */
  eraserProcessor?: StrokeProcessorInterface
}

/**
 * 编辑器核心编排层
 * 纯协调层，不含渲染或计算逻辑
 * 实现 StrokeInputReceiver 接口，接受输入适配器的直接调用
 */
export class EditorKernel implements StrokeInputReceiver {
  private deps: EditorKernelDeps
  /** 当前笔画样式 */
  private _penStyle: StrokeStyle = {
    type: 'pen',
    color: '#000000',
    size: 2,
    opacity: 1
  }
  /** 活跃笔画会话（strokeId → StrokeSession） */
  private activeSessions: Map<string, StrokeSession> = new Map()
  /** 橡皮擦模式：锁定的笔画 ID（单笔画锁） */
  private activeEraserStrokeId: string | null = null
  /** 橡皮擦模式：待删除的笔迹 ID 集合 */
  private pendingDeleteIds: Set<string> = new Set()
  /** 是否已销毁 */
  private disposed = false
  /** visibilitychange 事件处理器（已绑定 this，用于注销） */
  private handleVisibilityChange: () => void

  constructor(deps: EditorKernelDeps) {
    this.deps = deps
    // 页面隐藏时结束所有活跃笔画
    this.handleVisibilityChange = this.onVisibilityChange.bind(this)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  // ===== StrokeInputReceiver 实现 =====

  /** 当前笔画样式（EditorKernel 自身属性，不属于 StrokeInputReceiver 接口） */
  get penStyle(): StrokeStyle {
    return this._penStyle
  }

  /**
   * 开始一条新笔画
   * 对应 pointerDown 语义
   */
  startStroke(strokeId: string, point: RawPoint, timestamp: number): void {
    if (this.disposed) return

    const worldPoint = this.deps.coordinateSystem.screenToWorld({
      x: point.x,
      y: point.y
    })

    const strokePoint: StrokePoint = {
      x: worldPoint.x,
      y: worldPoint.y,
      p: point.pressure,
      t: timestamp
    }

    // 橡皮擦模式：单笔画锁
    if (this.isEraserType(this._penStyle)) {
      if (this.activeEraserStrokeId !== null) return // 已有橡皮擦在工作，忽略
      this.activeEraserStrokeId = strokeId
      this.pendingDeleteIds = new Set()
      // 直接创建 session 追踪轨迹点，不发 stroke:start（橡皮擦不需要）
      const session = new StrokeSession(strokeId, strokePoint, timestamp)
      this.activeSessions.set(strokeId, session)
      this.deps.renderAdapter.startEraserTrail(this._penStyle.size)
      this.deps.renderAdapter.addEraserPoint(strokePoint)
      return
    }

    // 画笔模式：创建新 session 并发送 stroke:start
    const session = new StrokeSession(strokeId, strokePoint, timestamp)
    this.activeSessions.set(strokeId, session)
    this.deps.document.apply({
      type: 'stroke:start',
      strokeId,
      style: { ...this._penStyle },
      point: strokePoint,
      timestamp
    })
  }

  /**
   * 追加笔画采样点
   * 对应 pointerMove 语义
   */
  addStrokePoint(strokeId: string, point: RawPoint, timestamp: number): void {
    if (this.disposed) return

    const session = this.activeSessions.get(strokeId)
    if (!session) return

    const worldPoint = this.deps.coordinateSystem.screenToWorld({
      x: point.x,
      y: point.y
    })

    const strokePoint: StrokePoint = {
      x: worldPoint.x,
      y: worldPoint.y,
      p: point.pressure,
      t: timestamp
    }

    session.addPoint(strokePoint)

    // 橡皮擦模式：碰撞检测 + 轨迹
    if (this.activeEraserStrokeId === strokeId) {
      const eraserProc = this.deps.eraserProcessor
      if (eraserProc?.computeErasure) {
        const snapshot = this.deps.document.getSnapshot()
        const hitIds = eraserProc.computeErasure(
          session.getPoints(),
          this._penStyle,
          snapshot.strokes
        )
        for (const id of hitIds) {
          this.pendingDeleteIds.add(id)
        }
        this.redrawWithHighlight(this.pendingDeleteIds)
      }
      this.deps.renderAdapter.addEraserPoint(strokePoint)
      return
    }

    // 画笔模式：追加点到文档，并批量渲染所有活跃笔画
    this.deps.document.apply({
      type: 'stroke:addPoint',
      strokeId: session.strokeId,
      point: strokePoint
    })
    this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
  }

  /**
   * 结束笔画
   * 对应 pointerUp / pointerCancel 语义（适配器已将 cancel 转换为 endStroke）
   */
  endStroke(strokeId: string, timestamp: number): void {
    if (this.disposed) return

    const session = this.activeSessions.get(strokeId)
    if (!session) return

    // 橡皮擦模式：提交擦除
    if (this.activeEraserStrokeId === strokeId) {
      if (this.pendingDeleteIds.size > 0) {
        this.deps.document.apply({
          type: 'stroke:delete',
          strokeIds: [...this.pendingDeleteIds],
          timestamp
        })
        this.redrawFromSnapshot()
        this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
      }
      this.deps.renderAdapter.endEraserTrail()
      this.activeEraserStrokeId = null
      this.pendingDeleteIds = new Set()
      this.activeSessions.delete(strokeId)
      return
    }

    // 画笔模式：提交笔画
    this.deps.document.apply({
      type: 'stroke:end',
      strokeId: session.strokeId,
      timestamp
    })
    this.deps.renderAdapter.commitStroke(session.getPoints(), this._penStyle)
    this.activeSessions.delete(strokeId)

    if (this.activeSessions.size > 0) {
      this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
    } else {
      this.deps.renderAdapter.clearLiveLayer()
    }

    // 具体事件先于通用事件触发
    const snapshot = this.deps.document.getSnapshot()
    const stroke = snapshot.strokes.get(session.strokeId)
    if (stroke) {
      this.deps.eventBus.emit('stroke:end', { stroke })
    }
    this.deps.eventBus.emit('document:changed', snapshot)
  }

  // ===== 多指针会话生命周期 =====

  /** 结束所有活跃会话 */
  private endAllSessions(): void {
    const timestamp = Date.now()
    for (const strokeId of [...this.activeSessions.keys()]) {
      this.endStroke(strokeId, timestamp)
    }
    this.deps.renderAdapter.clearLiveLayer()
  }

  /** 页面隐藏时结束所有活跃笔画 */
  private onVisibilityChange(): void {
    if (document.visibilityState === 'hidden' && this.activeSessions.size > 0) {
      this.endAllSessions()
    }
  }

  /** 收集所有活跃会话的笔画数据，用于 drawLiveStrokes */
  private collectLiveStrokes(): StrokeData[] {
    const strokes: StrokeData[] = []
    for (const session of this.activeSessions.values()) {
      strokes.push({ points: session.getPoints(), style: this._penStyle })
    }
    return strokes
  }

  // ===== 撤销/重做/清除 =====

  /** 撤销 */
  undo(): void {
    if (this.disposed) return
    if (this.activeSessions.size > 0) this.endAllSessions()
    this.deps.document.undo()
    this.redrawFromSnapshot()
    this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
  }

  /** 重做 */
  redo(): void {
    if (this.disposed) return
    if (this.activeSessions.size > 0) this.endAllSessions()
    this.deps.document.redo()
    this.redrawFromSnapshot()
    this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
  }

  /** 清除所有笔画 */
  clear(): void {
    if (this.disposed) return
    this.deps.document.apply({
      type: 'stroke:clear',
      timestamp: Date.now()
    })
    this.deps.renderAdapter.clearAll()
    this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
  }

  /**
   * 应用单个操作并渲染
   * 用于外部回放驱动，直接管理 session 避免 double document.apply
   */
  applyOperation(op: Operation): void {
    if (this.disposed) return
    this.deps.document.apply(op)

    switch (op.type) {
      case 'stroke:start': {
        this._penStyle = { ...op.style }
        // 直接创建 session，用 op.strokeId 作为 key
        const session = new StrokeSession(op.strokeId, op.point, op.timestamp)
        this.activeSessions.set(op.strokeId, session)
        break
      }

      case 'stroke:addPoint': {
        const session = this.activeSessions.get(op.strokeId)
        if (!session) break
        session.addPoint(op.point)
        this.deps.renderAdapter.drawLiveStrokes(this.collectLiveStrokes())
        break
      }

      case 'stroke:end': {
        const session = this.activeSessions.get(op.strokeId)
        if (!session) break
        this.deps.renderAdapter.commitStroke(session.getPoints(), this._penStyle)
        this.activeSessions.delete(op.strokeId)
        this.deps.renderAdapter.clearLiveLayer()
        this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
        break
      }

      case 'stroke:delete':
        this.redrawFromSnapshot()
        this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
        break

      case 'stroke:clear':
        this.deps.renderAdapter.clearAll()
        this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
        break
    }
  }

  /** 设置笔画样式（如有活跃笔画会先全部提交） */
  set penStyle(style: StrokeStyle) {
    if (this.activeSessions.size > 0) {
      this.endAllSessions()
    }
    this._penStyle = { ...style }
  }

  /** 是否可以撤销 */
  get canUndo(): boolean {
    return this.deps.document.canUndo
  }

  /** 是否可以重做 */
  get canRedo(): boolean {
    return this.deps.document.canRedo
  }

  /** 文档是否为空 */
  get isEmpty(): boolean {
    return this.deps.document.getSnapshot().strokes.size === 0
  }

  /** 笔画数量 */
  get strokeCount(): number {
    return this.deps.document.getSnapshot().strokes.size
  }

  /** 获取文档快照 */
  getSnapshot(): DocumentSnapshot {
    return this.deps.document.getSnapshot()
  }

  /** 获取全部操作记录 */
  getOperations(): readonly unknown[] {
    return this.deps.document.getOperations()
  }

  /** 暴露渲染适配器引用（用于图片导出） */
  get renderAdapter(): RenderAdapterInterface {
    return this.deps.renderAdapter
  }

  // ===== Camera API =====

  /** 获取当前 camera */
  get camera(): Camera {
    return this.deps.coordinateSystem.camera
  }

  /** 设置 camera 并同步到渲染层 */
  setCamera(camera: Camera): void {
    this.deps.coordinateSystem.setCamera(camera)
    this.deps.renderAdapter.setCamera(camera)
    this.redrawFromSnapshot()
  }

  /** 更新容器尺寸并自动 fit */
  resize(containerWidth: number, containerHeight: number): void {
    this.deps.coordinateSystem.resizeContainer(containerWidth, containerHeight)
    this.deps.renderAdapter.resize(containerWidth, containerHeight)
    const fitCamera = this.deps.coordinateSystem.computeFitCamera()
    this.setCamera(fitCamera)
  }

  /**
   * 锚点缩放
   * 缩放后保持屏幕锚点对应的世界坐标不变
   */
  zoomTo(screenAnchorX: number, screenAnchorY: number, newZoom: number): void {
    const cs = this.deps.coordinateSystem
    const worldAnchor = cs.screenToWorld({ x: screenAnchorX, y: screenAnchorY })
    const newCamera: Camera = {
      x: worldAnchor.x - screenAnchorX / newZoom,
      y: worldAnchor.y - screenAnchorY / newZoom,
      zoom: newZoom
    }
    this.setCamera(newCamera)
  }

  /** 平移（屏幕像素增量） */
  pan(deltaScreenX: number, deltaScreenY: number): void {
    const cs = this.deps.coordinateSystem
    const cam = cs.camera
    const newCamera: Camera = {
      x: cam.x - deltaScreenX / cam.zoom,
      y: cam.y - deltaScreenY / cam.zoom,
      zoom: cam.zoom
    }
    this.setCamera(newCamera)
  }

  /** 自动 fit 文档到容器 */
  zoomToFit(): void {
    const fitCamera = this.deps.coordinateSystem.computeFitCamera()
    this.setCamera(fitCamera)
  }

  /** 销毁编辑器，释放所有资源 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.activeSessions.clear()
    this.activeEraserStrokeId = null
    this.deps.inputAdapter.dispose()
    this.deps.renderAdapter.dispose()
    this.deps.eventBus.dispose()
  }

  /** 判断当前样式是否为擦除模式 */
  private isEraserType(style: StrokeStyle): boolean {
    return style.type === 'eraser' || style.type === 'wiper'
  }

  /** 高亮重绘：命中的笔迹降低透明度 */
  private redrawWithHighlight(highlightIds: Set<string>): void {
    const snapshot = this.deps.document.getSnapshot()
    const strokes: StrokeData[] = []
    for (const strokeId of snapshot.strokeOrder) {
      const stroke = snapshot.strokes.get(strokeId)
      if (!stroke) continue
      const style = highlightIds.has(strokeId)
        ? { ...stroke.style, opacity: 0.3 }
        : stroke.style
      strokes.push({ points: stroke.points, style })
    }
    this.deps.renderAdapter.redrawAll(strokes)
  }

  /** 从文档快照重绘所有笔画 */
  private redrawFromSnapshot(): void {
    const snapshot = this.deps.document.getSnapshot()
    const strokes: StrokeData[] = []
    for (const strokeId of snapshot.strokeOrder) {
      const stroke = snapshot.strokes.get(strokeId)
      if (stroke) strokes.push({ points: stroke.points, style: stroke.style })
    }
    this.deps.renderAdapter.redrawAll(strokes)
  }
}
