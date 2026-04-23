import type {
  InputAdapterInterface,
  RenderAdapterInterface,
  StrokeProcessorInterface,
  StrokeStyle,
  PointerType
} from '@inker/types'
import { EventBus, EditorKernel } from '@inker/core'
import { StrokeDocument, CoordinateSystem } from '@inker/model'
import { PointerInputAdapter } from '@inker/input-pointer'
import { CanvasRenderAdapter } from '@inker/render-canvas'
import { FreehandProcessor, RectEraserProcessor } from '@inker/brush-freehand'
import { Inker } from './inker.facade'

/**
 * 编辑器构建器
 * 使用 Builder 模式组装 EditorKernel 的所有依赖
 */
export class EditorBuilder {
  private element: HTMLElement | null = null
  private inputAdapter: InputAdapterInterface | null = null
  private renderAdapter: RenderAdapterInterface | null = null
  private strokeProcessor: StrokeProcessorInterface | null = null
  private eraserProcessor: StrokeProcessorInterface | null = null
  private initialPenStyle: StrokeStyle | null = null
  private allowedPointerTypes: PointerType[] | null = null
  private docWidth: number | null = null
  private docHeight: number | null = null

  /** 设置挂载的 DOM 元素 */
  withElement(element: HTMLElement): this {
    this.element = element
    return this
  }

  /** 设置自定义输入适配器 */
  withInputAdapter(adapter: InputAdapterInterface): this {
    this.inputAdapter = adapter
    return this
  }

  /** 设置自定义渲染适配器 */
  withRenderAdapter(adapter: RenderAdapterInterface): this {
    this.renderAdapter = adapter
    return this
  }

  /** 设置自定义笔画处理器 */
  withStrokeProcessor(processor: StrokeProcessorInterface): this {
    this.strokeProcessor = processor
    return this
  }

  /** 设置自定义橡皮擦处理器 */
  withEraserProcessor(processor: StrokeProcessorInterface): this {
    this.eraserProcessor = processor
    return this
  }

  /** 设置初始笔画样式 */
  withPenStyle(style: StrokeStyle): this {
    this.initialPenStyle = style
    return this
  }

  /** 设置允许的指针类型 */
  withAllowedPointerTypes(types: PointerType[]): this {
    this.allowedPointerTypes = types
    return this
  }

  /** 设置文档逻辑尺寸（不设置则默认等于容器尺寸） */
  withDocumentSize(width: number, height: number): this {
    this.docWidth = width
    this.docHeight = height
    return this
  }

  /**
   * 构建编辑器实例
   * @throws 缺少必要的 element 时抛出错误
   */
  build(): Inker {
    if (!this.element) {
      throw new Error('EditorBuilder: 缺少 element，请调用 withElement() 设置挂载元素')
    }

    const element = this.element
    const width = element.clientWidth || 800
    const height = element.clientHeight || 600

    // 创建事件总线
    const eventBus = new EventBus()

    // 创建或使用自定义输入适配器
    const inputAdapter = this.inputAdapter ?? new PointerInputAdapter()

    if (this.allowedPointerTypes && 'setAllowedPointerTypes' in inputAdapter) {
      (inputAdapter as PointerInputAdapter).setAllowedPointerTypes(this.allowedPointerTypes)
    }

    // 创建或使用自定义笔画处理器
    const strokeProcessor = this.strokeProcessor ?? new FreehandProcessor()

    // 创建或使用自定义渲染适配器
    const renderAdapter = this.renderAdapter ?? new CanvasRenderAdapter(strokeProcessor)
    renderAdapter.attach(element, width, height)

    // 创建橡皮擦处理器（默认矩形检测）
    const eraserProcessor = this.eraserProcessor ?? new RectEraserProcessor()

    // 创建文档模型
    const document = new StrokeDocument()

    // 创建坐标系统（支持自定义文档尺寸）
    const coordinateSystem = new CoordinateSystem(
      width,
      height,
      this.docWidth ?? undefined,
      this.docHeight ?? undefined
    )

    // 初始 Camera 同步到渲染适配器
    renderAdapter.setCamera(coordinateSystem.camera)

    // 组装 EditorKernel
    const kernel = new EditorKernel({
      eventBus,
      inputAdapter,
      renderAdapter,
      document,
      coordinateSystem,
      eraserProcessor
    })

    // 绑定输入适配器到内核（适配器直接调用内核方法）
    inputAdapter.bindKernel(kernel)

    // 绑定到 DOM 元素（在 bindKernel 之后，确保事件触发时 kernel 已就绪）
    if ('attach' in inputAdapter) {
      (inputAdapter as PointerInputAdapter).attach(element)
    }

    // 设置初始笔画样式
    if (this.initialPenStyle) {
      kernel.penStyle = this.initialPenStyle
    }

    return new Inker(kernel, eventBus, element)
  }
}
