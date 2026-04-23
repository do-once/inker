import type { OutlineGeometry } from './outline-geometry.types'
import type { StrokePoint } from './stroke-point.types'
import type { StrokeStyle, StrokeType } from './stroke-style.types'
import type { Stroke } from './stroke.types'

/**
 * 笔画处理器接口
 * 负责将采样点（世界坐标）转换为可渲染的路径
 */
export interface StrokeProcessorInterface {
  /** 支持的笔画类型 */
  readonly supportedTypes: readonly StrokeType[]

  /**
   * 计算笔画轮廓路径
   * @param points 采样点序列（世界坐标）
   * @param style 笔画样式
   * @param complete 笔画是否已完成
   * @returns 路径对象，无有效路径时返回 null
   */
  computeOutline(
    points: readonly StrokePoint[],
    style: StrokeStyle,
    complete: boolean
  ): OutlineGeometry | null

  /**
   * 计算被擦除的笔画 ID 列表（可选）
   * @param eraserPoints 擦除器采样点（世界坐标）
   * @param eraserStyle 擦除器样式
   * @param existingStrokes 现有笔画集合
   * @returns 被擦除的笔画 ID 列表
   */
  computeErasure?(
    eraserPoints: readonly StrokePoint[],
    eraserStyle: StrokeStyle,
    existingStrokes: ReadonlyMap<string, Stroke>
  ): string[]
}
