# @inker/di

轻量级依赖注入容器，零外部依赖，可独立复用。

## 设计目标

- **极简**：核心只有 Container + InjectionToken + Provider 三个概念
- **类型安全**：通过泛型 `InjectionToken<T>` 保证 resolve 返回正确类型
- **生命周期管理**：支持 singleton / transient 作用域，singleton 自动 dispose

## 核心概念

```mermaid
graph LR
  Token["InjectionToken&lt;T&gt;<br/>类型安全标识符"]
  Provider["Provider&lt;T&gt;<br/>工厂 + 作用域"]
  Container["Container<br/>注册 + 解析 + 销毁"]

  Provider -- "token" --> Token
  Provider -- "useFactory(container)" --> Container
  Container -- "register(provider)" --> Provider
  Container -- "resolve(token)" --> Token
```

## 解析流程

```mermaid
flowchart TD
  resolve["container.resolve(token)"]
  has{已注册?}
  scope{scope?}
  cached{已缓存?}
  create["useFactory(container)"]
  cache["缓存实例"]
  return["返回实例"]
  throw["抛出错误"]

  resolve --> has
  has -- 否 --> throw
  has -- 是 --> scope
  scope -- singleton --> cached
  scope -- transient --> create --> return
  cached -- 是 --> return
  cached -- 否 --> create --> cache --> return
```

## API

### Container

```typescript
import { Container } from '@inker/di'

const container = new Container()

// 注册（默认 singleton）
container.register({
  token: EVENT_BUS,
  useFactory: () => new EventBus()
})

// 注册 transient（每次 resolve 新建实例）
container.register({
  token: LOGGER,
  useFactory: () => new Logger(),
  scope: 'transient'
})

// 依赖解析链（factory 接收 container，可 resolve 其他服务）
container.register({
  token: RENDER_ADAPTER,
  useFactory: c => new CanvasRenderAdapter(c.resolve(EVENT_BUS)),
  scope: 'singleton'
})

// 解析
const bus = container.resolve<EventBus>(EVENT_BUS)

// 检查
container.has(EVENT_BUS) // true

// 销毁（调用所有 singleton 的 dispose()）
container.dispose()
```

### InjectionToken

```typescript
import { InjectionToken } from '@inker/di'

// 泛型参数确保 resolve 时返回正确类型
const EVENT_BUS = new InjectionToken<EventBus>('EventBus')
```

### Provider

```typescript
import type { Provider } from '@inker/di'

const provider: Provider<EventBus> = {
  token: EVENT_BUS,
  useFactory: (container) => new EventBus(),
  scope: 'singleton' // 'singleton' | 'transient'，默认 'singleton'
}
```

### Disposable

实现 `Disposable` 接口的 singleton 在 `container.dispose()` 时自动调用 `dispose()`：

```typescript
import type { Disposable } from '@inker/di'

class EventBus implements Disposable {
  dispose(): void {
    // 清理资源
  }
}
```
