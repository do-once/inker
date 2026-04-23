import { RenderAdapter, EraserTrail, geometryToPath2D } from '@inker/core'
import type {
  StrokeData,
  StrokePoint,
  StrokeStyle,
  StrokeProcessorInterface,
  Camera
} from '@inker/types'
import { CanvasLayerManager } from './canvas-layer-manager.service'

/**
 * Canvas 2D 渲染适配器
 * 使用双层 Canvas 架构：live layer 绘制实时笔画，render layer 存储已完成笔画
 * 内部集成 StrokeProcessor 计算轮廓，以及 EraserTrail 橡皮擦轨迹管理
 */
export class CanvasRenderAdapter extends RenderAdapter {
  /** Canvas 层管理器 */
  private layerManager: CanvasLayerManager | null = null
  /** 当前 Camera 状态 */
  private _camera: Camera = { x: 0, y: 0, zoom: 1 }
  /** 容器 CSS 宽度 */
  private _containerWidth = 0
  /** 容器 CSS 高度 */
  private _containerHeight = 0
  /** 橡皮擦轨迹管理器 */
  private eraserTrail: EraserTrail | null = null
  /** 笔画处理器（计算轮廓） */
  private strokeProcessor: StrokeProcessorInterface

  constructor(strokeProcessor: StrokeProcessorInterface) {
    super()
    this.strokeProcessor = strokeProcessor
  }

  /**
   * 绑定到 DOM 元素，初始化渲染层
   */
  attach(element: HTMLElement, width: number, height: number): void {
    this._containerWidth = width
    this._containerHeight = height
    this.layerManager = new CanvasLayerManager(element, width, height)
  }

  /**
   * 解绑 DOM 元素，移除渲染层
   */
  detach(): void {
    if (this.layerManager) {
      this.layerManager.dispose()
      this.layerManager = null
    }
  }

  /**
   * 调整渲染尺寸
   */
  resize(width: number, height: number): void {
    this._containerWidth = width
    this._containerHeight = height
    if (this.layerManager) {
      this.layerManager.resize(width, height)
    }
  }

  /**
   * 设置 Camera 状态
   */
  setCamera(camera: Camera): void {
    this._camera = camera
  }

  /**
   * 在 live layer 绘制正在进行的笔画
   * 接收采样点，内部调用 strokeProcessor 计算轮廓
   */
  drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void {
    if (!this.layerManager) return
    const outline = this.strokeProcessor.computeOutline(points, style, false)
    if (!outline) return
    const ctx = this.layerManager.getLiveContext()
    this.clearContext(ctx) // 清除 live layer 再绘制
    this.drawPath(ctx, geometryToPath2D(outline), style)
  }

  /**
   * 将笔画提交到 render layer
   * 接收采样点，内部调用 strokeProcessor 计算轮廓
   */
  commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void {
    if (!this.layerManager) return
    const outline = this.strokeProcessor.computeOutline(points, style, true)
    if (!outline) return
    const ctx = this.layerManager.getRenderContext()
    this.drawPath(ctx, geometryToPath2D(outline), style)
  }

  /**
   * 清除 live layer 内容
   */
  clearLiveLayer(): void {
    if (!this.layerManager) return
    const ctx = this.layerManager.getLiveContext()
    this.clearContext(ctx)
  }

  /**
   * 批量绘制所有活跃笔画
   * 先清除 live layer，再遍历计算轮廓并绘制（不逐笔清除）
   */
  drawLiveStrokes(strokes: readonly StrokeData[]): void {
    if (!this.layerManager) return
    const ctx = this.layerManager.getLiveContext()
    this.clearContext(ctx)
    for (const stroke of strokes) {
      const outline = this.strokeProcessor.computeOutline(stroke.points, stroke.style, false)
      if (outline) {
        this.drawPath(ctx, geometryToPath2D(outline), stroke.style)
      }
    }
  }

