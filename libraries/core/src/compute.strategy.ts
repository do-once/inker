import type {
  ComputeStrategyInterface,
  StrokeProcessorInterface,
  StrokePoint,
  StrokeStyle,
  OutlineGeometry
} from '@inker/types'

/**
 * 计算策略抽象基类
 * 决定笔画轮廓计算在主线程还是 Worker 中执行
 * 具体实现在 @inker/compute-worker 中
 *
 * @deprecated 计算职责已内聚到各 RenderAdapter 内部，不再需要独立的计算策略。
 * 请使用 @inker/render-canvas 或 @inker/render-offscreen 替代。
 */
export abstract class ComputeStrategy implements ComputeStrategyInterface {
  abstract computeOutline(
    processor: StrokeProcessorInterface,
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): Promise<OutlineGeometry | null>

  abstract dispose(): void
}
