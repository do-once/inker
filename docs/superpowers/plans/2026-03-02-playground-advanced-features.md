# Playground 高级功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 playground 添加笔迹回放和导出（PNG/JSON）功能，展示 SDK 的完整应用场景。

**Architecture:** SDK Facade 新增数据访问方法（getOperations/getSnapshot/applyOperation），`@aw/playback` 独立消费操作序列驱动回放。图片导出通过 RenderAdapterInterface.exportAsBlob()，JSON 导出序列化操作序列。Playground 通过 Vue 组件组装这些能力。

**Tech Stack:** TypeScript, Vitest, Vue 3 Composition API, @aw/playback

---

## Task 1: RenderAdapterInterface 新增 exportAsBlob()

**Files:**
- Modify: `shared/types/src/render-adapter.types.ts`
- Modify: `libraries/core/src/render.adapter.ts`
- Modify: `libraries/render-canvas/src/canvas-render.adapter.ts`
- Test: `libraries/render-canvas/src/__tests__/canvas-render.adapter.spec.ts`（如已有则扩展，否则新建）

**Step 1: 接口新增 exportAsBlob 方法**

在 `shared/types/src/render-adapter.types.ts` 的 `RenderAdapterInterface` 中，`dispose()` 前新增：

```typescript
/** 导出当前渲染结果为 Blob */
exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob>
```

**Step 2: 抽象基类新增 abstract 声明**

在 `libraries/core/src/render.adapter.ts` 的 `RenderAdapter` 中，`abstract dispose()` 前新增：

```typescript
abstract exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob>
```

**Step 3: 写失败测试**

```typescript
// libraries/render-canvas/src/__tests__/canvas-render.adapter.spec.ts
describe('exportAsBlob', () => {
  it('应返回 image/png Blob', async () => {
    const adapter = new CanvasRenderAdapter()
    const container = document.createElement('div')
    adapter.attach(container, 200, 100)

    const blob = await adapter.exportAsBlob('png')

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
    adapter.dispose()
  })

  it('应支持 jpeg 格式', async () => {
    const adapter = new CanvasRenderAdapter()
    const container = document.createElement('div')
    adapter.attach(container, 200, 100)

    const blob = await adapter.exportAsBlob('jpeg', 0.8)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/jpeg')
    adapter.dispose()
  })

  it('未 attach 时应返回空 Blob', async () => {
    const adapter = new CanvasRenderAdapter()

    const blob = await adapter.exportAsBlob('png')

    expect(blob.size).toBe(0)
    adapter.dispose()
  })
})
```

**Step 4: 运行测试验证失败**

```bash
pnpm --filter @aw/render-canvas test -- --run
```

预期：FAIL — exportAsBlob 不存在

**Step 5: 实现 CanvasRenderAdapter.exportAsBlob()**

在 `libraries/render-canvas/src/canvas-render.adapter.ts` 的 `toDataURL()` 方法后新增：

```typescript
/**
 * 导出 render layer 为 Blob
 */
exportAsBlob(format: 'png' | 'jpeg' = 'png', quality?: number): Promise<Blob> {
  if (!this.layerManager) {
    return Promise.resolve(new Blob([], { type: `image/${format}` }))
  }
  const ctx = this.layerManager.getRenderContext()
  const canvas = ctx.canvas as HTMLCanvasElement
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  return new Promise(resolve => {
    canvas.toBlob(
      blob => resolve(blob ?? new Blob([], { type: mimeType })),
      mimeType,
      quality
    )
  })
}
```

**Step 6: 运行测试验证通过**

```bash
pnpm --filter @aw/render-canvas test -- --run
```

预期：PASS

**Step 7: 更新 mock（EditorKernel 测试用）**

在 `libraries/core/src/__tests__/editor-kernel.service.spec.ts` 的 `createMockDeps()` 中的 `renderAdapter` 对象添加：

