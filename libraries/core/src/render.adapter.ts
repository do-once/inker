import type {
  RenderAdapterInterface,
  StrokeData,
  StrokePoint,
  StrokeStyle,
  Camera
} from '@inker/types'

/**
 * 渲染适配器抽象基类
 * 具体实现在 @inker/render-canvas、@inker/render-offscreen 等包中
 */
export abstract class RenderAdapter implements RenderAdapterInterface {
  // 生命周期
  abstract attach(element: HTMLElement, width: number, height: number): void
  abstract detach(): void
  abstract resize(width: number, height: number): void
  abstract dispose(): void

  // 绘制命令（fire-and-forget）
  abstract drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  abstract commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  abstract clearLiveLayer(): void
  abstract drawLiveStrokes(strokes: readonly StrokeData[]): void
  abstract redrawAll(strokes: readonly StrokeData[]): void
  abstract clearAll(): void
  abstract setCamera(camera: Camera): void

  // 橡皮擦轨迹管理
  abstract startEraserTrail(baseSize: number): void
  abstract addEraserPoint(point: { x: number; y: number }): void
  abstract endEraserTrail(): void
  abstract stopEraserTrail(): void

  // 同步屏障 + 数据返回
  abstract flush(): Promise<void>
  abstract exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob>
  abstract toDataURL(): Promise<string>
}
