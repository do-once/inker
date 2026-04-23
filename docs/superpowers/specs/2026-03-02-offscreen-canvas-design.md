# OffscreenCanvas 渲染架构设计

## 设计目标

将计算密集型的笔画轮廓计算（computeOutline）和 Canvas 渲染从主线程转移到 Worker 线程，释放 UI 响应性。同时统一多渲染器架构（OffscreenCanvas / Canvas 2D / SVG），支持可插拔切换。

## 决策记录

| 决策点 | 结论 | 理由 |
|--------|------|------|
| Worker 转移范围 | 计算 + 渲染 | Path2D 留在 Worker 内部，无需跨线程序列化 |
| Canvas 转移 | 两个都 transferControlToOffscreen | 统一管理，避免主线程和 Worker 同时操作 Canvas |
| 橡皮擦轨迹 | 一起转入 Worker | Worker 内 OffscreenCanvas 支持 rAF |
| 导出功能 | Worker 内 convertToBlob | async 返回 Blob |
| 计算输出格式 | OutlineGeometry（通用几何） | 解耦计算和渲染，支持多渲染器 |
| 异步模型 | 混合 + flush 屏障 | 热路径零开销，需要时显式同步 |
| 通信协议 | 独立包 @aw/render-protocol | 消息类型 + WorkerBridge 传输抽象（方案二） |

## 架构总览

```
┌─────────────────────────────────────┐
│              主线程                  │
│                                     │
│  PointerInputAdapter                │
│       ↓                             │
│  EditorKernel                       │
│   ├─ screenToWorld (坐标变换)        │
│   ├─ document.apply(op) (模型操作)   │
│   └─ renderAdapter.drawLiveStroke()  │
│              ↓                      │
│  ┌───────────────────────────────┐  │
│  │     RenderAdapterInterface    │  │
│  │  (统一接口，EditorKernel 无感) │  │
│  └───────┬───────────┬───────────┘  │
│          │           │              │
│  ┌───────┴──┐  ┌─────┴────────┐    │
│  │ Canvas2D │  │ SVG Adapter  │    │
│  │ Adapter  │  │ (主线程DOM)   │    │
│  │(主线程)   │  └──────────────┘    │
│  └──────────┘                       │
│          │                          │
│  ┌───────┴──────────┐               │
│  │ Offscreen Adapter │              │
│  │  (主线程 proxy)   │              │
│  │  └─ WorkerBridge  │              │
│  └────────┬─────────┘               │
└───────────┼─────────────────────────┘
            │ postMessage (RenderCommand)
            ↓
┌───────────────────────────────────────┐
│             Worker 线程                │
│                                       │
│  WorkerBridge (收指令)                 │
│       ↓                               │
│  StrokeProcessor.computeOutline()     │
│       ↓ OutlineGeometry               │
│  Path2D 构建 + OffscreenCanvas 绘制   │
│   ├─ liveCanvas (实时笔画)             │
│   └─ renderCanvas (已完成笔画)         │
│                                       │
│  EraserTrail (rAF 衰减动画)            │
│  convertToBlob() (导出)               │
│       │                               │
└───────┼───────────────────────────────┘
        │ postMessage (RenderResponse)
        ↓
   主线程 Promise resolve
```

## 核心设计

### 1. 计算输出格式：OutlineGeometry

`StrokeProcessor.computeOutline` 的返回值从 `Path2D | null` 改为通用几何数据：

```typescript
// @aw/types
interface OutlineGeometry {
  /** 轮廓多边形顶点（闭合路径） */
  points: readonly Point[]
}

// StrokeProcessorInterface 变更
computeOutline(
  points: readonly StrokePoint[],
  style: StrokeStyle,
  complete: boolean
): OutlineGeometry | null
```

各渲染器自行转换为原生格式：

- Canvas / OffscreenCanvas：`OutlineGeometry → Path2D → ctx.fill()`
- SVG：`OutlineGeometry → <path d="M...Z"> → DOM`

### 2. RenderAdapterInterface 重构

```typescript
interface RenderAdapterInterface {
  // 生命周期
  attach(element: HTMLElement, width: number, height: number): void
  detach(): void
  dispose(): void
  resize(width: number, height: number): void

  // 绘制命令（fire-and-forget）
  drawLiveStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  drawEraserTrail(points: readonly StrokePoint[], style: EraserStyle): void
  commitStroke(points: readonly StrokePoint[], style: StrokeStyle): void
  clearLiveLayer(): void
  redrawAll(strokes: readonly StrokeData[]): void
  clearAll(): void
  setCamera(camera: Camera): void

  // 同步屏障
  flush(): Promise<void>

  // 数据返回（async）
  exportAsBlob(format: 'png' | 'jpeg', quality?: number): Promise<Blob>
  toDataURL(): Promise<string>
}
```

