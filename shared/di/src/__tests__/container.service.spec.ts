import { describe, it, expect, vi } from 'vitest'
import { Container } from '../container.service'

describe('Container', () => {
  describe('基本注册与解析', () => {
    it('register provider + resolve 返回实例', () => {
      const container = new Container()
      const token = Symbol('test')
      container.register({
        token,
        useFactory: () => ({ value: 42 })
      })
      const instance = container.resolve<{ value: number }>(token)
      expect(instance).toEqual({ value: 42 })
    })

    it('resolve 未注册的 token 抛错', () => {
      const container = new Container()
      const token = Symbol('unregistered')
      expect(() => container.resolve(token)).toThrow()
    })

    it('has(token) 对已注册的 token 返回 true', () => {
      const container = new Container()
      const token = Symbol('test')
      container.register({
        token,
        useFactory: () => 'hello'
      })
      expect(container.has(token)).toBe(true)
    })

    it('has(token) 对未注册的 token 返回 false', () => {
      const container = new Container()
      const token = Symbol('unknown')
      expect(container.has(token)).toBe(false)
    })
  })

  describe('作用域（scope）', () => {
    it('scope: singleton — 多次 resolve 返回同一实例', () => {
      const container = new Container()
      const token = Symbol('singleton')
      container.register({
        token,
        useFactory: () => ({ id: Math.random() }),
        scope: 'singleton'
      })
      const a = container.resolve(token)
      const b = container.resolve(token)
      expect(a).toBe(b)
    })

    it('scope: transient — 多次 resolve 返回不同实例', () => {
      const container = new Container()
      const token = Symbol('transient')
      container.register({
        token,
        useFactory: () => ({ id: Math.random() }),
        scope: 'transient'
      })
      const a = container.resolve(token)
      const b = container.resolve(token)
      expect(a).not.toBe(b)
    })

    it('默认 scope 为 singleton', () => {
      const container = new Container()
      const token = Symbol('default-scope')
      container.register({
        token,
        useFactory: () => ({ id: Math.random() })
      })
      const a = container.resolve(token)
      const b = container.resolve(token)
      expect(a).toBe(b)
    })
  })

  describe('依赖解析链', () => {
    it('useFactory 接收 container，支持依赖解析链', () => {
      const container = new Container()
      const tokenB = Symbol('B')
      const tokenA = Symbol('A')

      container.register({
        token: tokenB,
        useFactory: () => ({ name: 'B' })
      })

      container.register({
        token: tokenA,
        useFactory: c => {
          const b = c.resolve<{ name: string }>(tokenB)
          return { name: 'A', dep: b }
        }
      })

      const a = container.resolve<{ name: string; dep: { name: string } }>(tokenA)
      expect(a.name).toBe('A')
      expect(a.dep.name).toBe('B')
    })

    it('三层依赖链：A → B → C', () => {
      const container = new Container()
      const tokenC = Symbol('C')
      const tokenB = Symbol('B')
      const tokenA = Symbol('A')

      container.register({
        token: tokenC,
        useFactory: () => ({ name: 'C' })
      })

      container.register({
        token: tokenB,
        useFactory: c => ({
          name: 'B',
          dep: c.resolve<{ name: string }>(tokenC)
        })
      })

      container.register({
        token: tokenA,
        useFactory: c => ({
          name: 'A',
          dep: c.resolve<{ name: string; dep: { name: string } }>(tokenB)
        })
      })

      const a = container.resolve<{
        name: string
        dep: { name: string; dep: { name: string } }
      }>(tokenA)
      expect(a.name).toBe('A')
      expect(a.dep.name).toBe('B')
      expect(a.dep.dep.name).toBe('C')
    })
  })

  describe('重复注册', () => {
    it('重复注册同一 token 后 resolve 返回最新注册的实例', () => {
      const container = new Container()
      const token = Symbol('dup')

      container.register({
        token,
        useFactory: () => ({ version: 1 })
      })

      container.register({
        token,
        useFactory: () => ({ version: 2 })
      })

      const instance = container.resolve<{ version: number }>(token)
      expect(instance.version).toBe(2)
    })
  })

  describe('dispose', () => {
    it('dispose 调用所有 singleton 的 dispose 方法', () => {
      const container = new Container()
      const token = Symbol('disposable')
      const disposeFn = vi.fn()

      container.register({
        token,
        useFactory: () => ({ dispose: disposeFn }),
        scope: 'singleton'
      })

      // 先 resolve 以创建实例
      container.resolve(token)
      container.dispose()

      expect(disposeFn).toHaveBeenCalledOnce()
    })

    it('dispose 不影响没有 dispose 方法的实例', () => {
      const container = new Container()
      const token = Symbol('no-dispose')

      container.register({
        token,
        useFactory: () => ({ value: 1 })
      })

      container.resolve(token)

      // 不应抛错
      expect(() => container.dispose()).not.toThrow()
    })

    it('dispose 只处理已实例化的 singleton', () => {
      const container = new Container()
      const token1 = Symbol('resolved')
      const token2 = Symbol('not-resolved')
      const dispose1 = vi.fn()
      const dispose2 = vi.fn()

      container.register({
        token: token1,
        useFactory: () => ({ dispose: dispose1 }),
        scope: 'singleton'
      })

      container.register({
        token: token2,
        useFactory: () => ({ dispose: dispose2 }),
        scope: 'singleton'
      })

      // 只 resolve token1
      container.resolve(token1)
      container.dispose()

      expect(dispose1).toHaveBeenCalledOnce()
      expect(dispose2).not.toHaveBeenCalled()
    })

    it('dispose 不调用 transient 实例的 dispose 方法', () => {
      const container = new Container()
      const token = Symbol('transient-disposable')
      const disposeFn = vi.fn()

      container.register({
        token,
        useFactory: () => ({ dispose: disposeFn }),
        scope: 'transient'
      })

      container.resolve(token)
      container.dispose()

      // transient 实例不由容器管理生命周期
      expect(disposeFn).not.toHaveBeenCalled()
    })
  })
})
