/**
 * 全局服务 DI Token
 * 用于在 Container 中注册和解析核心服务
 */

/** 事件总线 */
export const EVENT_BUS = Symbol('EventBus')

/** 输入适配器 */
export const INPUT_ADAPTER = Symbol('InputAdapter')

/** 渲染适配器 */
export const RENDER_ADAPTER = Symbol('RenderAdapter')

/** 笔画处理器 */
export const STROKE_PROCESSOR = Symbol('StrokeProcessor')

/**
 * 计算策略
 * @deprecated 计算职责已内聚到各 RenderAdapter 内部，不再需要独立的计算策略 Token。
 */
export const COMPUTE_STRATEGY = Symbol('ComputeStrategy')

/** 笔画文档 */
export const STROKE_DOCUMENT = Symbol('StrokeDocument')

/** 坐标系统 */
export const COORDINATE_SYSTEM = Symbol('CoordinateSystem')
