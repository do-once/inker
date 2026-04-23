import { test, expect } from '@playwright/test'
import {
  BASIC_URL,
  RECOGNITION_URL,
  drawStroke,
  drawMultipleStrokes,
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

test.describe('浮动面板交互', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('折叠面板 → 展开面板', async ({ page }) => {
    const collapseBtn = page.locator('.panel-action')
    await collapseBtn.click()
    await page.waitForTimeout(300)

    await expect(page.locator('.panel-toggle')).toBeVisible()
    await expect(page.locator('.floating-panel')).not.toBeVisible()

    await page.locator('.panel-toggle').click()
    await page.waitForTimeout(300)
    await expect(page.locator('.floating-panel')).toBeVisible()
  })

  test('手风琴切换 — 样式/笔刷参数/缩放/回放逐个展开', async ({ page }) => {
    const sections = ['样式', '笔刷参数', '缩放与视口', '回放']
    for (const name of sections) {
      await openAccordionSection(page, name)
      const header = page.locator('.accordion-header', { hasText: name })
      const item = header.locator('..')
      await expect(item.locator('.accordion-content')).toBeVisible()
    }
  })

  test('折叠已展开的手风琴节', async ({ page }) => {
    await openAccordionSection(page, '样式')
    const styleHeader = page.locator('.accordion-header', { hasText: '样式' })
    const styleItem = styleHeader.locator('..')
    await expect(styleItem.locator('.accordion-content')).toBeVisible()

    await styleHeader.click()
    await page.waitForTimeout(200)
    await expect(styleItem.locator('.accordion-content')).not.toBeVisible()
  })

  test('折叠面板后绘制仍正常', async ({ page }) => {
    await page.locator('.panel-action').click()
    await page.waitForTimeout(300)
    await expect(page.locator('.panel-toggle')).toBeVisible()

    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(1)
  })
})

test.describe('识别场景数据面板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RECOGNITION_URL)
    await waitForCanvas(page)
  })

  test('识别参数 — 自动模式 checkbox 切换', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '识别参数')

    const checkboxes = page.locator('.accordion-content input[type=checkbox]')
    const firstCheckbox = checkboxes.first()
    const wasChecked = await firstCheckbox.isChecked()
    await firstCheckbox.click()
    await page.waitForTimeout(200)
    const isNow = await firstCheckbox.isChecked()
    expect(isNow).toBe(!wasChecked)
  })

  test('识别参数 — 分组间隔滑块调整', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '识别参数')

    const slider = page.locator('.param-slider')
    await slider.fill('500')
    await page.waitForTimeout(200)
    expect(await slider.inputValue()).toBe('500')
  })

  test('识别参数 — 平移到包围盒原点 checkbox', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '识别参数')

    const checkboxes = page.locator('.accordion-content input[type=checkbox]')
    const count = await checkboxes.count()
    if (count >= 2) {
      const bboxCheckbox = checkboxes.last()
      const wasChecked = await bboxCheckbox.isChecked()
      await bboxCheckbox.click()
      await page.waitForTimeout(200)
      expect(await bboxCheckbox.isChecked()).toBe(!wasChecked)
    }
  })

  test('识别场景绘制 → 自动模式下产生数据', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '识别参数')

    const checkboxes = page.locator('.accordion-content input[type=checkbox]')
    if (!(await checkboxes.first().isChecked())) {
      await checkboxes.first().click()
      await page.waitForTimeout(200)
    }

    await drawMultipleStrokes(page, 3, { spacing: 50 })
    expect(await getStrokeCount(page)).toBe(3)

    await page.waitForTimeout(2000)
  })

  test('识别场景 — 铅笔绘制', async ({ page }) => {
    const pencilBtn = page.locator('.tool-btn', { hasText: '铅笔' })
    await pencilBtn.click()
    await expect(pencilBtn).toHaveClass(/active/)

    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(1)
  })

  test('识别场景 — 橡皮擦擦除', async ({ page }) => {
    await drawStroke(page, DEFAULT_STROKE)
    expect(await getStrokeCount(page)).toBe(1)

    const eraserBtn = page.locator('.tool-btn', { hasText: '橡皮' })
    await eraserBtn.click()
    await expect(eraserBtn).toHaveClass(/active/)

    await drawStroke(page, [
      { x: 90, y: 145 },
      { x: 260, y: 145 },
    ])
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(0)
  })

  test('识别场景 — 导出 JSON', async ({ page }) => {
    await drawMultipleStrokes(page, 2)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.statusbar .action-btn', { hasText: '导出 JSON' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.json$/i)
  })

  test('识别场景 — 导出 PNG', async ({ page }) => {
    await drawStroke(page, DEFAULT_STROKE)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.statusbar .action-btn', { hasText: '导出 PNG' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.png$/i)
  })

  test('识别场景 — 缩放按钮正常', async ({ page }) => {
    const zoomBefore = await getZoomLevel(page)
    await page.locator('.statusbar .zoom-btn').last().click()
    await page.waitForTimeout(300)
    const zoomAfter = await getZoomLevel(page)
    expect(zoomAfter).toBeGreaterThan(zoomBefore)
  })

  test('识别场景 — 导入 JSON', async ({ page }) => {
    await drawMultipleStrokes(page, 2)
    const before = await getStrokeCount(page)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.statusbar .action-btn', { hasText: '导出 JSON' }).click(),
    ])

    const readable = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    const { writeFileSync, unlinkSync } = await import('fs')
    const tmpPath = join(tmpdir(), `inker-recog-${Date.now()}.json`)
    writeFileSync(tmpPath, Buffer.concat(chunks))

    await page.locator('.statusbar .action-btn', { hasText: '清空' }).click()
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(0)

    await page.locator('input[type=file][accept=".json"]').setInputFiles(tmpPath)
    await page.waitForTimeout(500)
    expect(await getStrokeCount(page)).toBe(before)

    unlinkSync(tmpPath)
  })
})
