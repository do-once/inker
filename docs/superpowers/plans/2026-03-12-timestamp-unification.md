# 时间戳统一实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全链路统一使用 Unix epoch 毫秒时间戳，修复回放 bug 并为多输入源扩展做好准备。

**Architecture:** 修改 `StrokeInputReceiver.addStrokePoint` 签名加入 `timestamp` 参数，EditorKernel 只消费不生产时间戳，PointerInputAdapter 统一使用 `Date.now()`。同时删除未被生产代码使用的 OperationFactory 和 PointExtractor 中废弃的 TimestampedPoint。

**Tech Stack:** TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-12-timestamp-unification-design.md`

---

## Chunk 1: 接口变更 + EditorKernel 修复

### Task 1: 修改 StrokeInputReceiver 接口和 StrokePoint 注释

**Files:**
- Modify: `shared/types/src/input-adapter.types.ts:25` — addStrokePoint 签名
- Modify: `shared/types/src/stroke-point.types.ts:7` — t 字段注释

- [ ] **Step 1: 修改 StrokeInputReceiver.addStrokePoint 签名**

```typescript
// shared/types/src/input-adapter.types.ts
// 将：
addStrokePoint(strokeId: string, point: RawPoint): void
// 改为：
addStrokePoint(strokeId: string, point: RawPoint, timestamp: number): void
```

- [ ] **Step 2: 修正 StrokePoint.t 注释**

```typescript
// shared/types/src/stroke-point.types.ts
// 将：
readonly t: number // 绝对时间戳（毫秒）
// 改为：
readonly t: number // 采样时间戳（Unix epoch 毫秒，Date.now() 语义）
```

- [ ] **Step 3: 运行 TypeScript 类型检查，确认预期的编译错误**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: 编译错误，指向 EditorKernel.addStrokePoint 和 PointerInputAdapter 中的调用不匹配。

---

### Task 2: 修复 EditorKernel.addStrokePoint

**Files:**
- Modify: `libraries/core/src/editor-kernel.service.ts:141` — addStrokePoint 方法签名和 t 赋值

- [ ] **Step 1: 修改 addStrokePoint 方法签名和时间戳赋值**

```typescript
// libraries/core/src/editor-kernel.service.ts
// 将：
addStrokePoint(strokeId: string, point: RawPoint): void {
// 改为：
addStrokePoint(strokeId: string, point: RawPoint, timestamp: number): void {

// 将方法内的：
    t: Date.now()
// 改为：
    t: timestamp
```

- [ ] **Step 2: 运行 EditorKernel 测试，确认因签名变更导致的失败**

Run: `cd libraries/core && npx vitest run --reporter=verbose 2>&1 | tail -30`
Expected: addStrokePoint 相关测试因缺少 timestamp 参数而失败。

---

### Task 3: 适配 EditorKernel 测试

**Files:**
- Modify: `libraries/core/src/__tests__/editor-kernel.service.spec.ts` — 所有 addStrokePoint 调用加 timestamp

- [ ] **Step 1: 为所有 addStrokePoint 调用加 timestamp 参数**

搜索测试文件中所有 `kernel.addStrokePoint(` 调用，在 rawPoint 参数后加 timestamp。

规则：
- 如果同一测试中 startStroke 使用了 timestamp 值（如 100），addStrokePoint 使用递增值（如 116、132，模拟 16ms 间隔）
- 独立测试中可使用任意一致的值（如 Date.now()）

示例（测试中典型的调用模式）：

```typescript
// 将：
kernel.addStrokePoint('s1', { x: 30, y: 40, pressure: 0.6 })
// 改为：
kernel.addStrokePoint('s1', { x: 30, y: 40, pressure: 0.6 }, 116)
```

对 applyOperation 相关测试，不需要改动（applyOperation 内部直接从 op.point.t 读取，不经过 addStrokePoint）。

- [ ] **Step 2: 运行 EditorKernel 全部测试**

Run: `cd libraries/core && npx vitest run --reporter=verbose 2>&1 | tail -40`
Expected: ALL PASS

- [ ] **Step 3: 提交**

```bash
git add shared/types/src/input-adapter.types.ts shared/types/src/stroke-point.types.ts libraries/core/src/editor-kernel.service.ts libraries/core/src/__tests__/editor-kernel.service.spec.ts
git commit -m "fix: 统一时间戳为 Unix epoch 毫秒，修复回放只显示起始点的 bug"
```

---

## Chunk 2: PointExtractor 简化 + PointerInputAdapter 适配

### Task 4: 简化 PointExtractor，删除 TimestampedPoint

**Files:**
- Modify: `libraries/input-pointer/src/point-extractor.service.ts` — 删除 TimestampedPoint，extract() 返回 RawPoint | null

- [ ] **Step 1: 修改 PointExtractor**

```typescript
// libraries/input-pointer/src/point-extractor.service.ts

// 删除 TimestampedPoint 接口定义（整个 export interface TimestampedPoint ... 块）
// 删除 import 中对 TimestampedPoint 的引用（如果有）

// 将 extract() 的返回类型：
extract(...): TimestampedPoint | null {
// 改为：
extract(...): RawPoint | null {

// 将 extract() 的返回对象中：
return {
  x,
  y,
  pressure: event.pressure,
  timestamp: event.timeStamp  // 删除此行
}
// 改为：
return {
  x,
  y,
  pressure: event.pressure
}
```

需要从 `@aw/types` 导入 `RawPoint`（如果尚未导入）。

- [ ] **Step 2: 适配 PointExtractor 测试**

```typescript
// libraries/input-pointer/src/__tests__/point-extractor.service.spec.ts

// 删除所有对 result.timestamp 的断言
// 删除所有对 TimestampedPoint 的类型引用
// 将 expect(result).toEqual({ x, y, pressure, timestamp }) 中的 timestamp 字段移除
```

- [ ] **Step 3: 运行 PointExtractor 测试**

Run: `cd libraries/input-pointer && npx vitest run point-extractor --reporter=verbose 2>&1 | tail -20`
Expected: ALL PASS

---

### Task 5: 适配 PointerInputAdapter

**Files:**
- Modify: `libraries/input-pointer/src/pointer-input.adapter.ts` — 统一 Date.now()，传 timestamp

- [ ] **Step 1: 修改 onPointerDown — 使用 Date.now()**

```typescript
// pointer-input.adapter.ts 的 onPointerDown 方法中
// 将：
this.kernel.startStroke(strokeId, rawPoint, point.timestamp)
// 改为：
this.kernel.startStroke(strokeId, rawPoint, Date.now())
```

注意：point 现在是 RawPoint 类型，不再有 timestamp 字段，所以这步也是修复编译错误。

- [ ] **Step 2: 修改 onPointerMove — 传入 timestamp**

```typescript
// pointer-input.adapter.ts 的 onPointerMove 方法中
// 将：
this.kernel.addStrokePoint(strokeId, rawPoint)
// 改为：
this.kernel.addStrokePoint(strokeId, rawPoint, Date.now())
```

- [ ] **Step 3: 修改 onPointerUp — 使用 Date.now()**

```typescript
// pointer-input.adapter.ts 的 onPointerUp 方法中
// 将所有通过 point.timestamp 或 point?.timestamp 获取时间戳的逻辑
// 统一为：
this.kernel.endStroke(strokeId, Date.now())
```

- [ ] **Step 4: 修改 onPointerCancel（如需）**

检查 onPointerCancel 是否已经使用 `Date.now()`。如果是，不需要改动。

- [ ] **Step 5: 适配 PointerInputAdapter 测试**

测试中涉及的改动：
1. 移除对 `point.timestamp` 传递的断言
2. startStroke 的 timestamp 参数验证改为：验证传入了一个 number 类型的值（`expect.any(Number)`）
3. addStrokePoint 的断言加上第三个参数 `expect.any(Number)`
4. endStroke 的 timestamp 参数验证同理

```typescript
// 示例：
// 将：
expect(kernel.startStroke).toHaveBeenCalledWith('uid-1', rawPoint, 12345.6)
// 改为：
expect(kernel.startStroke).toHaveBeenCalledWith('uid-1', rawPoint, expect.any(Number))

// 将：
expect(kernel.addStrokePoint).toHaveBeenCalledWith('uid-1', rawPoint)
// 改为：
expect(kernel.addStrokePoint).toHaveBeenCalledWith('uid-1', rawPoint, expect.any(Number))
```

- [ ] **Step 6: 运行 input-pointer 全部测试**

Run: `cd libraries/input-pointer && npx vitest run --reporter=verbose 2>&1 | tail -30`
Expected: ALL PASS

- [ ] **Step 7: 运行 TypeScript 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无编译错误（或仅剩 OperationFactory 相关的，将在 Task 6 处理）

- [ ] **Step 8: 提交**

```bash
git add libraries/input-pointer/
git commit -m "refactor: PointExtractor 移除 TimestampedPoint，PointerInputAdapter 统一 Date.now()"
```

---

## Chunk 3: 删除 OperationFactory + 最终验证

### Task 6: 删除 OperationFactory

**Files:**
- Delete: `libraries/model/src/operation-factory.service.ts`
- Delete: `libraries/model/src/__tests__/operation-factory.service.spec.ts`
- Modify: `libraries/model/src/index.ts` — 移除导出
- Modify: `libraries/model/README.md` — 移除相关章节

- [ ] **Step 1: 删除 OperationFactory 源文件和测试**

```bash
rm libraries/model/src/operation-factory.service.ts
rm libraries/model/src/__tests__/operation-factory.service.spec.ts
```

- [ ] **Step 2: 从 index.ts 移除导出**

```typescript
// libraries/model/src/index.ts
// 删除：
export { OperationFactory } from './operation-factory.service'
```

- [ ] **Step 3: 从 README.md 移除 OperationFactory 章节**

搜索 `libraries/model/README.md` 中关于 OperationFactory 的段落或章节，整段删除。

- [ ] **Step 4: 运行 model 包测试**

Run: `cd libraries/model && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: ALL PASS（OperationFactory 测试文件已删除，其他测试不受影响）

- [ ] **Step 5: 提交**

```bash
git add libraries/model/
git commit -m "refactor: 删除未使用的 OperationFactory，减少维护成本"
```

---

### Task 7: 全量验证

- [ ] **Step 1: TypeScript 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 全量测试**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -50`
Expected: ALL PASS

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 4: 同步文档**

检查并更新以下文档中涉及时间戳或 OperationFactory 的描述：
- `CLAUDE.md` — 如有 OperationFactory 引用需移除
- `libraries/input-pointer/README.md`（如存在）— 更新 PointExtractor API 描述
- `CHANGELOG.md` — 记录变更

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "docs: 同步更新文档，反映时间戳统一和 OperationFactory 删除"
```
