/**
 * DI Provider 类型定义
 */

/** Provider 生命周期 */
export type ProviderScope = 'singleton' | 'transient'

/** 可销毁接口 */
export interface Disposable {
  dispose(): void
}

/**
 * Provider 定义
 * 描述如何创建和管理一个服务实例
 */
export interface Provider<T = unknown> {
  /** 标识符，用于注册和解析 */
  readonly token: symbol
  /** 工厂函数，接收容器实例，返回服务实例 */
  readonly useFactory: (container: { resolve<U>(token: symbol): U }) => T
  /** 生命周期：singleton（默认）| transient */
  readonly scope?: ProviderScope
}
