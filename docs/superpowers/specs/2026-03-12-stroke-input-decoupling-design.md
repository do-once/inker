# 笔画输入解耦重构设计文档

> 日期：2026-03-12
> 状态：已批准

## 标题

笔画输入解耦重构 — EditorKernel API 从输入事件模型转向笔画语义模型

## 背景与动机

### Bug 触发

多指同时书写后回放时笔迹粘连。根因是 `applyOperation` 用固定的 `REPLAY_POINTER_ID = -1` 作为 `activeSessions` Map 的 key，多条并发笔画互相覆盖。

### 更深层问题

`pointerId` 是浏览器 PointerEvent 的概念，属于输入适配器的内部实现，不应泄漏到 EditorKernel。当前架构中 kernel 的 `handleInput(InputEvent)` 和 `InputEvent` 类型本质上是浏览器输入模型的投影（四种事件类型、cancel 语义、联合类型结构），限制了未来接入非浏览器输入源（原生容器报点、协同编辑等）。

### 设计目标

让 EditorKernel 的 API 表达笔画领域语义而非输入设备语义，彻底与输入源解耦。

## 设计决策记录

按讨论顺序记录决策点和选择。

### 决策 1：activeSessions 的 key

| 项 | 内容 |
|----|------|
| 选择 | 统一用 `strokeId`（string）而非 `pointerId`（number） |
| 理由 | `strokeId` 是笔画的唯一标识，`pointerId` 只是输入路由地址。回放/协同场景天然有 strokeId，无需 hack |

### 决策 2：strokeId 的创建职责

| 项 | 内容 |
|----|------|
| 选择 | 方案 A — 由输入适配器创建 strokeId，传给 EditorKernel |
| 理由 | 统一为"ID 永远由外部提供"，消除 kernel 内部"有时自己生成、有时外部传入"的分裂。回放直接用 op.strokeId，协同直接用远端 strokeId，正常书写由适配器生成 UUID |

### 决策 3：橡皮擦指针锁

| 项 | 内容 |
|----|------|
| 选择 | 方案 A — kernel 内用 `activeEraserStrokeId: string \| null` 管理 |
| 理由 | "橡皮擦同时只能一个"是编辑业务规则，属于 kernel 层。适配器只管报点 |

### 决策 4：EditorKernel 公共 API 风格

| 项 | 内容 |
|----|------|
| 选择 | 方案 B — 拆为语义方法 `startStroke / addStrokePoint / endStroke` |
| 理由 | kernel 是"笔画编辑器内核"不是"输入事件处理器"。方法签名直接表达领域职责，编译期类型安全，回放和正常书写可走同一套内核逻辑。废弃 handleInput + 内部 switch 分发 |

### 决策 5：InputAdapterInterface 中的平台特定方法

| 项 | 内容 |
|----|------|
| 选择 | 接口只保留平台无关方法（bindKernel + dispose），attach/detach/setAllowedPointerTypes 留给具体实现 |
| 理由 | `attach(element: HTMLElement)` 绑定了 DOM，原生容器适配器不需要。EditorKernel 只依赖通用接口 |

### 决策 6：InputAdapter 抽象基类

| 项 | 内容 |
|----|------|
| 选择 | 删除 |
| 理由 | 改造后无可共享逻辑，符合 YAGNI 原则。需要时再引入 |

### 决策 7：InputEvent 类型

| 项 | 内容 |
|----|------|
| 选择 | 直接删除 |
| 理由 | kernel 不再消费它，PointerEvent 已包含适配器需要的所有字段，中间再包一层没有实际价值 |

### 决策 8：startStroke 不接收 style 参数

| 项 | 内容 |
|----|------|
| 选择 | kernel 内部使用 `this._penStyle`，适配器不传 style |
| 理由 | 适配器从 kernel 读 penStyle 再传回 kernel 是冗余的。回放走 applyOperation 路径，用 op.style，不经过 startStroke |

### 决策 9：StrokeInputReceiver 不暴露 penStyle

| 项 | 内容 |
|----|------|
| 选择 | penStyle 不放在 StrokeInputReceiver 接口上 |
| 理由 | StrokeInputReceiver 职责是接收笔画输入，penStyle 是编辑器状态查询，混在一起违反接口隔离原则（ISP） |

## 架构设计

### 新增类型：StrokeInputReceiver（@aw/types）

```typescript
interface StrokeInputReceiver {
  startStroke(strokeId: string, point: RawPoint, timestamp: number): void
  addStrokePoint(strokeId: string, point: RawPoint): void
  endStroke(strokeId: string, timestamp: number): void
}
```

### 改造：InputAdapterInterface（@aw/types）

```typescript
interface InputAdapterInterface {
  bindKernel(kernel: StrokeInputReceiver): void
  dispose(): void
}
```

### 改造：EditorKernel（@aw/core）

废弃：

- `handleInput(event: InputEvent)` — 删除
- `REPLAY_POINTER_ID` 常量 — 删除
- 私有 `handleDown/Move/Up/Cancel` — 重构为内部逻辑

新增公开方法（implements StrokeInputReceiver）：

- `startStroke(strokeId, point, timestamp)` — 不接收 style，内部使用 `this._penStyle`
- `addStrokePoint(strokeId, point)`
- `endStroke(strokeId, timestamp)`

内部变更：

