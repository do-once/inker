# 识别调试页面设计规格

## 背景

`@inker/recognition` 包已完整实现（`groupByTime`、`translateToOrigin`、`SimpleJsonFormat`、`RecognitionHelper`），但 playground 中的识别调试场景仍为占位组件。需要将其完善为一个集成示例，展示这些 API 在真实业务流程中如何串联使用。

## 定位

数据采集与集成验证工具——展示 `@inker/recognition` 的自动触发和手动导出两种使用模式，验证分组、坐标平移、JSON 导出等功能的正确性。

## 整体布局

采用**画布主导 2:1 布局**：

- 左侧（2/3）：Inker 书写区 + 顶栏 + 状态栏
- 右侧（1/3）：数据面板，tab 切换展示分组概览和 JSON 数据

## 数据流

**自动模式**：`RecognitionHelper` 内部监听 `stroke:end`，停顿后自动调用 `groupByTime`，将最新一组 `StrokeGroup` 通过 `onWritingComplete(callback)` 回传。callback 接收**单个 `StrokeGroup`**（非全量），composable 将其**追加**到 `groups` 数组，并用 `SimpleJsonFormat` 重新转换全量 `groups` 生成 JSON。

**手动模式**：用户点击"导出"按钮 → `inker.getSnapshot()` 获取全量快照 → `groupByTime` 对全量笔画重新分组 → **替换**整个 `groups` 数组 → `SimpleJsonFormat` 生成 JSON。

```
用户书写
  │
  ├─ 自动模式 ──→ RecognitionHelper.bindTo(inker)
  │                  └─ 停顿触发 onWritingComplete(group: StrokeGroup)
  │                       └─ groups.push(group)  // 追加单组
  │                            └─ SimpleJsonFormat.convert(groups) → jsonResult
  │
  └─ 手动模式 ──→ 用户点击"导出"按钮
                     └─ inker.getSnapshot() → groupByTime(全量)
                          └─ groups = allGroups  // 替换全量
                               └─ SimpleJsonFormat.convert(groups) → jsonResult
```

**两种模式并存时**：自动触发的追加结果与手动触发的全量结果可能不一致。手动导出会重新对全量笔画分组，覆盖之前自动追加的结果，这是预期行为——手动导出相当于"刷新"。

## 组件设计

### 文件结构

```
playground/app/src/scenes/recognition/
├── RecognitionScene.vue          # 修改：从占位组件改为完整布局
├── useRecognitionEditor.ts       # 新增：Inker + RecognitionHelper 集成逻辑
├── RecognitionDataPanel.vue      # 新增：右侧数据面板
└── config.ts                     # 修改：panels 配置中添加 'recognition' 面板
```

### RecognitionScene.vue

场景壳组件，组装整体布局：

- 左侧画布区：Inker 编辑器 + 顶栏（模式切换）+ 底部状态栏
- 右侧数据面板：`RecognitionDataPanel` 组件
- 浮动面板：复用已有的 `FloatingPanel`，包含样式面板、笔刷参数面板、识别参数面板

### useRecognitionEditor.ts

Composition API composable，职责：

- 创建 Inker 实例（复用已有 `useEditor` 模式）
- 管理 RecognitionHelper 生命周期（创建、绑定、dispose）
- 暴露响应式状态：
  - `groups: Ref<StrokeGroup[]>` — 当前分组结果
  - `jsonResult: Ref<string>` — SimpleJsonFormat 转换后的 JSON 字符串
  - `status: Ref<'idle' | 'writing' | 'paused' | 'triggered'>` — 当前状态
- 暴露方法：
  - `manualExport()` — 手动触发导出
  - `clearAll()` — 清空分组数据和画布笔画
  - `rebindHelper()` — `gapMs` 参数变化时重新绑定 RecognitionHelper（因为 gapMs 是构造参数，需重建实例）。重建时先 dispose 旧实例，再创建新实例。新实例的 `processedStrokeIds` 为空，但不会引发重复触发——因为旧实例已处理过的笔画已经追加到 `groups` 中，新实例只会处理后续新增的笔画
- 接收参数（响应式）：
  - `gapMs: Ref<number>` — 分组间隔阈值（默认 500）。**注意**：`RecognitionHelper` 构造函数只接受一个 `gapMs` 参数，同时用于停顿判定定时器（`setTimeout`）和分组间隔（`groupByTime`），两者共享同一个值
  - `translateEnabled: Ref<boolean>` — 是否调用 translateToOrigin（默认开）
  - `includeBoundingBox: Ref<boolean>` — 是否在导出结果中包含包围盒字段（默认开），对应 `ExportFormatOptions.boundingBox`

**注意**：`translateEnabled` 控制的是导出前调用 `translateToOrigin()` 对笔画坐标做平移；`includeBoundingBox` 控制的是导出结果中是否附带 `boundingBox` 字段。两者独立，不会双重平移——调用 `SimpleJsonFormat.convert()` 时**始终不传 `{ boundingBox: true }`**（因为 SimpleJsonFormat 内部在 `boundingBox: true` 时也会做坐标平移，会与 `translateToOrigin` 重复）。包围盒字段由 composable 在转换后手动附加到输出 JSON 中。

