/**
 * 笔画采样点
 * 纯数据，不含任何渲染状态
 */
export interface StrokePoint {
  /** 世界坐标 x（像素） */
  readonly x: number
  /** 世界坐标 y（像素） */
  readonly y: number
  /** 采样时间戳（Unix epoch 毫秒，Date.now() 语义） */
  readonly t: number
  /** 压力值（0-1） */
  readonly p: number
}
