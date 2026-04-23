import { test, expect } from '@playwright/test'
import {
  BASIC_URL,
  drawStroke,
  drawMultipleStrokes,
  getStrokeCount,
  selectTool,
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

test.describe('绘制路径', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('钢笔绘制 — 绘制一笔后笔画数加一', async ({ page }) => {
    await selectTool(page, '钢笔')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('马克笔绘制 — 绘制一笔后笔画数加一', async ({ page }) => {
    await selectTool(page, '马克笔')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('铅笔绘制 — 绘制一笔后笔画数加一', async ({ page }) => {
    await selectTool(page, '铅笔')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('连续多笔 — 绘制三笔后笔画数为三', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawMultipleStrokes(page, 3)
    const count = await getStrokeCount(page)
    expect(count).toBe(3)
  })

  test('工具切换后绘制 — 钢笔与马克笔各一笔共两笔', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawStroke(page, [
      { x: 80, y: 120 },
      { x: 130, y: 110 },
      { x: 180, y: 130 },
    ])
    await selectTool(page, '马克笔')
    await drawStroke(page, [
      { x: 80, y: 200 },
      { x: 130, y: 190 },
      { x: 180, y: 210 },
    ])
    const count = await getStrokeCount(page)
    expect(count).toBe(2)
  })

  test('样式面板-颜色修改 — 修改颜色后绘制不崩溃', async ({ page }) => {
    await openFloatingPanel(page)
    await page.locator('input[type=color].color-input').first().fill('#ff0000')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('样式面板-大小修改 — 修改大小滑块后绘制不崩溃', async ({ page }) => {
    await openFloatingPanel(page)
    const sizeSlider = page.locator('input[type=range]').first()
    await sizeSlider.fill('20')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('笔刷参数-模拟压感 — 勾选后绘制不崩溃', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '笔刷参数')
    const checkbox = page.locator('input[type=checkbox]').first()
    if (!(await checkbox.isChecked())) {
      await checkbox.click()
    }
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('笔刷参数-缓动函数 — 修改后绘制不崩溃', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '笔刷参数')
    const select = page.locator('.select-input')
    await select.selectOption({ index: 1 })
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('笔刷参数-官网默认 — 点击后绘制不崩溃', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '笔刷参数')
    await page.locator('button', { hasText: '官网默认' }).click()
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })

  test('默认工具 — 页面加载后钢笔已激活', async ({ page }) => {
    await expect(page.locator('.tool-btn', { hasText: '钢笔' })).toHaveClass(/active/)
  })
})
