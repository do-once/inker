import { ComputeStrategy } from '@inker/core'
import type { StrokeProcessorInterface, StrokePoint, StrokeStyle, OutlineGeometry } from '@inker/types'

/**
 * 主线程计算策略
 * 直接在主线程调用 processor 计算轮廓，适用于简单场景
 *
 * @deprecated 计算职责已内聚到各 RenderAdapter 内部。
 * 请使用 @inker/render-canvas（内部同步计算）替代。
 */
export class MainThreadStrategy extends ComputeStrategy {
  /**
   * 在主线程直接调用 processor.computeOutline
   * 返回 Promise.resolve 包装的结果
   */
  computeOutline(
    processor: StrokeProcessorInterface,
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): Promise<OutlineGeometry | null> {
    return Promise.resolve(
      processor.computeOutline(points, style, complete)
    )
  }

  /** 主线程策略无需清理资源 */
  dispose(): void {
    // 空操作
  }
}