```typescript
exportAsBlob: vi.fn(() => Promise.resolve(new Blob([], { type: 'image/png' }))),
```

**Step 8: 提交**

```bash
git add shared/types/src/render-adapter.types.ts libraries/core/src/render.adapter.ts libraries/render-canvas/src/canvas-render.adapter.ts libraries/core/src/__tests__/editor-kernel.service.spec.ts
git commit -m "feat: RenderAdapterInterface 新增 exportAsBlob() 方法"
```

---

## Task 2: EditorKernel 新增数据访问和操作回放方法

**Files:**
- Modify: `libraries/core/src/editor-kernel.service.ts`
- Test: `libraries/core/src/__tests__/editor-kernel.service.spec.ts`

**Step 1: 写 getSnapshot 失败测试**

```typescript
describe('getSnapshot', () => {
  it('应委托给 document.getSnapshot()', () => {
    const deps = createMockDeps()
    const expectedSnapshot = {
      strokes: new Map([['s1', { id: 's1', points: [], style: { type: 'pen' as const, color: '#000', width: 2, opacity: 1 }, createdAt: 0 }]]),
      strokeOrder: ['s1'],
      timestamp: 123
    }
    deps.document.getSnapshot.mockReturnValue(expectedSnapshot)
    const kernel = new EditorKernel(deps)

    const snapshot = kernel.getSnapshot()

    expect(snapshot).toBe(expectedSnapshot)
    expect(deps.document.getSnapshot).toHaveBeenCalled()
    kernel.dispose()
  })
})
```

**Step 2: 运行测试验证失败**

```bash
pnpm --filter @aw/core test -- --run -t "getSnapshot"
```

**Step 3: 实现 getSnapshot**

在 `EditorKernel` 类中 `get strokeCount()` 后新增：

```typescript
/** 获取文档快照 */
getSnapshot(): DocumentSnapshot {
  return this.deps.document.getSnapshot()
}
```

**Step 4: 验证通过，继续写 getOperations 测试**

```typescript
describe('getOperations', () => {
  it('应委托给 document.getOperations()', () => {
    const deps = createMockDeps()
    const ops = [{ type: 'stroke:clear', timestamp: 100 }]
    deps.document.getOperations.mockReturnValue(ops)
    const kernel = new EditorKernel(deps)

    const result = kernel.getOperations()

    expect(result).toBe(ops)
    kernel.dispose()
  })
})
```

**Step 5: 实现 getOperations**

```typescript
/** 获取全部操作记录 */
getOperations(): readonly unknown[] {
  return this.deps.document.getOperations()
}
```

**Step 6: 写 renderAdapter getter 测试**

```typescript
describe('renderAdapter', () => {
  it('应返回 deps 中的 renderAdapter 引用', () => {
    const deps = createMockDeps()
    const kernel = new EditorKernel(deps)

    expect(kernel.renderAdapter).toBe(deps.renderAdapter)
    kernel.dispose()
  })
})
```

**Step 7: 实现 renderAdapter getter**

```typescript
/** 暴露渲染适配器引用（用于图片导出） */
get renderAdapter(): RenderAdapterInterface {
  return this.deps.renderAdapter
}
```

**Step 8: 写 applyOperation 测试**

