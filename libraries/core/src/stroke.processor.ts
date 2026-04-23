import type {
  StrokeProcessorInterface,
  StrokePoint,
  StrokeStyle,
  StrokeType,
  Stroke,
  OutlineGeometry
} from '@inker/types'

/**
 * 笔画处理器抽象基类
 * 具体实现在 @inker/brush-freehand 等包中
 */
export abstract class StrokeProcessor implements StrokeProcessorInterface {
  abstract readonly supportedTypes: readonly StrokeType[]

  abstract computeOutline(
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): OutlineGeometry | null

  computeErasure?(
    eraserPoints: readonly StrokePoint[],
    eraserStyle: StrokeStyle,
    existingStrokes: ReadonlyMap<string, Stroke>
  ): string[]
}
