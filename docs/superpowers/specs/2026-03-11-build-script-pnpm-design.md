# 构建脚本 pnpm 适配 + 子包独立构建 设计文档

> 日期：2026-03-11
> 状态：已批准

## 目标

1. 让每个库包能独立构建，产出 ESM 格式的 dist/
2. 改造 scripts/copy-dist 支持 pnpm workspaces（同时保持 npm workspaces 兼容）

## 设计决策

| 决策项 | 结论 |
|--------|------|
| 构建格式 | 本期只做 ESM，UMD 后续迭代 |
| 废弃包 @aw/compute-worker | 照常构建 |
| playground 产物 | 不参与 copy-dist |
| copy-dist 根 dist 结构 | 平铺（各包输出不同文件名，无冲突） |
| 无 dist 的包 | 静默跳过（保持现有行为） |
| monorepo 识别 | 优先 pnpm-workspace.yaml，fallback package.json.workspaces |

## Section 1：子包 vite.config.ts

### 共享配置（已存在）

`run-control/vite.lib.config.ts` 提供 `createLibConfig(entry, name)` 工厂函数：
- ESM only（`formats: ['es']`）
- 不压缩、带 sourcemap
- 所有 `@aw/*` 内部包设为 external

### 各子包配置

每个库包新增 `vite.config.ts`，一行式引用工厂函数：

```typescript
import { createLibConfig } from '../../run-control/vite.lib.config'
export default createLibConfig('src/index.ts', '<package-name>')
```

其中 `<package-name>` 为包的短名（不含 `@aw/` 前缀），如 `types`、`core`、`sdk`。

### 涉及的包（15 个）

| 包 | 路径 | 配置相对路径 |
|----|------|-------------|
| @aw/types | shared/types | ../../run-control/vite.lib.config |
| @aw/di | shared/di | ../../run-control/vite.lib.config |
| @aw/util | shared/util | ../../run-control/vite.lib.config |
| @aw/core | libraries/core | ../../run-control/vite.lib.config |
| @aw/model | libraries/model | ../../run-control/vite.lib.config |
| @aw/brush-freehand | libraries/brush-freehand | ../../run-control/vite.lib.config |
| @aw/input-pointer | libraries/input-pointer | ../../run-control/vite.lib.config |
| @aw/render-canvas | libraries/render-canvas | ../../run-control/vite.lib.config |
| @aw/render-offscreen | libraries/render-offscreen | ../../run-control/vite.lib.config |
| @aw/render-protocol | libraries/render-protocol | ../../run-control/vite.lib.config |
| @aw/render-svg | libraries/render-svg | ../../run-control/vite.lib.config |
| @aw/playback | libraries/playback | ../../run-control/vite.lib.config |
| @aw/sdk | libraries/sdk | ../../run-control/vite.lib.config |
| @aw/compute-worker | libraries/compute-worker | ../../run-control/vite.lib.config |
| @aw/freehand | third-parties/freehand | ../../run-control/vite.lib.config |

### package.json build 脚本

所有库包的 `"build"` 从 `"echo 'placeholder'"` 改为 `"vite build"`。

`@aw/render-protocol` 当前无 build 脚本，需新增 `"build": "vite build"`。

## Section 2：copy-dist 改造

### monorepo 类型自动识别

`generateGlobPatterns()` 改造为：

1. 检查 cwd 下是否存在 `pnpm-workspace.yaml`
2. 若存在：YAML 解析，读取 `packages` 数组
3. 若不存在：fallback 到 `package.json.workspaces` 数组
4. 过滤掉 `playground/*` 模式（playground 不参与拷贝）
5. 对每个 workspace pattern 生成 `${pattern}/dist/**/*` glob

### 新增依赖

`scripts/copy-dist/package.json` 添加 `yaml` 包（用于解析 pnpm-workspace.yaml）。

### 路径解析改造

现有的 `slice(0, 4)` 硬编码路径拆分改为基于 `/dist/` 分割：

```javascript
// 现有（硬编码层级）
const packageDistPath = file.split(path.sep).slice(0, 4).join(path.sep)

// 改造后（基于 /dist/ 分割，不依赖层级深度）
const distIndex = file.indexOf('/dist/')
const relativePath = file.substring(distIndex + '/dist/'.length)
```

这样无论包在 `shared/types/dist/` 还是 `libraries/core/dist/`，都能正确提取产物文件的相对路径。

### 不变

- 日志输出格式和颜色保持不变
- 静默跳过无 dist 的包（glob 自然无匹配）
- 产物平铺到根 dist/（不建子目录）

## 改造文件清单

| 文件 | 改造类型 |
|------|---------|
| shared/types/vite.config.ts | 新增 |
| shared/di/vite.config.ts | 新增 |
| shared/util/vite.config.ts | 新增 |
| libraries/core/vite.config.ts | 新增 |
| libraries/model/vite.config.ts | 新增 |
| libraries/brush-freehand/vite.config.ts | 新增 |
| libraries/input-pointer/vite.config.ts | 新增 |
| libraries/render-canvas/vite.config.ts | 新增 |
| libraries/render-offscreen/vite.config.ts | 新增 |
| libraries/render-protocol/vite.config.ts | 新增 |
| libraries/render-svg/vite.config.ts | 新增 |
| libraries/playback/vite.config.ts | 新增 |
| libraries/sdk/vite.config.ts | 新增 |
| libraries/compute-worker/vite.config.ts | 新增 |
| third-parties/freehand/vite.config.ts | 新增 |
| 15 个库包的 package.json | 修改（build 脚本） |
| scripts/copy-dist/index.js | 修改 |
| scripts/copy-dist/package.json | 修改（新增 yaml 依赖） |
