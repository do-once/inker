/**
 * 类型安全的注入标识符
 * 封装 Symbol，提供更好的调试信息
 */
export class InjectionToken<_T> {
  readonly symbol: symbol

  constructor(description: string) {
    this.symbol = Symbol(description)
  }

  toString(): string {
    return this.symbol.toString()
  }
}
