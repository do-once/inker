// libraries/render-offscreen/src/offscreen-render.adapter.ts
import { RenderAdapter } from '@inker/core'
import type { StrokePoint, StrokeStyle, StrokeData, Camera } from '@inker/types'
import { WorkerBridgeHost } from '@inker/render-protocol'

/**
 * OffscreenCanvas 渲染适配器（主线程侧 proxy）
 * 创建双 Canvas -> transferControlToOffscreen -> 通过 WorkerBridge 发送指令到 Worker
 */
export class OffscreenRenderAdapter extends RenderAdapter {
  private bridge: WorkerBridgeHost | null = null
  private liveCanvas: HTMLCanvasElement | null = null
  private renderCanvas: HTMLCanvasElement | null = null
  private workerInstance: Worker | null = null
  private workerUrl: string | URL

  constructor(workerUrl: string | URL) {
    super()
    this.workerUrl = workerUrl
  }

  attach(element: HTMLElement, width: number, height: number): void {
    // 创建双层 Canvas
    this.renderCanvas = this.createCanvas(width, height)
    this.renderCanvas.style.pointerEvents = 'none'
    element.appendChild(this.renderCanvas)

    this.liveCanvas = this.createCanvas(width, height)
    element.appendChild(this.liveCanvas)

    // 转移控制权到 OffscreenCanvas
    const offscreenRender = this.renderCanvas.transferControlToOffscreen()
    const offscreenLive = this.liveCanvas.transferControlToOffscreen()

    // 启动 Worker
    this.workerInstance = new Worker(this.workerUrl, { type: 'module' })
    this.bridge = new WorkerBridgeHost(this.workerInstance)

    // 发送初始化消息（transfer OffscreenCanvas 作为 Transferable）
    this.workerInstance.postMessage(
      {
        cmd: 'init',
        renderCanvas: offscreenRender,
        liveCanvas: offscreenLive,
        width,
        height
      },
      [offscreenRender, offscreenLive]
    )
  }

  detach(): void {
    if (this.liveCanvas?.parentElement) {
      this.liveCanvas.parentElement.removeChild(this.liveCanvas)
    }
    if (this.renderCanvas?.parentElement) {
      this.renderCanvas.parentElement.removeChild(this.renderCanvas)
    }
    this.liveCanvas = null
    this.renderCanvas = null
  }

  resize(width: number, height: number): void {
    this.bridge?.send({ cmd: 'resize', width, height })
    // 同步更新 CSS 尺寸（DOM 操作在主线程）
    if (this.liveCanvas) {
      this.liveCanvas.style.width = `${width}px`
      this.liveCanvas.style.height = `${height}px`
    }
    if (this.renderCanvas) {
      this.renderCanvas.style.width = `${width}px`
      this.renderCanvas.style.height = `${height}px`
    }
  }

  drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void {
    this.bridge?.send({ cmd: 'drawLive', points: [...points], style })
  }

  commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void {
    this.bridge?.send({ cmd: 'commit', points: [...points], style })
  }

  clearLiveLayer(): void {
    this.bridge?.send({ cmd: 'clearLive' })
  }

  /**
   * 批量绘制所有活跃笔画（先清除 live layer，再遍历绘制）
   * 用于多点触控场景，一次传输所有正在进行中的笔画
   */
  drawLiveStrokes(strokes: readonly StrokeData[]): void {
    this.bridge?.send({
      cmd: 'drawLiveStrokes',
      strokes: strokes.map(s => ({ points: [...s.points], style: s.style }))
    })
  }

  redrawAll(strokes: readonly StrokeData[]): void {
    this.bridge?.send({
      cmd: 'redrawAll',
      strokes: strokes.map(s => ({ points: [...s.points], style: s.style }))
    })
  }

  clearAll(): void {
    this.bridge?.send({ cmd: 'clearAll' })
  }

  setCamera(camera: Camera): void {
    this.bridge?.send({ cmd: 'setCamera', camera })
  }

  startEraserTrail(baseSize: number): void {
    this.bridge?.send({ cmd: 'startEraserTrail', baseSize })
  }

  addEraserPoint(point: { x: number; y: number }): void {
    this.bridge?.send({ cmd: 'addEraserPoint', point })
  }

  endEraserTrail(): void {
    this.bridge?.send({ cmd: 'endEraserTrail' })
  }

  stopEraserTrail(): void {
    this.bridge?.send({ cmd: 'stopEraserTrail' })
  }

  async flush(): Promise<void> {
    if (!this.bridge) return
    await this.bridge.request({ cmd: 'flush' })
  }

  async exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob> {
    if (!this.bridge) return new Blob([], { type: `image/${format}` })
    const resp = await this.bridge.request({ cmd: 'export', format, quality })
    if (resp.cmd === 'exported') return resp.blob
    return new Blob([], { type: `image/${format}` })
  }

  async toDataURL(): Promise<string> {
    if (!this.bridge) return ''
    const resp = await this.bridge.request({ cmd: 'toDataURL' })
    if (resp.cmd === 'dataURL') return resp.url
    return ''
  }

  dispose(): void {
    this.bridge?.dispose()
    this.bridge = null
    this.workerInstance = null
    this.detach()
  }

  /** 创建 Canvas 元素并设置 DPR 缩放 */
  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    return canvas
  }
}
