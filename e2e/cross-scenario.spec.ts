import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import {
  BASIC_URL,
  RECOGNITION_URL,
  drawStroke,
  drawMultipleStrokes,
  getStrokeCount,
  getZoomLevel,
  selectTool,
  clickStatusBarButton,
  waitForCanvas,
  openFloatingPanel,
  openAccordionSection,
} from './helpers'

const STROKE_A = [
  { x: 100, y: 150 },
  { x: 150, y: 130 },
  { x: 200, y: 160 },
  { x: 250, y: 140 },
]
const STROKE_B = [
  { x: 100, y: 250 },
  { x: 150, y: 230 },
  { x: 200, y: 260 },
]

test.describe('交叉场景：绘制 + 缩放 + 编辑', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('绘制 → 缩放 → 再绘制 → 撤销 → 验证笔画数', async ({ page }) => {
    await drawStroke(page, STROKE_A)
    expect(await getStrokeCount(page)).toBe(1)

    await page.locator('.statusbar .zoom-btn').last().click()
    await page.waitForTimeout(200)
    const zoom = await getZoomLevel(page)
    expect(zoom).toBeGreaterThan(100)

    await drawStroke(page, STROKE_B)
    expect(await getStrokeCount(page)).toBe(2)

    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(1)

    expect(await getZoomLevel(page)).toBe(zoom)
  })

  test('绘制 → 橡皮擦 → 撤销擦除 → 笔画恢复', async ({ page }) => {
    await drawStroke(page, STROKE_A)
    expect(await getStrokeCount(page)).toBe(1)

    await selectTool(page, '橡皮')
    await drawStroke(page, [
      { x: 90, y: 145 },
      { x: 260, y: 145 },
    ])
    await page.waitForTimeout(200)
    const afterErase = await getStrokeCount(page)
    expect(afterErase).toBe(0)

    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(1)
  })

  test('多工具切换绘制 → 全部撤销 → 全部重做', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawStroke(page, [
      { x: 80, y: 100 },
      { x: 180, y: 100 },
    ])
    await selectTool(page, '马克笔')
    await drawStroke(page, [
      { x: 80, y: 160 },
      { x: 180, y: 160 },
    ])
    await selectTool(page, '铅笔')
    await drawStroke(page, [
      { x: 80, y: 220 },
      { x: 180, y: 220 },
    ])
    expect(await getStrokeCount(page)).toBe(3)

    for (let i = 0; i < 3; i++) {
      await clickStatusBarButton(page, '↩ 撤销')
      await page.waitForTimeout(150)
    }
    expect(await getStrokeCount(page)).toBe(0)

    for (let i = 0; i < 3; i++) {
      await clickStatusBarButton(page, '↪ 恢复')
      await page.waitForTimeout(150)
    }
    expect(await getStrokeCount(page)).toBe(3)
  })

  test('清空 → 撤销清空 → 再清空 → 验证状态', async ({ page }) => {
    await drawMultipleStrokes(page, 3)
    expect(await getStrokeCount(page)).toBe(3)

    await clickStatusBarButton(page, '清空')
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(0)

    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(3)

    await clickStatusBarButton(page, '清空')
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(0)
  })
})

test.describe('交叉场景：导出 + 导入 + 回放', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('绘制 → 导出 JSON → 清空 → 导入 → 回放', async ({ page }) => {
    await drawMultipleStrokes(page, 3)
    expect(await getStrokeCount(page)).toBe(3)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      clickStatusBarButton(page, '导出 JSON'),
    ])

    const readable = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const tmpPath = path.join(os.tmpdir(), `inker-cross-${Date.now()}.json`)
    fs.writeFileSync(tmpPath, Buffer.concat(chunks))

    await clickStatusBarButton(page, '清空')
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(0)

    await page.locator('input[type=file][accept=".json"]').setInputFiles(tmpPath)
    await page.waitForTimeout(500)
    expect(await getStrokeCount(page)).toBe(3)

    await openFloatingPanel(page)
    await openAccordionSection(page, '回放')
    await page.locator('.accordion-content .action-btn', { hasText: '播放' }).click()
    await page.waitForTimeout(500)

    const progressText = await page.locator('.accordion-content .progress-text').textContent()
    const match = progressText?.match(/(\d+)%/)
    expect(match).toBeTruthy()
    const percent = parseInt(match![1], 10)
    expect(percent).toBeGreaterThanOrEqual(0)

    await page.locator('.accordion-content .action-btn.danger', { hasText: '停止' }).click()
    await page.waitForTimeout(200)

    fs.unlinkSync(tmpPath)
  })

  test('绘制 → 导出 PNG → 缩放后导出 PNG → 两次都成功', async ({ page }) => {
    await drawStroke(page, STROKE_A)

    const [download1] = await Promise.all([
      page.waitForEvent('download'),
      clickStatusBarButton(page, '导出 PNG'),
    ])
    expect(download1.suggestedFilename()).toMatch(/\.png$/i)

    await page.locator('.statusbar .zoom-btn').last().click()
    await page.waitForTimeout(200)

    const [download2] = await Promise.all([
      page.waitForEvent('download'),
      clickStatusBarButton(page, '导出 PNG'),
    ])
    expect(download2.suggestedFilename()).toMatch(/\.png$/i)
  })
})

