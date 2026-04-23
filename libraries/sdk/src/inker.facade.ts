import type { StrokeStyle, EditorOptions, Camera, Operation, DocumentSnapshot, RenderAdapterInterface } from '@inker/types'
import type { EditorKernel, EventBus } from '@inker/core'
import { EditorBuilder } from './editor.builder'

/**
 * Inker 门面类
 * 对外暴露简洁 API，内部封装 EditorKernel 的复杂性
 */
export class Inker {
  private kernel: EditorKernel | null
  private eventBus: EventBus | null
  private element: HTMLElement | null

  constructor(kernel: EditorKernel, eventBus: EventBus, element: HTMLElement) {
    this.kernel = kernel
    this.eventBus = eventBus
    this.element = element
  }

  /**
   * 静态工厂方法：使用默认配置创建编辑器
   */
  static create(options: EditorOptions): Inker {
    const builder = new EditorBuilder().withElement(options.element)

    if (options.penStyle) {
      builder.withPenStyle({
        type: options.penStyle.type ?? 'pen',
        color: options.penStyle.color ?? '#000000',
        size: options.penStyle.size ?? 2,
        opacity: options.penStyle.opacity ?? 1
      })
    }

    if (options.allowedPointerTypes) {
      builder.withAllowedPointerTypes(options.allowedPointerTypes)
    }

    return builder.build()
  }

  /**
   * 静态方法：获取构建器实例
   */
  static builder(): EditorBuilder {
    return new EditorBuilder()
  }

  /** 获取当前笔画样式 */
  get penStyle(): StrokeStyle {
    return this.kernel!.penStyle
  }

  /** 设置笔画样式 */
  set penStyle(style: StrokeStyle) {
    this.kernel!.penStyle = style
  }

  /** 是否可以撤销 */
  get canUndo(): boolean {
    if (!this.kernel) return false
    return this.kernel.canUndo
  }

  /** 是否可以重做 */
  get canRedo(): boolean {
    if (!this.kernel) return false
    return this.kernel.canRedo
  }

  /** 文档是否为空 */
  get isEmpty(): boolean {
    if (!this.kernel) return true
    return this.kernel.isEmpty
  }

  /** 笔画数量 */
  get strokeCount(): number {
    if (!this.kernel) return 0
    return this.kernel.strokeCount
  }

  /** 撤销 */
  undo(): void {
    if (!this.kernel) throw new Error('Editor has been disposed')
    this.kernel.undo()
  }

  /** 重做 */
  redo(): void {
    if (!this.kernel) throw new Error('Editor has been disposed')
    this.kernel.redo()
  }

  /** 清除所有笔画 */
  clear(): void {
    if (!this.kernel) throw new Error('Editor has been disposed')
    this.kernel.clear()
  }

  // ===== 数据访问 API =====

  /** 获取文档快照 */
  getSnapshot(): DocumentSnapshot {
    if (!this.kernel) throw new Error('Editor has been disposed')
    return this.kernel.getSnapshot()
  }

  /** 获取全部操作记录 */
  getOperations(): Operation[] {
    if (!this.kernel) throw new Error('Editor has been disposed')
    return this.kernel.getOperations() as Operation[]
  }

  /** 获取渲染适配器引用（用于图片导出） */
  get renderAdapter(): RenderAdapterInterface {
    if (!this.kernel) throw new Error('Editor has been disposed')
    return this.kernel.renderAdapter
  }

  /** 应用单个操作（用于回放驱动） */
  applyOperation(op: Operation): void {
    if (!this.kernel) throw new Error('Editor has been disposed')
    this.kernel.applyOperation(op)
  }

  // ===== Camera API =====

  /** 容器尺寸变化时调用 */
  resize(width: number, height: number): void {
    if (!this.kernel) throw new Error('Editor has been disposed')
    this.kernel.resize(width, height)
  }

  /** 锚点缩放 */
  zoomAt(screenX: number, screenY: number, newZoom: number): void {
    if (!this.kernel) throw new Error('Editor has been disposed')
    this.kernel.zoomTo(screenX, screenY, newZoom)
  }

  /** 平移 */
  pan(deltaX: number, deltaY: number): void {
    if (!this.kernel) throw new Error('Editor has been disposed')
    this.kernel.pan(deltaX, deltaY)
  }

  /** 自动 fit 到容器 */
  zoomToFit(): void {
    if (!this.kernel) throw new Error('Editor has been disposed')
    this.kernel.zoomToFit()
  }

  /** 获取当前 camera */
  get camera(): Camera {
    if (!this.kernel) return { x: 0, y: 0, zoom: 1 }
    return this.kernel.camera
  }

  /** 设置 camera */
  setCamera(camera: Camera): void {
    if (!this.kernel) throw new Error('Editor has been disposed')
    this.kernel.setCamera(camera)
  }

  /**
   * 注册事件监听器
   * @returns 取消订阅函数
   */
  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.eventBus) return () => {}
    return this.eventBus.on(event, handler)
  }

  /** 移除事件监听器 */
  off(event: string, handler: (data: unknown) => void): void {
    if (!this.eventBus) return
    this.eventBus.off(event, handler)
  }

  /** 销毁编辑器，释放所有资源 */
  dispose(): void {
    if (!this.kernel) return

    this.kernel.dispose()
    this.kernel = null
    this.eventBus = null

    // 移除容器内的 canvas 元素
    if (this.element) {
      const canvases = this.element.querySelectorAll('canvas')
      canvases.forEach(canvas => canvas.remove())
      this.element = null
    }
  }
}
