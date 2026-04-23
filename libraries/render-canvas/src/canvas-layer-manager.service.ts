/**
 * Canvas 双层管理器
 * 管理 live layer（捕获层）和 render layer（渲染层）
 * 支持 DPI 缩放和 resize
 * 注意：DPI 缩放由 CanvasRenderAdapter 的 Camera 变换统一处理
 */
export class CanvasLayerManager {
  /** 容器元素 */
  private container: HTMLElement | null
  /** 捕获层 canvas（接收指针事件，绘制实时笔画） */
  private liveCanvas: HTMLCanvasElement | null = null
  /** 渲染层 canvas（存储已完成笔画，指针事件穿透） */
  private renderCanvas: HTMLCanvasElement | null = null
  /** 捕获层 2D context */
  private liveContext: CanvasRenderingContext2D | null = null
  /** 渲染层 2D context */
  private renderContext: CanvasRenderingContext2D | null = null

  constructor(container: HTMLElement, width: number, height: number) {
    this.container = container
    this.createLayers(width, height)
  }

  /** 获取捕获层（live layer）的 2D context */
  getLiveContext(): CanvasRenderingContext2D {
    return this.liveContext!
  }

  /** 获取渲染层（render layer）的 2D context */
  getRenderContext(): CanvasRenderingContext2D {
    return this.renderContext!
  }

  /** 调整两层尺寸 */
  resize(width: number, height: number): void {
    if (this.liveCanvas) {
      this.applySize(this.liveCanvas, width, height)
    }
    if (this.renderCanvas) {
      this.applySize(this.renderCanvas, width, height)
    }
  }

  /** 销毁，移除 canvas 元素 */
  dispose(): void {
    if (this.liveCanvas && this.container) {
      this.container.removeChild(this.liveCanvas)
      this.liveCanvas = null
      this.liveContext = null
    }
    if (this.renderCanvas && this.container) {
      this.container.removeChild(this.renderCanvas)
      this.renderCanvas = null
      this.renderContext = null
    }
    this.container = null
  }

  /** 创建双层 canvas */
  private createLayers(width: number, height: number): void {
    // 渲染层（底层，pointerEvents: none）
    this.renderCanvas = this.createCanvas(width, height)
    this.renderCanvas.style.pointerEvents = 'none'
    this.container!.appendChild(this.renderCanvas)
    this.renderContext = this.renderCanvas.getContext('2d')!

    // 捕获层（顶层，接收指针事件）
    this.liveCanvas = this.createCanvas(width, height)
    this.container!.appendChild(this.liveCanvas)
    this.liveContext = this.liveCanvas.getContext('2d')!
  }

  /** 创建单个 canvas 元素 */
  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    this.applySize(canvas, width, height)
    return canvas
  }

  /**
   * 应用尺寸（含 DPI 缩放）
   * 只设置物理/CSS 像素尺寸，不做 ctx.scale
   * DPI 缩放由 Camera 变换的 setTransform 统一处理
   */
  private applySize(canvas: HTMLCanvasElement, width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1
    // 物理像素
    canvas.width = width * dpr
    canvas.height = height * dpr
    // CSS 像素
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }
}