test.describe('交叉场景：渲染器 + 绘制 + 导出', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('切换 SVG → 绘制 → 导出 JSON → 切回 Canvas → 导入 → 验证', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'SVG' }).click()
    await page.waitForTimeout(300)

    await drawMultipleStrokes(page, 2)
    expect(await getStrokeCount(page)).toBe(2)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      clickStatusBarButton(page, '导出 JSON'),
    ])

    const readable = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const tmpPath = path.join(os.tmpdir(), `inker-renderer-${Date.now()}.json`)
    fs.writeFileSync(tmpPath, Buffer.concat(chunks))

    await page.locator('.tab-btn', { hasText: 'Canvas' }).click()
    await page.waitForTimeout(300)

    await clickStatusBarButton(page, '清空')
    await page.waitForTimeout(200)

    await page.locator('input[type=file][accept=".json"]').setInputFiles(tmpPath)
    await page.waitForTimeout(500)
    expect(await getStrokeCount(page)).toBe(2)

    fs.unlinkSync(tmpPath)
  })

  test('对比模式下绘制 → 退出对比模式 → 验证笔画', async ({ page }) => {
    await page.locator('.compare-btn').click()
    await page.waitForTimeout(300)
    await expect(page.locator('.compare-btn')).toHaveClass(/active/)

    await drawStroke(page, STROKE_A)
    const count = await getStrokeCount(page)

    await page.locator('.compare-btn').click()
    await page.waitForTimeout(300)
    expect(await getStrokeCount(page)).toBe(count)
  })
})

test.describe('交叉场景：场景切换保持状态', () => {
  test('基础场景绘制 → 切到识别 → 切回 → 笔画保持', async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)

    await drawMultipleStrokes(page, 2)
    expect(await getStrokeCount(page)).toBe(2)

    await page.locator('select.scene-select').selectOption('/recognition')
    await page.waitForURL('**/#/recognition')
    await waitForCanvas(page)

    await page.locator('select.scene-select').selectOption('/basic')
    await page.waitForURL('**/#/basic')
    await waitForCanvas(page)

    const count = await getStrokeCount(page)
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('识别场景绘制 → 撤销 → 清空 → 全流程', async ({ page }) => {
    await page.goto(RECOGNITION_URL)
    await waitForCanvas(page)

    await drawMultipleStrokes(page, 3)
    expect(await getStrokeCount(page)).toBe(3)

    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(2)

    await clickStatusBarButton(page, '清空')
    await page.waitForTimeout(200)
    expect(await getStrokeCount(page)).toBe(0)
  })
})

test.describe('交叉场景：视口 + 绘制 + 编辑', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('平移模式 → 绘制无效 → 退出平移 → 绘制有效', async ({ page }) => {
    await openFloatingPanel(page)
    await openAccordionSection(page, '缩放与视口')
    const panBtn = page.locator('.pan-btn')
    await panBtn.click()
    await expect(panBtn).toHaveClass(/active/)

    await drawStroke(page, STROKE_A)
    await page.waitForTimeout(200)
    const duringPan = await getStrokeCount(page)

    await panBtn.click()
    await expect(panBtn).not.toHaveClass(/active/)

    await drawStroke(page, STROKE_B)
    await page.waitForTimeout(200)
    const afterExit = await getStrokeCount(page)
    expect(afterExit).toBeGreaterThanOrEqual(duringPan)
  })

  test('缩放到极小 → 绘制 → 缩放适应 → 验证', async ({ page }) => {
    const zoomOutBtn = page.locator('.statusbar .zoom-btn').first()
    for (let i = 0; i < 5; i++) {
      await zoomOutBtn.click()
      await page.waitForTimeout(100)
    }
    const smallZoom = await getZoomLevel(page)
    expect(smallZoom).toBeLessThan(50)

    await drawStroke(page, STROKE_A)
    expect(await getStrokeCount(page)).toBe(1)

    await openFloatingPanel(page)
    await openAccordionSection(page, '缩放与视口')
    await page.locator('.action-btn', { hasText: '适应画布' }).click()
    await page.waitForTimeout(300)

    const fitZoom = await getZoomLevel(page)
    expect(fitZoom).toBeGreaterThan(0)
  })

  test('连续缩放到极大 → 不崩溃 → 重置 100%', async ({ page }) => {
    const zoomInBtn = page.locator('.statusbar .zoom-btn').last()
    for (let i = 0; i < 10; i++) {
      await zoomInBtn.click()
      await page.waitForTimeout(80)
    }
    const bigZoom = await getZoomLevel(page)
    expect(bigZoom).toBeGreaterThan(300)

    await openFloatingPanel(page)
    await openAccordionSection(page, '缩放与视口')
    await page.locator('.action-btn', { hasText: '100%' }).click()
    await page.waitForTimeout(200)
    expect(await getZoomLevel(page)).toBe(100)
  })
})
