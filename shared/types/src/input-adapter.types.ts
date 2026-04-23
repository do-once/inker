/**
 * 输入适配器相关类型
 */

/** 指针类型 */
export type PointerType = 'mouse' | 'touch' | 'pen'

/** 原始输入坐标点（屏幕坐标，未转换为世界坐标） */
export interface RawPoint {
  /** x 像素坐标 */
  readonly x: number
  /** y 像素坐标 */
  readonly y: number
  /** 压力值（0-1），无压感设备为 0 */
  readonly pressure: number
}

/** 笔画输入接收者接口 — EditorKernel 实现此接口 */
export interface StrokeInputReceiver {
  /** 开始一条新笔画 */
  startStroke(strokeId: string, point: RawPoint, timestamp: number): void
  /** 追加采样点 */
  addStrokePoint(strokeId: string, point: RawPoint, timestamp: number): void
  /** 结束笔画 */
  endStroke(strokeId: string, timestamp: number): void
}

/** 输入适配器接口 */
export interface InputAdapterInterface {
  /** 绑定 kernel，建立输入→内核通道 */
  bindKernel(kernel: StrokeInputReceiver): void
  /** 销毁适配器，释放资源 */
  dispose(): void
}
