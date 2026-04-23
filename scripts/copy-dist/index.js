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