```typescript
describe('applyOperation', () => {
  it('stroke:start 应创建活跃笔画', () => {
    const deps = createMockDeps()
    const kernel = new EditorKernel(deps)
    const op = {
      type: 'stroke:start' as const,
      strokeId: 's1',
      style: { type: 'pen' as const, color: '#000', width: 2, opacity: 1 },
      point: { x: 10, y: 20, p: 0.5, t: 100 },
      timestamp: 100
    }

    kernel.applyOperation(op)

    expect(deps.document.apply).toHaveBeenCalledWith(op)
    kernel.dispose()
  })

  it('stroke:addPoint 应计算轮廓并渲染到 live layer', () => {
    const deps = createMockDeps()
    const kernel = new EditorKernel(deps)

    // 先 start
    kernel.applyOperation({
      type: 'stroke:start',
      strokeId: 's1',
      style: { type: 'pen' as const, color: '#000', width: 2, opacity: 1 },
      point: { x: 10, y: 20, p: 0.5, t: 100 },
      timestamp: 100
    })

    // 再 addPoint
    kernel.applyOperation({
      type: 'stroke:addPoint',
      strokeId: 's1',
      point: { x: 30, y: 40, p: 0.6, t: 150 }
    })

    expect(deps.strokeProcessor.computeOutline).toHaveBeenCalled()
    expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    expect(deps.renderAdapter.drawLiveStroke).toHaveBeenCalled()
    kernel.dispose()
  })

  it('stroke:end 应提交到持久层并发出事件', () => {
    const deps = createMockDeps()
    const kernel = new EditorKernel(deps)

    kernel.applyOperation({
      type: 'stroke:start',
      strokeId: 's1',
      style: { type: 'pen' as const, color: '#000', width: 2, opacity: 1 },
      point: { x: 10, y: 20, p: 0.5, t: 100 },
      timestamp: 100
    })
    kernel.applyOperation({
      type: 'stroke:end',
      strokeId: 's1',
      timestamp: 200
    })

    expect(deps.renderAdapter.commitStroke).toHaveBeenCalled()
    expect(deps.renderAdapter.clearLiveLayer).toHaveBeenCalled()
    expect(deps.eventBus.emit).toHaveBeenCalledWith('document:changed', expect.anything())
    kernel.dispose()
  })

  it('stroke:clear 应清除所有渲染', () => {
    const deps = createMockDeps()
    const kernel = new EditorKernel(deps)

    kernel.applyOperation({ type: 'stroke:clear', timestamp: 100 })

    expect(deps.document.apply).toHaveBeenCalled()
    expect(deps.renderAdapter.clearAll).toHaveBeenCalled()
    kernel.dispose()
  })

  it('stroke:delete 应重绘快照', () => {
    const deps = createMockDeps()
    const kernel = new EditorKernel(deps)

    kernel.applyOperation({
      type: 'stroke:delete',
      strokeIds: ['s1'],
      timestamp: 100
    })

    expect(deps.document.apply).toHaveBeenCalled()
    expect(deps.renderAdapter.redrawAll).toHaveBeenCalled()
    kernel.dispose()
  })
})
```

**Step 9: 实现 applyOperation**

在 EditorKernel 类中新增，放在 `clear()` 方法之后：

```typescript
/**
 * 应用单个操作并渲染
 * 用于外部回放驱动，不经过输入事件
 */
applyOperation(op: Operation): void {
  if (this.disposed) return

  this.deps.document.apply(op)

  switch (op.type) {
    case 'stroke:start':
      this.activeStrokeId = op.strokeId
      this.activePoints = [op.point]
      // 保存操作自带的样式（回放时使用原始样式）
      this._penStyle = { ...op.style }
      break

    case 'stroke:addPoint':
      if (!this.activeStrokeId) break
      this.activePoints.push(op.point)
      {
        const outline = this.deps.strokeProcessor.computeOutline(
          this.activePoints, this._penStyle, false
        )
        if (outline) {
          this.deps.renderAdapter.clearLiveLayer()
          this.deps.renderAdapter.drawLiveStroke(outline, this._penStyle)
        }
      }
      break

    case 'stroke:end': {
      const outline = this.deps.strokeProcessor.computeOutline(
        this.activePoints, this._penStyle, true
      )
      if (outline) {
        this.deps.renderAdapter.commitStroke(outline, this._penStyle)
      }
      this.deps.renderAdapter.clearLiveLayer()
      this.activeStrokeId = null
      this.activePoints = []
      this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
      break
    }

    case 'stroke:delete':
      this.redrawFromSnapshot()
      this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
      break

    case 'stroke:clear':
      this.deps.renderAdapter.clearAll()
      this.deps.eventBus.emit('document:changed', this.deps.document.getSnapshot())
      break
  }
}
```