**关键变化：**

- draw 方法接收 `StrokePoint[]` 而非 `Path2D`，计算职责内聚到适配器内部
- 新增 `flush(): Promise<void>` 作为同步屏障
- EditorKernel 只发"意图"（画这些点），不关心计算和渲染细节

### 3. 异步模型：混合 + flush 屏障

- **绘制命令**：fire-and-forget（void），主线程发完立即返回
- **flush()**：显式同步屏障，发送哨兵消息等 Worker 处理完所有先前指令后回复
- **数据返回**：async（exportAsBlob 内部自动 flush）

各适配器的 flush 实现：

| 适配器 | flush() |
|--------|---------|
| CanvasRenderAdapter | `Promise.resolve()` — 同步渲染，无需等待 |
| SvgRenderAdapter | `Promise.resolve()` — 同步渲染 |
| OffscreenRenderAdapter | 发哨兵消息等 Worker 回复 |

flush 解决的问题：Worker 内部可能有 rAF 延迟渲染（如 EraserTrail），flush 强制清空待渲染队列后再继续。

### 4. 通信协议包 @aw/render-protocol

采用方案二：消息类型定义 + 传输桥抽象。

```typescript
// 消息类型
type RenderCommand =
  | { cmd: 'drawLive'; points: StrokePoint[]; style: StrokeStyle }
  | { cmd: 'commit'; points: StrokePoint[]; style: StrokeStyle }
  | { cmd: 'drawEraserTrail'; points: StrokePoint[]; style: EraserStyle }
  | { cmd: 'clearLive' }
  | { cmd: 'redrawAll'; strokes: StrokeData[] }
  | { cmd: 'clearAll' }
  | { cmd: 'setCamera'; camera: Camera }
  | { cmd: 'flush'; id: number }
  | { cmd: 'export'; id: number; format: string; quality?: number }
  | { cmd: 'toDataURL'; id: number }

type RenderResponse =
  | { cmd: 'flushed'; id: number }
  | { cmd: 'exported'; id: number; blob: Blob }
  | { cmd: 'dataURL'; id: number; url: string }

// 传输桥
class WorkerBridge {
  constructor(worker: Worker)
  send(cmd: RenderCommand): void           // fire-and-forget
  request(cmd: RenderCommand): Promise<RenderResponse>  // request-response
  onMessage(handler: (cmd: RenderCommand) => void): void  // Worker 端监听
}
```

职责边界：

- 类型是契约——定义两端通信格式
- Bridge 是管道——封装传输细节，可替换（postMessage / MessageChannel / SharedArrayBuffer）
- 适配器是消费者——只关心"发什么"和"收什么"

### 5. 可插拔渲染器

EditorKernel 通过 RenderAdapterInterface 统一调用，不感知底层实现：

| 适配器 | compute 位置 | render 位置 | 通信方式 |
|--------|-------------|------------|---------|
| CanvasRenderAdapter | 主线程同步 | 主线程同步 | 直接调用 |
| SvgRenderAdapter | 主线程同步 | 主线程 DOM | 直接调用 |
| OffscreenRenderAdapter | Worker 内 | Worker 内 | WorkerBridge |

## 包职责与变更

| 包 | 变更 |
|----|------|
| `@aw/types` | 新增 OutlineGeometry；StrokeProcessorInterface 返回值变更；RenderAdapterInterface 重构 |
| `@aw/render-protocol` | 【新包】消息类型 + WorkerBridge |
| `@aw/brush-freehand` | computeOutline 返回 OutlineGeometry（不再构建 Path2D） |
| `@aw/render-canvas` | 接收 StrokePoint[]，内部 compute → OutlineGeometry → Path2D → 绘制；flush = Promise.resolve() |
| `@aw/render-svg` | 接收 StrokePoint[]，内部 compute → OutlineGeometry → SVG path → DOM |
| `@aw/render-offscreen` | 【实现】主线程 proxy + Worker 端渲染器 |
| `@aw/compute-worker` | 可能废弃或合并（计算职责已内聚到各 RenderAdapter） |
| `@aw/core` | EditorKernel 简化：不再直接调 strokeProcessor，只调 renderAdapter 意图式 API |

## 数据流

### OffscreenCanvas 路径

```
pointerMove → screenToWorld → document.apply()
           → renderAdapter.drawLiveStroke(points, style)  // fire-and-forget
                    ↓ WorkerBridge.send()
             Worker: computeOutline(points) → OutlineGeometry → Path2D → ctx.fill()
```

### Canvas 2D / SVG 主线程路径

```
pointerMove → screenToWorld → document.apply()
           → renderAdapter.drawLiveStroke(points, style)
             内部同步: computeOutline(points) → OutlineGeometry → Path2D/SVG → 绘制
```
