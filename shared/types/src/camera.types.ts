/**
 * Camera 视口状态
 * 管理视口变换（resize/zoom/pan 统一为 camera 变化）
 */
export interface Camera {
  /** 视口左上角在世界坐标中的 X 位置 */
  readonly x: number
  /** 视口左上角在世界坐标中的 Y 位置 */
  readonly y: number
  /** 缩放倍率（1.0 = 100%） */
  readonly zoom: number
}