注意：需要在文件顶部导入 `Operation` 类型：
```typescript
import type { ..., Operation } from '@aw/types'
```

**Step 10: 运行全部测试**

```bash
pnpm --filter @aw/core test -- --run
```

预期：全部 PASS

**Step 11: 提交**

```bash
git add libraries/core/src/editor-kernel.service.ts libraries/core/src/__tests__/editor-kernel.service.spec.ts
git commit -m "feat: EditorKernel 新增 getSnapshot/getOperations/applyOperation/renderAdapter"
```

---

## Task 3: AnimalWriting Facade 新增公共 API

**Files:**
- Modify: `libraries/sdk/src/animal-writing.facade.ts`
- Test: `libraries/sdk/src/__tests__/animal-writing.facade.spec.ts`

**Step 1: 写失败测试**

在 facade spec 文件中新增以下 describe 块：

```typescript
// ===== 新增 API =====

describe('getSnapshot', () => {
  it('应返回文档快照', () => {
    const editor = createEditor()

    const snapshot = editor.getSnapshot()

    expect(snapshot).toBeDefined()
    expect(snapshot.strokes).toBeInstanceOf(Map)
    expect(snapshot.strokeOrder).toBeInstanceOf(Array)
    editor.dispose()
  })
})

describe('getOperations', () => {
  it('应返回操作数组', () => {
    const editor = createEditor()

    const ops = editor.getOperations()

    expect(Array.isArray(ops)).toBe(true)
    editor.dispose()
  })
})

describe('renderAdapter', () => {
  it('应返回渲染适配器引用', () => {
    const editor = createEditor()

    const adapter = editor.renderAdapter

    expect(adapter).toBeDefined()
    expect(typeof adapter.exportAsBlob).toBe('function')
    editor.dispose()
  })
})

describe('applyOperation', () => {
  it('应可调用而不抛出错误', () => {
    const editor = createEditor()

    expect(() => editor.applyOperation({
      type: 'stroke:clear',
      timestamp: Date.now()
    })).not.toThrow()
    editor.dispose()
  })
})
```

**Step 2: 运行测试验证失败**

```bash
pnpm --filter @aw/sdk test -- --run
```

**Step 3: 实现 Facade 新方法**

在 `animal-writing.facade.ts` 中，`clear()` 方法后新增：

```typescript
// ===== 数据访问 API =====

/** 获取文档快照 */
getSnapshot(): DocumentSnapshot {
  if (!this.kernel) throw new Error('Editor has been disposed')
  return this.kernel.getSnapshot()
}

/** 获取全部操作记录 */
getOperations(): Operation[] {
  if (!this.kernel) throw new Error('Editor has been disposed')
  return this.kernel.getOperations() as Operation[]
}

/** 获取渲染适配器引用（用于图片导出） */
get renderAdapter(): RenderAdapterInterface {
  if (!this.kernel) throw new Error('Editor has been disposed')
  return this.kernel.renderAdapter
}

/** 应用单个操作（用于回放驱动） */
applyOperation(op: Operation): void {
  if (!this.kernel) throw new Error('Editor has been disposed')
  this.kernel.applyOperation(op)
}
```

更新顶部导入：

```typescript
import type { StrokeStyle, EditorOptions, Camera, Operation, DocumentSnapshot, RenderAdapterInterface } from '@aw/types'
```

**Step 4: 运行测试验证通过**

```bash
pnpm --filter @aw/sdk test -- --run
```

**Step 5: 提交**

```bash
git add libraries/sdk/src/animal-writing.facade.ts libraries/sdk/src/__tests__/animal-writing.facade.spec.ts
git commit -m "feat: AnimalWriting Facade 新增 getSnapshot/getOperations/applyOperation/renderAdapter"
```

