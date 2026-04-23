# Playground 重构设计

## 背景

当前 playground 是一个单页 Vue 3 应用，所有功能平铺在一个页面中，左侧固定 200px 侧边栏占据画布空间且上下滚动不便。随着 Inker SDK 能力扩展（多渲染器、识别等），需要支持多场景、多模块的调试需求。

## 设计目标

1. 支持多场景（基础使用、识别调试等），架构易扩展新场景
2. 同场景内支持多渲染器切换（Canvas / SVG / OffscreenCanvas）+ 对比模式
3. 浮动参数面板不占据画布空间，可折叠收起
4. 顶栏精简，底部状态栏承载操作按钮

## 整体布局

采用"单行紧凑顶栏 + 全屏画布 + 底部状态栏"三段式布局：

```
┌──────────────────────────────────────────────────┐
│  TopBar: [Inker] [▾ 场景] │ 🖊钢笔 🖌马克笔 ✏铅笔 🧹橡皮  │  ~40px
├──────────────────────────────────────────────────┤
│                                                  │
│              [Canvas] [SVG] [Offscreen] [⊞对比]  │  ← 渲染器Tab，居中浮动
│                                                  │
│                                    ┌──────────┐  │
│                                    │ 参数面板  │  │  ← 浮动手风琴面板
│              画布区域               │ ▾ 样式    │  │
│             (flex: 1)              │ ▸ 笔刷    │  │
│                                    │ ▸ 缩放    │  │
│                                    │ ▸ 回放    │  │
│                                    └──────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  笔画:12 Canvas2D  │  ↩撤销 ↪恢复 清空 │ 📤导出 │ −100%+  │  ~28px
└──────────────────────────────────────────────────┘
```

## 架构：路由 + 场景注册

### 目录结构

```
playground/app/src/
├── main.ts                    # 入口，注册路由
├── App.vue                    # 壳布局（顶栏 + router-view + 状态栏）
├── router.ts                  # 路由配置，从场景注册表生成
├── scenes/                    # 场景目录
│   ├── index.ts               # 场景注册表
│   ├── basic/                 # 基础使用场景
│   │   ├── BasicScene.vue     # 场景根组件
│   │   ├── useBasicEditor.ts  # 场景专属 composable
│   │   └── config.ts          # 场景配置
│   └── recognition/           # 识别调试场景
│       ├── RecognitionScene.vue
│       └── config.ts
├── components/                # 共享组件
│   ├── TopBar.vue             # 顶栏
│   ├── StatusBar.vue          # 底部状态栏
│   ├── FloatingPanel.vue      # 浮动手风琴面板
│   ├── RendererTabs.vue       # 渲染器 Tab
│   ├── CompareView.vue        # 对比模式并排画布
│   └── SliderControl.vue      # 公共滑块
└── composables/               # 共享 composable
    └── useEditor.ts           # 核心编辑器逻辑（重构自现有）
```

### 场景注册机制

每个场景导出一个配置对象：

```ts
// scenes/basic/config.ts
export const basicScene: SceneConfig = {
  name: '基础使用',
  path: '/basic',
  component: () => import('./BasicScene.vue'),
  tools: ['pen', 'marker', 'pencil', 'eraser'],
  panels: ['style', 'brush', 'zoom', 'playback']
}
```

**SceneConfig 接口：**

- `name` — 显示名称（下拉选择器中）
- `path` — 路由路径
- `component` — 懒加载的场景根组件
- `tools` — 可选，场景可用的工具列表，不声明则使用默认全集
- `panels` — 可选，场景需要的面板分组，不声明则使用默认全集
- `extraPanels` — 可选，场景专属的额外面板分组，类型为 `PanelGroupConfig[]`

```ts
interface PanelGroupConfig {
  id: string          // 唯一标识，如 'recognition-params'
  label: string       // 显示名称，如 '识别参数'
  component: Component // 面板内容组件（手风琴展开后渲染）
}
```

**注册流程：**

- `scenes/index.ts` 汇总所有场景配置到一个数组
- `router.ts` 遍历数组自动生成路由，默认重定向到第一个场景
- TopBar 读取数组渲染下拉选项，StatusBar 和 FloatingPanel 根据当前场景配置动态调整

新增场景三步：建目录 → 写配置 → 在 `index.ts` 注册。

### Composable 职责划分

- `composables/useEditor.ts`（共享）：管理 Inker 实例生命周期（创建、销毁、resize），暴露通用操作（undo/redo/clear、缩放、导出、回放），管理通用状态（strokeCount、zoomLevel 等）。所有场景都通过它操作编辑器。
- `scenes/basic/useBasicEditor.ts`（场景专属）：组合 useEditor，添加基础场景特有的状态和逻辑（如工具预设参数、官网默认参数对比等）。
- 场景专属 composable 是可选的——简单场景可以直接使用 useEditor。

### 场景隔离

- 每个场景持有独立的编辑器实例和状态
- 路由切换时销毁当前场景的编辑器，重建目标场景的编辑器
- Canvas 元素由场景根组件自行创建（在 template 中声明），Inker SDK 在初始化时接管该元素并创建双 Canvas 架构，销毁时 SDK 的 `dispose()` 负责清理
- 场景间不共享画布数据

## 浮动面板

- **单一手风琴面板**，默认浮动在画布右上角
- 面板头部可**拖拽移动**位置（限制在画布可视区域内，不可拖出屏幕），有**折叠**（最小化为入口按钮）和**关闭**操作
- 手风琴分组：
  - **样式**：颜色、大小、透明度
  - **笔刷参数**：thinning、smoothing、streamline、easing 等
  - **缩放与视口**：缩放值、平移模式
  - **回放**：进度条、播放/暂停/速度
- 各分组**独立展开/折叠**，同时可多个展开
- 面板位置和展开状态**不做持久化**（刷新重置）
- 不同场景可通过 `extraPanels` 声明额外面板分组
- 折叠态只显示 "☰ 参数面板" 入口按钮

## 渲染器切换 + 对比模式

- **渲染器 Tab** 居中浮动在画布上方，pill 形样式
- 默认 **Tab 单选切换**：Canvas / SVG / OffscreenCanvas，同一时间只渲染一个
- 末尾 **"⊞ 对比"按钮**，点击进入对比模式
- 点击对比按钮后，固定展示全部三种渲染器（Canvas / SVG / OffscreenCanvas），等分为三列，每列独立渲染器实例，顶部标注渲染器名称
- 对比模式中的绘制操作**同步到所有画布**（共享同一份操作序列，各渲染器独立渲染）
- 再次点击对比按钮退出，回到单渲染器 Tab 模式

## 顶栏（TopBar）

- 左侧：应用标题 "Inker" + 场景下拉选择器
- 分隔符后：工具按钮组（钢笔、马克笔、铅笔、橡皮），当前选中高亮
- 不同场景可声明自己的工具按钮组，TopBar 根据当前场景动态渲染
- 高度约 40px，单行紧凑

## 底部状态栏（StatusBar）

- 左侧：信息区（笔画计数、当前渲染器名称）
- 右侧从左到右：
  - 撤销/恢复/清空按钮（撤销/恢复根据 canUndo/canRedo 置灰）
  - 导出按钮
  - 缩放控制（−/百分比/+）
- 高度约 28px

## 技术选型

- **Vue Router**：场景路由管理
- **Vue 3 Composition API**：延续现有模式
- **Scoped CSS**：延续现有样式方案，不引入新的 CSS 框架
- **Vite**：延续现有构建工具

## 不在本次范围

- CSS 主题系统 / 深色模式
- 状态持久化（localStorage）
- 快捷键系统
- 响应式 / 移动端适配
