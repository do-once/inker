import { test, expect } from '@playwright/test'
import {
  BASIC_URL,
  drawStroke,
  getStrokeCount,
  getZoomLevel,
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

test.describe('视口与缩放', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('状态栏放大 — 点击加号后缩放值大于100%', async ({ page }) => {
    const before = await getZoomLevel(page)
    await page.locator('.statusbar .zoom-btn').last().click()
    await page.waitForTimeout(100)
    const after = await getZoomLevel(page)
    expect(after).toBeGreaterThan(before)
  })

  test('状态栏缩小 — 点击减号后缩放值小于100%', async ({ page }) => {
    const before = await getZoomLevel(page)
    await page.locator('.statusbar .zoom-btn').first().click()
    await page.waitForTimeout(100)
    const after = await getZoomLevel(page)
    expect(after).toBeLessThan(before)
  })

  test('连续放大 — 点击三次加号缩放值递增', async ({ page }) => {
    const zoomBtn = page.locator('.statusbar .zoom-btn').last()
    const z0 = await getZoomLevel(page)
    await zoomBtn.click()
    await page.waitForTimeout(100)
    const z1 = await getZoomLevel(page)
    await zoomBtn.click()
    await page.waitForTimeout(100)
    const z2 = await getZoomLevel(page)
    await zoomBtn.click()
    await page.waitForTimeout(100)
    const z3 = await getZoomLevel(page)
    expect(z1).toBeGreaterThan(z0)
    expect(z2).toBeGreaterThan(z1)
    expect(z3).toBeGreaterThan(z2)
  })

  test('面板放大缩小 — 面板内加减号改变缩放值', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '缩放与视口')
    const zoomPlusBtn = page.locator('.zoom-section .zoom-btn').last()
    const zoomMinusBtn = page.locator('.zoom-section .zoom-btn').first()
    const before = await getZoomLevel(page)
    await zoomPlusBtn.click()
    await page.waitForTimeout(100)
    const afterPlus = await getZoomLevel(page)
    expect(afterPlus).toBeGreaterThan(before)
    await zoomMinusBtn.click()
    await page.waitForTimeout(100)
    const afterMinus = await getZoomLevel(page)
    expect(afterMinus).toBeLessThan(afterPlus)
  })

  test('适应画布 — 绘制笔画后点击适应画布不崩溃', async ({ page }) => {
    await drawStroke(page, DEFAULT_STROKE)
    await openFloatingPanel(page)
    await openAccordionSection(page, '缩放与视口')
    await page.locator('.action-btn', { hasText: '适应画布' }).click()
    await page.waitForTimeout(300)
    const zoom = await getZoomLevel(page)
    expect(zoom).toBeGreaterThan(0)
  })

  test('重置100% — 放大后点击100%恢复到100%', async ({ page }) => {
    await page.locator('.statusbar .zoom-btn').last().click()
    await page.waitForTimeout(100)
    const zoomed = await getZoomLevel(page)
    expect(zoomed).toBeGreaterThan(100)
    await openFloatingPanel(page)
    await openAccordionSection(page, '缩放与视口')
    await page.locator('.action-btn', { hasText: '100%' }).click()
    await page.waitForTimeout(100)
    const reset = await getZoomLevel(page)
    expect(reset).toBe(100)
  })

  test('平移模式切换 — 点击后按钮文本变为平移中且带active', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '缩放与视口')
    const panBtn = page.locator('.pan-btn')
    await expect(panBtn).toHaveText('平移模式')
    await panBtn.click()
    await page.waitForTimeout(100)
    await expect(panBtn).toHaveText('平移中')
    await expect(panBtn).toHaveClass(/active/)
  })

  test('平移模式退出 — 进入平移模式后再次点击退回平移模式文本', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '缩放与视口')
    const panBtn = page.locator('.pan-btn')
    await panBtn.click()
    await page.waitForTimeout(100)
    await expect(panBtn).toHaveText('平移中')
    await panBtn.click()
    await page.waitForTimeout(100)
    await expect(panBtn).toHaveText('平移模式')
    await expect(panBtn).not.toHaveClass(/active/)
  })

  test('滚轮缩放 — 在画布上滚轮后缩放值变化', async ({ page }) => {
    const canvas = page.locator('.editor-container canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('画布未找到')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const before = await getZoomLevel(page)
    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, -100)
    await page.waitForTimeout(200)
    const after = await getZoomLevel(page)
    expect(after).not.toBe(before)
  })

  test('缩放后绘制正常 — 放大后绘制笔画数加一', async ({ page }) => {
    await page.locator('.statusbar .zoom-btn').last().click()
    await page.waitForTimeout(100)
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    const after = await getStrokeCount(page)
    expect(after).toBe(before + 1)
  })
})
