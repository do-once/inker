import type { Provider, Disposable } from './provider.types'

/**
 * 轻量级 DI 容器
 * 基于 Provider 模式，支持 singleton/transient 生命周期
 */
export class Container {
  /** 已注册的 provider */
  private readonly providers = new Map<symbol, Provider>()
  /** singleton 实例缓存 */
  private readonly singletons = new Map<symbol, unknown>()

  /**
   * 注册 provider
   * 重复注册同一 token 将覆盖之前的注册
   */
  register<T>(provider: Provider<T>): void {
    // 重复注册时清除旧的 singleton 缓存
    this.singletons.delete(provider.token)
    this.providers.set(provider.token, provider as Provider)
  }

  /**
   * 解析服务实例
   * singleton 返回缓存实例，transient 每次新建
   * @throws 未注册的 token 抛出错误
   */
  resolve<T>(token: symbol): T {
    const provider = this.providers.get(token)
    if (!provider) {
      throw new Error(`未注册的 token：${token.toString()}`)
    }

    const scope = provider.scope ?? 'singleton'

    if (scope === 'singleton') {
      if (!this.singletons.has(token)) {
        const instance = provider.useFactory(this)
        this.singletons.set(token, instance)
      }
      return this.singletons.get(token) as T
    }

    // transient：每次创建新实例
    return provider.useFactory(this) as T
  }

  /** 检查 token 是否已注册 */
  has(token: symbol): boolean {
    return this.providers.has(token)
  }

  /**
   * 销毁容器
   * 调用所有已实例化的 singleton 的 dispose() 方法
   */
  dispose(): void {
    for (const instance of this.singletons.values()) {
      if (isDisposable(instance)) {
        instance.dispose()
      }
    }
    this.singletons.clear()
    this.providers.clear()
  }
}

/** 判断实例是否实现了 Disposable 接口 */
function isDisposable(value: unknown): value is Disposable {
  return (
    value !== null &&
    typeof value === 'object' &&
    'dispose' in value &&
    typeof (value as Disposable).dispose === 'function'
  )
}
