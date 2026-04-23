import type { StrokePoint } from './stroke-point.types'
import type { StrokeStyle } from './stroke-style.types'
import type { StrokeProcessorInterface } from './stroke-processor.types'
import type { OutlineGeometry } from './outline-geometry.types'

/**
 * 计算策略接口
 * 决定笔画轮廓计算在主线程还是 Worker 中执行
 *
 * @deprecated 计算职责已内聚到各 RenderAdapter 内部，不再需要独立的计算策略。
 * 请使用 @inker/render-canvas 或 @inker/render-offscreen 替代。
 */
export interface ComputeStrategyInterface {
  /**
   * 计算笔画轮廓路径
   * @param processor 笔画处理器
   * @param points 采样点序列（世界坐标）
   * @param style 笔画样式
   * @param complete 笔画是否已完成
   * @returns 路径对象的 Promise
   */
  computeOutline(
    processor: StrokeProcessorInterface,
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): Promise<OutlineGeometry | null>

  /** 销毁策略，释放资源（如终止 Worker） */
  dispose(): void
}
