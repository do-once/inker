# 构建脚本 pnpm 适配 + 子包独立构建 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让每个库包独立构建产出 ESM dist/，并改造 copy-dist 脚本支持 pnpm workspaces。

**Architecture:** 每个子包新增一行式 `vite.config.ts` 引用 `run-control/vite.lib.config.ts` 的工厂函数；`scripts/copy-dist` 改造为自动识别 pnpm-workspace.yaml（fallback npm workspaces），路径解析基于 `/dist/` 分割取代硬编码层级。

**Tech Stack:** Vite 7, pnpm workspaces, yaml（YAML 解析库）

**Spec:** `docs/superpowers/specs/2026-03-11-build-script-pnpm-design.md`

---

## Chunk 1: copy-dist 改造 + 子包构建接入

### Task 1: copy-dist 支持 pnpm workspaces

**Files:**
- Modify: `scripts/copy-dist/package.json`
- Modify: `scripts/copy-dist/index.js`

- [ ] **Step 1: 安装 yaml 依赖**

```bash
cd scripts/copy-dist && npm install yaml@2.7.1 --save-exact
```

- [ ] **Step 2: 改造 index.js**

将 `scripts/copy-dist/index.js` 全文替换为：

```javascript
/**
 * 将 workspaces 中各子包 dist/ 内的构建产物拷贝到项目根目录 dist/
 * 支持 pnpm workspaces（pnpm-workspace.yaml）和 npm workspaces（package.json）
 */

import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

import fs from 'fs-extra'
import * as globModule from 'glob'
import chalk from 'chalk'
import { parse as parseYaml } from 'yaml'

// 定义日志级别和颜色
const logLevels = {
  INFO: chalk.blue,
  SUCCESS: chalk.green,
  WARNING: chalk.yellow,
  ERROR: chalk.red,
}

/**
 * 格式化日志输出
 * @param {string} message 日志消息
 * @param {string} level 日志级别
 */
function log(message, level = 'INFO') {
  const colorize = logLevels[level] || logLevels.INFO
  const timestamp = new Date().toISOString()
  console.log(`${timestamp} [${level}] ${colorize(message)}`)
}

/**
 * 从 pnpm-workspace.yaml 读取 workspace 模式
 * @returns {string[] | null} workspace 模式数组，文件不存在则返回 null
 */
function readPnpmWorkspaces() {
  const yamlPath = path.resolve(process.cwd(), 'pnpm-workspace.yaml')
  if (!existsSync(yamlPath)) return null

  try {
    const content = readFileSync(yamlPath, 'utf8')
    const parsed = parseYaml(content)
    if (parsed?.packages && Array.isArray(parsed.packages)) {
      log('检测到 pnpm-workspace.yaml，使用 pnpm workspaces', 'INFO')
      return parsed.packages
    }
    log('pnpm-workspace.yaml 中未找到 packages 字段', 'WARNING')
    return null
  } catch (err) {
    log(`解析 pnpm-workspace.yaml 失败: ${err.message}`, 'ERROR')
    return null
  }
}

/**
 * 从 package.json 读取 workspace 模式（npm workspaces）
 * @returns {string[] | null} workspace 模式数组
 */
function readNpmWorkspaces() {
  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

    if (packageJson.workspaces && Array.isArray(packageJson.workspaces)) {
      log('使用 package.json workspaces（npm 模式）', 'INFO')
      return packageJson.workspaces
    }
    return null
  } catch (err) {
    log(`读取 package.json 失败: ${err.message}`, 'ERROR')
    return null
  }
}

/** playground 不参与拷贝 */
const EXCLUDE_PATTERNS = ['playground/*']

/**
 * 自动识别 monorepo 类型并生成 glob 模式
 * 优先 pnpm-workspace.yaml，fallback package.json.workspaces
 */
function generateGlobPatterns() {
  const workspaces = readPnpmWorkspaces() ?? readNpmWorkspaces()

  if (!workspaces || workspaces.length === 0) {
    log('未找到任何 workspace 配置', 'WARNING')
    return []
  }

  // 过滤掉 playground
  const filtered = workspaces.filter(
    ws => !EXCLUDE_PATTERNS.some(pat => ws.startsWith(pat.replace('/*', '')))
  )

  log(`有效 workspace 模式: ${filtered.join(', ')}`, 'INFO')
  return filtered.map(ws => `${ws}/dist/**/*`)
}

/**
 * 使用 glob 查找所有子包 dist/ 下的文件
 */
const GLOB_SRC_PATTERNS = generateGlobPatterns()

/**
 * 目标目录
 */
const DST_DIR = path.resolve(process.cwd(), 'dist')

/**
 * 从文件路径中提取 dist/ 之后的相对路径
 * 基于 /dist/ 分割，不依赖目录层级深度
 */
function getRelativePath(filePath) {
  // 统一为正斜杠，确保跨平台
  const normalized = filePath.replace(/\\/g, '/')
  const distMarker = '/dist/'
  const distIndex = normalized.indexOf(distMarker)
  if (distIndex === -1) return path.basename(filePath)
  return normalized.substring(distIndex + distMarker.length)
}

/**
 * 主函数：复制文件从各子包 dist/ 到根目录 dist/
 */
async function copyDistFiles() {
  try {
    // 确保目标目录存在
    await fs.ensureDir(DST_DIR)
    log(`目标目录已准备: ${DST_DIR}`, 'INFO')

    log(`搜索文件模式: ${GLOB_SRC_PATTERNS}`, 'INFO')
    // 获取所有匹配的文件
    const files = await globModule.glob(GLOB_SRC_PATTERNS, { nodir: true })
    if (files.length === 0) {
      log('未找到需要复制的文件', 'WARNING')
      return
    }
    log(`找到 ${files.length} 个文件需要复制`, 'INFO')

    // 复制每个文件到根目录的 dist，平铺结构
    let successCount = 0
    let errorCount = 0

    for (const file of files) {
      try {
        const relativePath = getRelativePath(file)
        const targetPath = path.join(DST_DIR, relativePath)

        await fs.ensureDir(path.dirname(targetPath))
        await fs.copy(file, targetPath)
        log(`已复制: ${file} -> ${targetPath}`, 'SUCCESS')
        successCount++
      } catch (err) {
        log(`复制失败: ${file}, 原因: ${err.message}`, 'ERROR')
        errorCount++
      }
    }

    // 输出汇总信息
    if (successCount > 0) log(`成功复制 ${successCount} 个文件`, 'SUCCESS')
    if (errorCount > 0) log(`复制失败 ${errorCount} 个文件`, 'WARNING')
  } catch (err) {
    log(`构建过程失败: ${err.message}`, 'ERROR')
    throw err
  }
}

function main() {
  log('开始复制文件...', 'INFO')
  copyDistFiles()
    .then(() => log('复制完成!', 'SUCCESS'))
    .catch((err) => {
      log(`执行过程中发生错误: ${err.message}`, 'ERROR')
      process.exit(1)
    })
}

main()
```