---

## Task 4: @aw/model 新增操作序列化工具

**Files:**
- Create: `libraries/model/src/operation-serializer.service.ts`
- Create: `libraries/model/src/__tests__/operation-serializer.spec.ts`
- Modify: `libraries/model/src/index.ts`

**Step 1: 写失败测试**

```typescript
// libraries/model/src/__tests__/operation-serializer.spec.ts
import { describe, it, expect } from 'vitest'
import { operationsToJSON, jsonToOperations } from '../operation-serializer.service'
import type { Operation } from '@aw/types'

describe('operationsToJSON', () => {
  it('应将操作序列序列化为 JSON 字符串', () => {
    const ops: Operation[] = [
      {
        type: 'stroke:start',
        strokeId: 's1',
        style: { type: 'pen', color: '#000', width: 2, opacity: 1 },
        point: { x: 10, y: 20, p: 0.5, t: 100 },
        timestamp: 100
      },
      {
        type: 'stroke:addPoint',
        strokeId: 's1',
        point: { x: 30, y: 40, p: 0.6, t: 150 }
      },
      {
        type: 'stroke:end',
        strokeId: 's1',
        timestamp: 200
      }
    ]

    const json = operationsToJSON(ops, { width: 800, height: 600 })

    const parsed = JSON.parse(json)
    expect(parsed.version).toBe('1.0')
    expect(parsed.documentSize).toEqual({ width: 800, height: 600 })
    expect(parsed.operations).toHaveLength(3)
    expect(parsed.operations[0].type).toBe('stroke:start')
  })
})

describe('jsonToOperations', () => {
  it('应将 JSON 反序列化为操作序列', () => {
    const original: Operation[] = [
      {
        type: 'stroke:start',
        strokeId: 's1',
        style: { type: 'pen', color: '#ff0000', width: 3, opacity: 0.8 },
        point: { x: 50, y: 60, p: 0.7, t: 500 },
        timestamp: 500
      },
      {
        type: 'stroke:end',
        strokeId: 's1',
        timestamp: 600
      }
    ]

    const json = operationsToJSON(original, { width: 1920, height: 1080 })
    const result = jsonToOperations(json)

    expect(result.operations).toEqual(original)
    expect(result.documentSize).toEqual({ width: 1920, height: 1080 })
  })

  it('无效 JSON 应抛出错误', () => {
    expect(() => jsonToOperations('invalid')).toThrow()
  })

  it('版本不匹配应抛出错误', () => {
    const json = JSON.stringify({ version: '99.0', documentSize: { width: 100, height: 100 }, operations: [] })
    expect(() => jsonToOperations(json)).toThrow()
  })
})
```

**Step 2: 运行测试验证失败**

```bash
pnpm --filter @aw/model test -- --run -t "operationsToJSON"
```

**Step 3: 实现 operation-serializer**

```typescript
// libraries/model/src/operation-serializer.service.ts
import type { Operation, Size } from '@aw/types'

/** 导出数据格式 */
interface ExportData {
  version: string
  documentSize: Size
  operations: Operation[]
}

const CURRENT_VERSION = '1.0'

/**
 * 将操作序列序列化为 JSON 字符串
 * 坐标使用绝对世界坐标，附带 documentSize 元数据
 */
export function operationsToJSON(
  operations: readonly Operation[],
  documentSize: Size
): string {
  const data: ExportData = {
    version: CURRENT_VERSION,
    documentSize,
    operations: operations as Operation[]
  }
  return JSON.stringify(data)
}

/**
 * 将 JSON 字符串反序列化为操作序列
 */
export function jsonToOperations(json: string): {
  operations: Operation[]
  documentSize: Size
} {
  const data = JSON.parse(json) as ExportData
  if (!data.version || !data.version.startsWith('1.')) {
    throw new Error(`不支持的版本: ${data.version}`)
  }
  return {
    operations: data.operations,
    documentSize: data.documentSize
  }
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm --filter @aw/model test -- --run
```

