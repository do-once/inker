import type { StrokeStyle } from './stroke-style.types'
import type { PointerType } from './input-adapter.types'

/**
 * 编辑器主题配置
 */
export interface EditorTheme {
  /** 墨水笔配置 */
  readonly ink: {
    readonly color: string
    readonly size: number
    readonly opacity: number
  }
  /** 橡皮擦配置 */
  readonly eraser: {
    readonly size: number
    readonly cursor?: string
  }
  /** 马克笔配置 */
  readonly marker: {
    readonly color: string
    readonly size: number
    readonly opacity: number
  }
}

/**
 * 编辑器初始化选项
 */
export interface EditorOptions {
  /** 挂载的 DOM 元素 */
  readonly element: HTMLElement
  /** 主题配置 */
  readonly theme?: Partial<EditorTheme>
  /** 初始笔画样式 */
  readonly penStyle?: Partial<StrokeStyle>
  /** 允许的指针类型 */
  readonly allowedPointerTypes?: PointerType[]
}