- [ ] **Step 3: 验证脚本语法**

```bash
cd scripts/copy-dist && node --check index.js
```

Expected: 无输出（语法正确）

- [ ] **Step 4: 提交**

```bash
git add scripts/copy-dist/package.json scripts/copy-dist/index.js
git commit -m "feat: copy-dist 支持 pnpm workspaces（自动识别，兼容 npm）"
```

---

### Task 2: 子包 vite.config.ts + build 脚本（shared/* 组）

**Files:**
- Create: `shared/types/vite.config.ts`
- Create: `shared/di/vite.config.ts`
- Create: `shared/util/vite.config.ts`
- Modify: `shared/types/package.json`
- Modify: `shared/di/package.json`
- Modify: `shared/util/package.json`

- [ ] **Step 1: 创建 3 个 vite.config.ts**

`shared/types/vite.config.ts`:
```typescript
import { createLibConfig } from '../../run-control/vite.lib.config'
export default createLibConfig('src/index.ts', 'types')
```

`shared/di/vite.config.ts`:
```typescript
import { createLibConfig } from '../../run-control/vite.lib.config'
export default createLibConfig('src/index.ts', 'di')
```

`shared/util/vite.config.ts`:
```typescript
import { createLibConfig } from '../../run-control/vite.lib.config'
export default createLibConfig('src/index.ts', 'util')
```

- [ ] **Step 2: 更新 3 个 package.json 的 build 脚本**

在每个包的 `package.json` 中，将 `"build": "echo 'placeholder'"` 替换为 `"build": "vite build"`。

- [ ] **Step 3: 验证构建**

```bash
pnpm --filter @aw/types run build
pnpm --filter @aw/di run build
pnpm --filter @aw/util run build
```

Expected: 每个包在自己的 `dist/` 下产出 `<name>.js` + `<name>.js.map`

- [ ] **Step 4: 提交**

```bash
git add shared/types/vite.config.ts shared/di/vite.config.ts shared/util/vite.config.ts
git add shared/types/package.json shared/di/package.json shared/util/package.json
git commit -m "feat: shared/* 子包接入 Vite 构建"
```

---

### Task 3: 子包 vite.config.ts + build 脚本（libraries/* 组）