**Step 5: 在 index.ts 中导出**

在 `libraries/model/src/index.ts` 末尾追加：

```typescript
export { operationsToJSON, jsonToOperations } from './operation-serializer.service'
```

**Step 6: 提交**

```bash
git add libraries/model/src/operation-serializer.service.ts libraries/model/src/__tests__/operation-serializer.spec.ts libraries/model/src/index.ts
git commit -m "feat: @aw/model 新增操作序列 JSON 序列化/反序列化工具"
```

---

## Task 5: Playground — PlaybackPanel 组件

**Files:**
- Create: `playground/app/src/components/PlaybackPanel.vue`
- Modify: `playground/app/src/composables/useEditor.ts`
- Modify: `playground/app/src/App.vue`

**Step 1: 在 useEditor.ts 中新增回放状态和方法**

在 `useEditor.ts` 中新增导入和回放逻辑：

```typescript
// 文件顶部新增导入
import { StrokePlayer } from '@aw/playback'
import type { Operation } from '@aw/types'
```

在 `useEditor()` 函数体内新增：

```typescript
// 回放状态
const isPlaying = ref(false)
const playbackProgress = ref(0)
const playbackSpeed = ref(1)
let player: StrokePlayer | null = null
let progressTimer: ReturnType<typeof setInterval> | null = null

/** 开始回放 */
function playbackStart() {
  if (!editor.value) return
  const ops = editor.value.getOperations() as Operation[]
  if (ops.length === 0) return

  // 清空画布，准备回放
  editor.value.clear()

  player = new StrokePlayer(ops, { speed: playbackSpeed.value })
  player.onOperation = op => {
    editor.value?.applyOperation(op)
  }
  player.onFinish = () => {
    isPlaying.value = false
    stopProgressSync()
  }

  isPlaying.value = true
  playbackProgress.value = 0
  player.play()
  startProgressSync()
}

/** 停止回放 */
function playbackStop() {
  if (player) {
    player.stop()
    player.dispose()
    player = null
  }
  isPlaying.value = false
  playbackProgress.value = 0
  stopProgressSync()
}

/** 设置回放速度 */
function setPlaybackSpeed(speed: number) {
  playbackSpeed.value = speed
  if (player) {
    player.speed = speed
  }
}

/** 同步进度到响应式状态 */
function startProgressSync() {
  stopProgressSync()
  progressTimer = setInterval(() => {
    if (player) {
      playbackProgress.value = player.progress
    }
  }, 50)
}

function stopProgressSync() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}
```

在 `dispose()` 中追加清理：

```typescript
// 在 dispose() 函数体内、editor.value?.dispose() 之前
playbackStop()
```

在 return 中追加导出：

```typescript
isPlaying,
playbackProgress,
playbackSpeed,
playbackStart,
playbackStop,
setPlaybackSpeed,
```

**Step 2: 创建 PlaybackPanel.vue**