**包围盒坐标系一致性**：当 `translateEnabled=true` 且 `includeBoundingBox=true` 时，输出的点坐标已平移到原点，此时附加的包围盒应为 `{ minX: 0, minY: 0, width, height }`（与平移后的坐标系一致），而非原始世界坐标的包围盒。composable 应从平移后的笔画重新计算包围盒，或直接取原始包围盒的 `width`/`height` 构造零偏移包围盒。

### RecognitionDataPanel.vue

右侧数据面板，结构：

**Tab 栏**：分组概览 | JSON 数据，右侧放置操作按钮（复制、下载、清空）

**分组概览 Tab**：
- 顶部摘要：共 N 组 · M 笔画 · 最后更新时间
- 卡片列表：每组显示笔画数、时间范围（startTime ~ endTime）、包围盒尺寸（width × height）
- 每组卡片左侧用不同颜色竖线区分
- 点击某组 → emit `highlight-group(index)` → 画布上叠加半透明虚线矩形高亮该组 boundingBox

**JSON 数据 Tab**：
- 显示 SimpleJsonFormat 转换后的完整 JSON
- 简单正则语法着色（字符串、数字、key 用不同颜色），不引入第三方库
- 可滚动

**操作按钮**（两个 tab 共享）：
- 复制：将当前 JSON 复制到剪贴板
- 下载：下载为 `recognition-export.json` 文件
- 清空：emit `clear-all` → 清空分组数据 + 画布笔画

Props：`groups: StrokeGroup[]`、`jsonResult: string`
Emits：`highlight-group(index: number)`、`clear-all`

## 画布交互

### 顶栏

- 左侧：场景标题
- 右侧：自动/手动模式切换按钮（两者可同时启用）+ 手动模式下的"导出"按钮

### 底部状态栏

实时显示当前状态：

| 状态 | 显示 | 驱动机制 |
|---|---|---|
| 空闲 | `● 空闲`（无笔画） | `strokeCount === 0` |
| 书写中 | `● 书写中`（有活跃笔画会话） | 监听 `stroke:start` 事件置为 writing |
| 已停顿 | `● 已停顿 (等待中...)`（停顿计时器运行中） | 监听 `stroke:end` 事件后启动本地定时器（与 Helper 同步的 gapMs），定时器运行期间为 paused |
| 已触发 | `● 已触发`（自动导出完成后短暂闪现） | `onWritingComplete` 回调内设为 triggered，500ms 后自动回退为 idle |

同时显示笔画数和分组数。

**注意**：`paused` 状态由 composable 内部的本地定时器驱动，与 `RecognitionHelper` 内部定时器独立但使用相同的 `gapMs` 参数，仅用于 UI 状态指示。

### 分组高亮

- 右侧面板点击分组卡片 → 画布上叠加半透明虚线矩形，框出该组 boundingBox
- 用 CSS overlay 实现（absolute 定位的 div），不侵入 Inker 渲染管线
- **坐标来源**：`groups` 中始终存储**原始世界坐标**的 boundingBox（`translateToOrigin` 只影响 JSON 导出输出，不修改 `groups` 数据本身）
- 通过 camera 变换（`worldToScreen`）将世界坐标转为屏幕坐标定位 overlay：`screenX = (worldX - cam.x) * zoom`，`screenY = (worldY - cam.y) * zoom`
- 再次点击或切换 tab 时取消高亮

## 参数控制

复用已有 `FloatingPanel` 手风琴面板，新增"识别参数"折叠组：

| 参数 | 控件 | 默认值 | 说明 |
|---|---|---|---|
| `gapMs` | 滑块 + 数字输入 | 500 | RecognitionHelper 的唯一可调参数，同时控制分组间隔阈值和停顿判定超时 |
| 平移到原点 | 开关 | 开 | 是否调用 `translateToOrigin` |
| 计算包围盒 | 开关 | 开 | 是否在输出中附带包围盒字段 |

**参数生效机制**：
- 两个开关：下次触发导出时生效（不需要重建实例）
- `gapMs`：修改后调用 `rebindHelper()` 重新绑定 RecognitionHelper（dispose 旧实例，用新 gapMs 创建新实例）

## 数据操作

- **复制**：点击按钮将 JSON 复制到剪贴板
- **下载**：下载为 `recognition-export.json` 文件
- **清空**：清空所有分组数据 + 画布笔画，重新开始。调用 `inker.clear()` 清空画布，同时重置 `groups` 和 `jsonResult`。若清空时 RecognitionHelper 内部有正在倒计时的定时器，定时器到期后会读取空快照，`newStrokes` 为空自动 return，不会产生副作用。

## 复用组件

以下已有组件直接复用，不做修改：
- `StylePanel` — 颜色/尺寸/透明度
- `FreehandPanel` — 笔刷参数
- `FloatingPanel` — 浮动手风琴容器
- `RendererTabs` — 渲染器切换

## 约束

- 不修改 `@inker/recognition` 包的任何代码
- 不新增 playground 的外部依赖
- 不修改路由或场景注册（已有）
- JSON 语法高亮用简单正则实现，不引入第三方库