**Files:**
- Create: `libraries/core/vite.config.ts`
- Create: `libraries/model/vite.config.ts`
- Create: `libraries/brush-freehand/vite.config.ts`
- Create: `libraries/input-pointer/vite.config.ts`
- Create: `libraries/render-canvas/vite.config.ts`
- Create: `libraries/render-offscreen/vite.config.ts`
- Create: `libraries/render-protocol/vite.config.ts`
- Create: `libraries/render-svg/vite.config.ts`
- Create: `libraries/playback/vite.config.ts`
- Create: `libraries/sdk/vite.config.ts`
- Create: `libraries/compute-worker/vite.config.ts`
- Modify: 11 个 `libraries/*/package.json`

- [ ] **Step 1: 创建 11 个 vite.config.ts**

所有文件结构相同，仅 name 参数不同：

```typescript
import { createLibConfig } from '../../run-control/vite.lib.config'
export default createLibConfig('src/index.ts', '<name>')
```

name 对应关系：

| 路径 | name |
|------|------|
| libraries/core | core |
| libraries/model | model |
| libraries/brush-freehand | brush-freehand |
| libraries/input-pointer | input-pointer |
| libraries/render-canvas | render-canvas |
| libraries/render-offscreen | render-offscreen |
| libraries/render-protocol | render-protocol |
| libraries/render-svg | render-svg |
| libraries/playback | playback |
| libraries/sdk | sdk |
| libraries/compute-worker | compute-worker |

- [ ] **Step 2: 更新 11 个 package.json 的 build 脚本**

- 10 个包：将 `"build": "echo 'placeholder'"` 替换为 `"build": "vite build"`
- `libraries/render-protocol/package.json`：**新增** `"build": "vite build"` 到 scripts 对象中（当前无 build 字段）

- [ ] **Step 3: 验证构建（抽样）**

```bash
pnpm --filter @aw/core run build
pnpm --filter @aw/sdk run build
pnpm --filter @aw/render-protocol run build
```

Expected: 每个包在自己的 `dist/` 下产出对应 `.js` + `.js.map`

- [ ] **Step 4: 提交**

```bash
git add libraries/*/vite.config.ts libraries/*/package.json
git commit -m "feat: libraries/* 子包接入 Vite 构建"
```

---

### Task 4: 子包 vite.config.ts + build 脚本（third-parties/* 组）

**Files:**
- Create: `third-parties/freehand/vite.config.ts`
- Modify: `third-parties/freehand/package.json`

- [ ] **Step 1: 创建 vite.config.ts**

`third-parties/freehand/vite.config.ts`:
```typescript
import { createLibConfig } from '../../run-control/vite.lib.config'
export default createLibConfig('src/index.ts', 'freehand')
```

- [ ] **Step 2: 更新 package.json 的 build 脚本**

将 `"build": "echo 'placeholder'"` 替换为 `"build": "vite build"`。

- [ ] **Step 3: 验证构建**

```bash
pnpm --filter @aw/freehand run build
```

Expected: `third-parties/freehand/dist/freehand.js` + `freehand.js.map`

- [ ] **Step 4: 提交**

```bash
git add third-parties/freehand/vite.config.ts third-parties/freehand/package.json
git commit -m "feat: third-parties/freehand 接入 Vite 构建"
```

---

## Chunk 2: 全量验证

### Task 5: 全量构建 + copy-dist 端到端验证

- [ ] **Step 1: 全量构建**

```bash
pnpm -r run build
```

Expected: 所有 15 个库包 + playground 构建成功，每个库包 dist/ 下有 `<name>.js` + `<name>.js.map`

- [ ] **Step 2: 运行 copy-dist**

```bash
node scripts/copy-dist/index.js
```

Expected:
- 日志显示"检测到 pnpm-workspace.yaml，使用 pnpm workspaces"
- 找到 30 个左右文件（15 包 × 2 文件：.js + .js.map）
- 所有文件成功拷贝到根 `dist/`
- playground 产物不被拷贝

- [ ] **Step 3: 验证根 dist 内容**

```bash
ls dist/
```

Expected: 包含 `types.js`、`types.js.map`、`core.js`、`core.js.map`、`sdk.js`、`sdk.js.map` 等文件，无子目录

- [ ] **Step 4: 清理构建产物**

```bash
rm -rf dist/
pnpm -r exec rm -rf dist
```

- [ ] **Step 5: 运行全量测试确保无回归**

```bash
pnpm -r run test
```

Expected: 全部通过

- [ ] **Step 6: 提交（如有遗漏修复）**

如果 Step 1-5 中有任何修复，提交修复：

```bash
git add -A
git commit -m "fix: 修复构建验证中发现的问题"
```
