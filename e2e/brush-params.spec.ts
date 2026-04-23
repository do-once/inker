import { test, expect } from '@playwright/test'
import {
  BASIC_URL,
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

test.describe('笔刷参数全覆盖', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
    await openFloatingPanel(page)
  })

  test('透明度滑块 — 修改后绘制正常', async ({ page }) => {
    await openAccordionSection(page, '样式')
    const sliders = page.locator('.accordion-content input[type=range]')
    const opacitySlider = sliders.nth(1)
    await opacitySlider.fill('0.5')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(before + 1)
  })

  test('细化滑块 — 调整后绘制正常', async ({ page }) => {
    await openAccordionSection(page, '笔刷参数')
    const sliders = page.locator('.freehand-panel input[type=range]')
    await sliders.first().fill('0.5')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(before + 1)
  })

  test('平滑滑块 — 调整后绘制正常', async ({ page }) => {
    await openAccordionSection(page, '笔刷参数')
    const thinningSlider = page.locator('.accordion-content input[type=range]').first()
    await page.waitForTimeout(100)
    const allSliders = page.locator('.freehand-panel input[type=range]')
    await allSliders.nth(1).fill('0.8')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(before + 1)
  })

  test('流线滑块 — 调整后绘制正常', async ({ page }) => {
    await openAccordionSection(page, '笔刷参数')
    const allSliders = page.locator('.freehand-panel input[type=range]')
    await allSliders.nth(2).fill('0.7')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(before + 1)
  })

  test('起始渐细滑块 — 调整后绘制正常', async ({ page }) => {
    await openAccordionSection(page, '笔刷参数')
    const allSliders = page.locator('.freehand-panel input[type=range]')
    await allSliders.nth(3).fill('50')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(before + 1)
  })

  test('结束渐细滑块 — 调整后绘制正常', async ({ page }) => {
    await openAccordionSection(page, '笔刷参数')
    const allSliders = page.locator('.freehand-panel input[type=range]')
    await allSliders.nth(4).fill('80')
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(before + 1)
  })

  test('起始端帽 — 勾选后绘制正常', async ({ page }) => {
    await openAccordionSection(page, '笔刷参数')
    const checkboxes = page.locator('.freehand-panel input[type=checkbox]')
    const capStart = checkboxes.nth(1)
    if (!(await capStart.isChecked())) {
      await capStart.click()
    }
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(before + 1)
  })

  test('结束端帽 — 勾选后绘制正常', async ({ page }) => {
    await openAccordionSection(page, '笔刷参数')
    const checkboxes = page.locator('.freehand-panel input[type=checkbox]')
    const capEnd = checkboxes.nth(2)
    if (!(await capEnd.isChecked())) {
      await capEnd.click()
    }
    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(before + 1)
  })

  test('多参数组合 — 同时调整多个参数后绘制正常', async ({ page }) => {
    await openAccordionSection(page, '样式')
    await page.locator('.accordion-content input[type=range]').first().fill('15')

    await openAccordionSection(page, '笔刷参数')
    const freehandSliders = page.locator('.freehand-panel input[type=range]')
    await freehandSliders.nth(0).fill('-0.3')
    await freehandSliders.nth(1).fill('0.9')
    await freehandSliders.nth(2).fill('0.4')

    const checkboxes = page.locator('.freehand-panel input[type=checkbox]')
    if (!(await checkboxes.first().isChecked())) {
      await checkboxes.first().click()
    }

    const before = await getStrokeCount(page)
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(before + 1)
  })

  test('缓动函数逐个切换 — 前 5 个缓动函数都能绘制', async ({ page }) => {
    await openAccordionSection(page, '笔刷参数')
    const select = page.locator('.select-input')
    const options = await select.locator('option').allTextContents()

    for (let i = 0; i < Math.min(5, options.length); i++) {
      await select.selectOption({ index: i })
      await drawStroke(page, [
        { x: 100, y: 120 + i * 30 },
        { x: 200, y: 110 + i * 30 },
        { x: 300, y: 130 + i * 30 },
      ])
    }
    const count = await getStrokeCount(page)
    expect(count).toBe(Math.min(5, options.length))
  })
})
