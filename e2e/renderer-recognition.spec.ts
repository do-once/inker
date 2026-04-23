import { test, expect } from '@playwright/test'
import {
  BASIC_URL,
  RECOGNITION_URL,
  drawStroke,
  getStrokeCount,
  waitForCanvas,
  openFloatingPanel,
  openAccordionSection,
} from './helpers'

const DEFAULT_STROKE = [
  { x: 100, y: 150 },
  { x: 150, y: 130 },
  { x: 200, y: 160 },
  { x: 250, y: 140 },
]

test.describe('渲染器切换', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('默认 Canvas 渲染器 — 页面加载后 Canvas tab 带 active', async ({ page }) => {
    await expect(page.locator('.tab-btn', { hasText: 'Canvas' })).toHaveClass(/active/)
    await expect(page.locator('.tab-btn', { hasText: 'SVG' })).not.toHaveClass(/active/)
    await expect(page.locator('.tab-btn', { hasText: 'Offscreen' })).not.toHaveClass(/active/)
  })

  test('切换到 SVG — SVG tab 带 active，其他不带', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'SVG' }).click()
    await expect(page.locator('.tab-btn', { hasText: 'SVG' })).toHaveClass(/active/)
    await expect(page.locator('.tab-btn', { hasText: 'Canvas' })).not.toHaveClass(/active/)
    await expect(page.locator('.tab-btn', { hasText: 'Offscreen' })).not.toHaveClass(/active/)
  })

  test('切换到 Offscreen — Offscreen tab 带 active', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Offscreen' }).click()
    await expect(page.locator('.tab-btn', { hasText: 'Offscreen' })).toHaveClass(/active/)
    await expect(page.locator('.tab-btn', { hasText: 'Canvas' })).not.toHaveClass(/active/)
    await expect(page.locator('.tab-btn', { hasText: 'SVG' })).not.toHaveClass(/active/)
  })

  test('切换渲染器后绘制 — 切换到 SVG 后绘制笔画数加一', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'SVG' }).click()
    await waitForCanvas(page)
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('对比模式开启 — 按钮带 active，3 个 tab 变 disabled', async ({ page }) => {
    await page.locator('.compare-btn').click()
    await expect(page.locator('.compare-btn')).toHaveClass(/active/)
    await expect(page.locator('.tab-btn', { hasText: 'Canvas' })).toBeDisabled()
    await expect(page.locator('.tab-btn', { hasText: 'SVG' })).toBeDisabled()
    await expect(page.locator('.tab-btn', { hasText: 'Offscreen' })).toBeDisabled()
  })

  test('对比模式关闭 — 再次点击后按钮不带 active，tab 可用', async ({ page }) => {
    await page.locator('.compare-btn').click()
    await expect(page.locator('.compare-btn')).toHaveClass(/active/)
    await page.locator('.compare-btn').click()
    await expect(page.locator('.compare-btn')).not.toHaveClass(/active/)
    await expect(page.locator('.tab-btn', { hasText: 'Canvas' })).toBeEnabled()
    await expect(page.locator('.tab-btn', { hasText: 'SVG' })).toBeEnabled()
    await expect(page.locator('.tab-btn', { hasText: 'Offscreen' })).toBeEnabled()
  })
})

test.describe('场景切换', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('切换到识别场景 — URL 变为 /#/recognition', async ({ page }) => {
    await page.locator('select.scene-select').selectOption('/recognition')
    await page.waitForURL('**/#/recognition')
    expect(page.url()).toContain('/#/recognition')
  })

  test('识别场景工具栏 — 只有钢笔/铅笔/橡皮 3 个工具按钮', async ({ page }) => {
    await page.locator('select.scene-select').selectOption('/recognition')
    await page.waitForURL('**/#/recognition')
    await waitForCanvas(page)
    const toolBtns = page.locator('.tool-btn')
    await expect(toolBtns).toHaveCount(3)
    await expect(page.locator('.tool-btn', { hasText: '钢笔' })).toBeVisible()
    await expect(page.locator('.tool-btn', { hasText: '铅笔' })).toBeVisible()
    await expect(page.locator('.tool-btn', { hasText: '橡皮' })).toBeVisible()
  })
})

test.describe('识别场景功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RECOGNITION_URL)
    await waitForCanvas(page)
  })

  test('识别场景绘制 — 绘制一笔后笔画数加一', async ({ page }) => {
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('识别参数面板 — 展开后 checkbox 和 slider 可见', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '识别参数')
    await expect(page.locator('input[type=checkbox]').first()).toBeVisible()
    await expect(page.locator('input[type=range]').first()).toBeVisible()
  })

  test('切换回基础场景 — URL 变为 /#/basic，4 个工具按钮恢复', async ({ page }) => {
    await page.locator('select.scene-select').selectOption('/basic')
    await page.waitForURL('**/#/basic')
    await waitForCanvas(page)
    const toolBtns = page.locator('.tool-btn')
    await expect(toolBtns).toHaveCount(4)
    await expect(page.locator('.tool-btn', { hasText: '钢笔' })).toBeVisible()
    await expect(page.locator('.tool-btn', { hasText: '铅笔' })).toBeVisible()
    await expect(page.locator('.tool-btn', { hasText: '橡皮' })).toBeVisible()
    await expect(page.locator('.tool-btn', { hasText: '马克笔' })).toBeVisible()
  })
})