  /**
   * 重绘所有已完成笔画（先清除 render layer 再逐条绘制）
   * 接收 StrokeData 数组，内部调用 strokeProcessor 计算轮廓
   */
  redrawAll(strokes: readonly StrokeData[]): void {
    if (!this.layerManager) return
    const ctx = this.layerManager.getRenderContext()
    this.clearContext(ctx)
    for (const stroke of strokes) {
      const outline = this.strokeProcessor.computeOutline(stroke.points, stroke.style, true)
      if (outline) {
        this.drawPath(ctx, geometryToPath2D(outline), stroke.style)
      }
    }
  }

  /**
   * 清除所有渲染内容（两层都清除）
   */
  clearAll(): void {
    if (!this.layerManager) return
    this.clearContext(this.layerManager.getLiveContext())
    this.clearContext(this.layerManager.getRenderContext())
  }

  // === 橡皮擦轨迹管理 ===

  /**
   * 启动橡皮擦轨迹动画
   * 创建 EraserTrail 实例并绑定帧回调
   */
  startEraserTrail(baseSize: number): void {
    if (this.eraserTrail) this.eraserTrail.stop()
    this.eraserTrail = new EraserTrail({ baseSize })
    this.eraserTrail.start(outlines => {
      this.clearLiveLayer()
      if (!this.layerManager || outlines.length === 0) return
      const ctx = this.layerManager.getLiveContext()
      ctx.save()
      this.applyCamera(ctx)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.globalAlpha = 1
      for (const outline of outlines) ctx.fill(outline)
      ctx.restore()
    })
  }

  /**
   * 添加橡皮擦轨迹点
   */
  addEraserPoint(point: { x: number; y: number }): void {
    this.eraserTrail?.addPoint(point)
  }

  /**
   * 结束当前轨迹（进入衰减动画）
   */
  endEraserTrail(): void {
    this.eraserTrail?.endTrail()
  }

  /**
   * 停止轨迹动画并清理
   */
  stopEraserTrail(): void {
    if (this.eraserTrail) {
      this.eraserTrail.stop()
      this.eraserTrail = null
    }
  }

  // === 同步屏障 + 数据返回 ===

  /**
   * 等待所有绘制命令完成
   * Canvas 2D 渲染是同步的，直接返回 resolved Promise
   */
  flush(): Promise<void> {
    return Promise.resolve()
  }

  /**
   * 导出 render layer 为 Data URL
   */
  toDataURL(): Promise<string> {
    if (!this.layerManager) return Promise.resolve('')
    const ctx = this.layerManager.getRenderContext()
    return Promise.resolve((ctx.canvas as HTMLCanvasElement).toDataURL())
  }

  /**
   * 导出 render layer 为 Blob
   */
  exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob> {
    if (!this.layerManager) {
      return Promise.resolve(new Blob([], { type: `image/${format}` }))
    }
    const ctx = this.layerManager.getRenderContext()
    const canvas = ctx.canvas as HTMLCanvasElement
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
    return new Promise(resolve => {
      canvas.toBlob(
        blob => resolve(blob ?? new Blob([], { type: mimeType })),
        mimeType,
        quality
      )
    })
  }

  /**
   * 销毁渲染器，释放所有资源
   */
  dispose(): void {
    this.stopEraserTrail()
    this.detach()
  }

  // === Private methods ===

  /** 在指定 context 上绘制 Path2D（应用 Camera 变换） */
  private drawPath(
    ctx: CanvasRenderingContext2D,
    path: Path2D,
    style: StrokeStyle
  ): void {
    ctx.save()
    this.applyCamera(ctx)
    ctx.globalAlpha = style.opacity
    ctx.fillStyle = style.color
    ctx.fill(path)
    ctx.restore()
  }

  /** 应用 Camera 变换到 context */
  private applyCamera(ctx: CanvasRenderingContext2D): void {
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(
      dpr * this._camera.zoom, 0,
      0, dpr * this._camera.zoom,
      -this._camera.x * dpr * this._camera.zoom,
      -this._camera.y * dpr * this._camera.zoom
    )
  }

  /** 清除指定 context 的全部内容 */
  private clearContext(ctx: CanvasRenderingContext2D): void {
    const dpr = window.devicePixelRatio || 1
    // 恢复 identity transform（仅 DPI 缩放）
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this._containerWidth, this._containerHeight)
  }
}
