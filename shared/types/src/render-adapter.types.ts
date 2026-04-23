import type { StrokePoint } from './stroke-point.types'
import type { StrokeStyle } from './stroke-style.types'
import type { Camera } from './camera.types'

/** 笔画数据（点序列 + 样式，用于渲染适配器消费） */
export interface StrokeData {
  readonly points: readonly StrokePoint[]
  readonly style: StrokeStyle
}

/** 渲染适配器接口 */
export interface RenderAdapterInterface {
  // === 生命周期 ===
  /** 绑定到 DOM 元素，初始化渲染层 */
  attach(element: HTMLElement, width: number, height: number): void
  /** 解绑 DOM 元素，移除渲染层 */
  detach(): void
  /** 调整渲染尺寸 */
  resize(width: number, height: number): void
  /** 销毁渲染器，释放资源 */
  dispose(): void

  // === 绘制命令（fire-and-forget） ===
  /** 绘制实时笔画（每次 move 事件调用） */
  drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  /** 提交笔画到持久层（笔画结束时调用） */
  commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  /** 清除实时层 */
  clearLiveLayer(): void
  /** 批量绘制所有活跃笔画（内部先清除 live layer，再遍历绘制） */
  drawLiveStrokes(strokes: readonly StrokeData[]): void
  /** 重绘所有已完成的笔画 */
  redrawAll(strokes: readonly StrokeData[]): void
  /** 清除所有渲染内容 */
  clearAll(): void
  /** 设置视口变换（Camera 状态） */
  setCamera(camera: Camera): void

  // === 橡皮擦轨迹管理 ===
  /** 启动橡皮擦轨迹动画 */
  startEraserTrail(baseSize: number): void
  /** 添加橡皮擦轨迹点 */
  addEraserPoint(point: { x: number; y: number }): void
  /** 结束当前轨迹（进入衰减） */
  endEraserTrail(): void
  /** 停止轨迹动画并清理 */
  stopEraserTrail(): void

  // === 同步屏障 ===
  /** 等待所有已发出的绘制命令执行完毕 */
  flush(): Promise<void>

  // === 数据返回（async） ===
  /** 导出当前渲染结果为 Blob */
  exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob>
  /** 导出为 Data URL */
  toDataURL(): Promise<string>
}