```vue
<!-- playground/app/src/components/PlaybackPanel.vue -->
<script setup lang="ts">
defineProps<{
  isPlaying: boolean
  progress: number
  speed: number
}>()

const emit = defineEmits<{
  play: []
  stop: []
  setSpeed: [speed: number]
}>()

const speeds = [0.5, 1, 2]

function formatProgress(p: number): string {
  return Math.round(p * 100) + '%'
}
</script>

<template>
  <div class="playback-section">
    <div class="section-title">回放</div>
    <div class="progress-bar">
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: formatProgress(progress) }" />
      </div>
      <span class="progress-text">{{ formatProgress(progress) }}</span>
    </div>
    <div class="playback-controls">
      <button
        v-if="!isPlaying"
        class="action-btn"
        @click="emit('play')"
      >
        播放
      </button>
      <button
        v-else
        class="action-btn danger"
        @click="emit('stop')"
      >
        停止
      </button>
    </div>
    <div class="speed-row">
      <span class="speed-label">速度</span>
      <button
        v-for="s in speeds"
        :key="s"
        :class="['speed-btn', { active: speed === s }]"
        @click="emit('setSpeed', s)"
      >
        {{ s }}x
      </button>
    </div>
  </div>
</template>

<style scoped>
.playback-section {
  margin-bottom: 16px;
}
.section-title {
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.progress-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.progress-track {
  flex: 1;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #333;
  border-radius: 2px;
  transition: width 0.1s;
}
.progress-text {
  font-size: 11px;
  color: #999;
  min-width: 32px;
  text-align: right;
}
.playback-controls {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}
.action-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 13px;
  text-align: center;
  transition: all 0.15s;
}
.action-btn:hover {
  background: #f5f5f5;
}
.action-btn.danger:hover {
  background: #fee;
  border-color: #fcc;
  color: #c33;
}
.speed-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.speed-label {
  font-size: 12px;
  color: #999;
  margin-right: 4px;
}
.speed-btn {
  padding: 4px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}
.speed-btn:hover {
  background: #f5f5f5;
}
.speed-btn.active {
  background: #333;
  color: #fff;
  border-color: #333;
}
</style>
```

**Step 3: 在 App.vue 中集成**

导入 PlaybackPanel：

```typescript
import PlaybackPanel from './components/PlaybackPanel.vue'
```

从 useEditor 解构新增的回放属性：

```typescript
const {
  // ... 已有 ...
  isPlaying,
  playbackProgress,
  playbackSpeed,
  playbackStart,
  playbackStop,
  setPlaybackSpeed,
  // ...
} = useEditor()
```

在 template 的 sidebar 中，ZoomPanel 之后、StatusBar 之前放置：

```html
<PlaybackPanel
  :is-playing="isPlaying"
  :progress="playbackProgress"
  :speed="playbackSpeed"
  @play="playbackStart"
  @stop="playbackStop"
  @set-speed="setPlaybackSpeed"
/>
```

**Step 4: 提交**

```bash
git add playground/app/src/components/PlaybackPanel.vue playground/app/src/composables/useEditor.ts playground/app/src/App.vue
git commit -m "feat: playground 添加笔迹回放面板"
```

---

## Task 6: Playground — ExportPanel 组件

**Files:**
- Create: `playground/app/src/components/ExportPanel.vue`
- Modify: `playground/app/src/composables/useEditor.ts`
- Modify: `playground/app/src/App.vue`

**Step 1: 在 useEditor.ts 中新增导出方法**

新增导入：

```typescript
import { operationsToJSON, jsonToOperations } from '@aw/model'
```

在 useEditor() 函数体内新增：

```typescript
/** 导出 PNG */
async function exportPNG() {
  if (!editor.value) return
  const blob = await editor.value.renderAdapter.exportAsBlob('png')
  downloadBlob(blob, 'drawing.png')
}

/** 导出 JSON */
function exportJSON() {
  if (!editor.value) return
  const ops = editor.value.getOperations()
  // documentSize 取容器尺寸
  const size = { width: containerEl?.clientWidth ?? 800, height: containerEl?.clientHeight ?? 600 }
  const json = operationsToJSON(ops, size)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, 'drawing.json')
}

/** 导入 JSON */
function importJSON(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    if (!editor.value || typeof reader.result !== 'string') return
    const { operations } = jsonToOperations(reader.result)
    // 清空并重建
    editor.value.clear()
    for (const op of operations) {
      editor.value.applyOperation(op)
    }
  }
  reader.readAsText(file)
}

/** 浏览器下载 Blob */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

在 return 中追加：

```typescript
exportPNG,
exportJSON,
importJSON,
```

**Step 2: 创建 ExportPanel.vue**

```vue
<!-- playground/app/src/components/ExportPanel.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  exportPNG: []
  exportJSON: []
  importJSON: [file: File]
}>()