- `activeSessions: Map<string, StrokeSession>` — key 从 number 改为 string
- `activeEraserPointerId` → `activeEraserStrokeId: string | null`
- `applyOperation` 中直接用 `op.strokeId` 查 activeSessions

### 改造：StrokeSession（@aw/core）

- 构造函数删除 `pointerId` 参数：`constructor(strokeId: string, firstPoint: StrokePoint, timestamp: number)`
- 删除 `readonly pointerId: number` 字段

### 删除：InputAdapter 抽象基类（@aw/core）

整个 `libraries/core/src/input.adapter.ts` 文件删除。

### 改造：PointerInputAdapter（@aw/input-pointer）

- 直接 `implements InputAdapterInterface`（不再继承 InputAdapter 基类）
- 内部新增 `pointerToStroke: Map<number, string>`：down 时生成 UUID 建立映射，up/cancel 时删除
- 删除 `emit()` 方法和 `InputEvent` 构造

事件处理变化：

| 事件 | 改造后行为 |
|------|-----------|
| onPointerDown | 生成 strokeId，建立映射，调用 `kernel.startStroke(strokeId, ...)` |
| onPointerMove | 查 pointerToStroke 映射，调用 `kernel.addStrokePoint(strokeId, ...)` |
| onPointerUp | 查映射，调用 `kernel.endStroke(strokeId, ...)`，删除映射 |
| onPointerCancel | 内部转换为 `kernel.endStroke(strokeId, ...)`，cancel 不泄漏到 kernel |

不变：`allowedPointerTypes` 过滤逻辑保留在适配器内部。

### 删除：InputEvent 类型（@aw/types）

从 `shared/types/src/input-adapter.types.ts` 中删除 `InputEvent` 类型定义。

## 数据流对比

### 改造前

```
正常书写：DOM PointerEvent → PointerInputAdapter.emit() → InputEvent → onInput 回调 → EditorKernel.handleInput() → switch → handleDown/Move/Up(pointerId)
回放：    Operation → EditorKernel.applyOperation() → REPLAY_POINTER_ID → activeSessions
```

两条路径使用不同的入口、不同的数据结构、不同的 session key。

### 改造后

```
正常书写：DOM PointerEvent → PointerInputAdapter → pointerId→strokeId 映射 → kernel.startStroke/addStrokePoint/endStroke(strokeId)
回放：    Operation → EditorKernel.applyOperation() → op.strokeId → activeSessions
未来协同：远端消息 → strokeId → kernel.startStroke/addStrokePoint/endStroke(strokeId)
未来原生：Native Bridge → nativeId→strokeId 映射 → kernel.startStroke/addStrokePoint/endStroke(strokeId)
```

所有路径最终汇入 `activeSessions: Map<string, StrokeSession>`，统一用 strokeId 查找。

## 依赖关系

```
@aw/types（StrokeInputReceiver + InputAdapterInterface）
    ↑                    ↑
@aw/core（EditorKernel implements StrokeInputReceiver）
    ↑
@aw/input-pointer（PointerInputAdapter implements InputAdapterInterface）
```

## 影响范围

### 需要修改的源码文件

| 包 | 文件 | 改动 |
|---|------|------|
| @aw/types | input-adapter.types.ts | 删除 InputEvent，改造 InputAdapterInterface，新增 StrokeInputReceiver |
| @aw/core | editor-kernel.service.ts | 删除 handleInput/REPLAY_POINTER_ID，新增三个公开方法，activeSessions key 改为 string |
| @aw/core | stroke-session.ts | 构造函数删除 pointerId |
| @aw/core | input.adapter.ts | 整个文件删除 |
| @aw/input-pointer | pointer-input.adapter.ts | 重写：直接 implements 接口，维护 pointerToStroke 映射，调用 kernel 方法 |

### 需要更新的测试

| 测试文件 | 改动 |
|---------|------|
| editor-kernel.service.spec.ts | 从构造 InputEvent 改为直接调用 startStroke/addStrokePoint/endStroke |
| editor-kernel.multi-pointer.spec.ts | 多指测试用不同 strokeId |
| stroke-session.spec.ts | 删除 pointerId 相关断言 |
| pointer-input.adapter.spec.ts | 验证 pointerToStroke 映射、bindKernel、cancel 转 endStroke |

### 需要更新的文档

| 文件 | 改动 |
|------|------|
| CLAUDE.md | 数据流图、核心抽象、公共 API、关键文件表 |
| README.md（根目录） | 时序图 |
| libraries/core/README.md | 输入处理部分重写 |
| libraries/input-pointer/README.md | 适配器职责重写 |
| shared/types/README.md | 接口定义更新 |
| libraries/sdk/README.md | DI 组装流程更新 |
| CHANGELOG.md | 记录架构变更 |

`docs/superpowers/` 下所有历史文档不动（事实记录）。

## 术语统一

| 旧术语 | 新术语 |
|--------|--------|
| InputEvent | 删除 |
| InputAdapter（抽象基类） | 删除 |
| handleInput / handleDown / handleMove / handleUp | startStroke / addStrokePoint / endStroke |
| onInput 回调 | bindKernel(kernel: StrokeInputReceiver) |
| pointerId（kernel 层面） | strokeId |
| REPLAY_POINTER_ID | 删除 |
| activeEraserPointerId | activeEraserStrokeId |