const fileInput = ref<HTMLInputElement>()

function handleFileSelect() {
  fileInput.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('importJSON', file)
    input.value = ''
  }
}
</script>

<template>
  <div class="export-section">
    <div class="section-title">导入/导出</div>
    <div class="export-buttons">
      <button class="action-btn" @click="emit('exportPNG')">导出 PNG</button>
      <button class="action-btn" @click="emit('exportJSON')">导出 JSON</button>
    </div>
    <button class="action-btn import-btn" @click="handleFileSelect">导入 JSON</button>
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.export-section {
  margin-bottom: 16px;
}
.section-title {
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.export-buttons {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}
.action-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 13px;
  text-align: center;
  transition: all 0.15s;
}
.action-btn:hover {
  background: #f5f5f5;
}
.import-btn {
  width: 100%;
}
</style>
```

**Step 3: 在 App.vue 中集成**

导入 ExportPanel：

```typescript
import ExportPanel from './components/ExportPanel.vue'
```

从 useEditor 解构新增属性：

```typescript
const {
  // ... 已有 ...
  exportPNG,
  exportJSON,
  importJSON,
  // ...
} = useEditor()
```

在 template 的 sidebar 中，PlaybackPanel 之后、StatusBar 之前放置：

```html
<ExportPanel
  @export-p-n-g="exportPNG"
  @export-j-s-o-n="exportJSON"
  @import-j-s-o-n="importJSON"
/>
```

注意：Vue 3 事件名会自动 kebab-case 转换，`exportPNG` → `export-p-n-g`。如果这个转换不便，可以改用小写事件名：

```typescript
// ExportPanel.vue emit 定义改为：
const emit = defineEmits<{
  'export-png': []
  'export-json': []
  'import-json': [file: File]
}>()

// 触发时：
emit('export-png')
emit('export-json')
emit('import-json', file)
```

App.vue 中对应改为：
```html
<ExportPanel
  @export-png="exportPNG"
  @export-json="exportJSON"
  @import-json="importJSON"
/>
```

**Step 4: 提交**

```bash
git add playground/app/src/components/ExportPanel.vue playground/app/src/composables/useEditor.ts playground/app/src/App.vue
git commit -m "feat: playground 添加导出面板（PNG/JSON 导出 + JSON 导入）"
```

---

## Task 7: 构建验证 + 文档更新

**Files:**
- Run: 全量构建和类型检查
- Modify: `CLAUDE.md`（如有架构变化）

**Step 1: 运行全量测试**

```bash
pnpm -r test -- --run
```

预期：全部 PASS

**Step 2: 运行构建**

```bash
pnpm run build
```

预期：构建成功

**Step 3: 启动 playground 手动验证**

```bash
pnpm --filter playground dev
```

验证清单：
- [ ] 画几笔 → 点击"播放" → 笔画逐步重绘
- [ ] 回放中显示进度百分比
- [ ] 速度按钮切换正常（0.5x / 1x / 2x）
- [ ] 点击"停止"结束回放
- [ ] 点击"导出 PNG" → 下载 drawing.png
- [ ] 点击"导出 JSON" → 下载 drawing.json
- [ ] 点击"导入 JSON" → 选择文件 → 画布恢复

**Step 4: 更新 CLAUDE.md 中的公共 API 描述**

在 CLAUDE.md 的「公共 API」部分追加新增方法的说明。

**Step 5: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: 更新 CLAUDE.md 反映新增的回放和导出 API"
```

---

## 依赖关系

```
Task 1 (exportAsBlob) ──┐
                         ├── Task 6 (ExportPanel) ──┐
Task 4 (JSON序列化) ─────┘                           │
                                                     ├── Task 7 (验证)
Task 2 (EditorKernel) ── Task 3 (Facade) ── Task 5 (PlaybackPanel) ──┘
```

可并行：Task 1 + Task 2 + Task 4（无依赖关系）
