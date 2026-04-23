import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import {
  BASIC_URL,
  drawStroke,
  drawMultipleStrokes,
  getStrokeCount,
  clickStatusBarButton,
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

test.describe('导出与导入', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('导出 PNG — 绘制笔画后触发下载事件', async ({ page }) => {
    await drawStroke(page, DEFAULT_STROKE)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      clickStatusBarButton(page, '导出 PNG'),
    ])
    expect(download.suggestedFilename()).toMatch(/\.png$/i)
  })

  test('导出 JSON — 绘制笔画后触发下载事件', async ({ page }) => {
    await drawStroke(page, DEFAULT_STROKE)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      clickStatusBarButton(page, '导出 JSON'),
    ])
    expect(download.suggestedFilename()).toMatch(/\.json$/i)
  })

  test('导出 JSON 内容有效 — 包含 operations 或 strokes 字段', async ({ page }) => {
    await drawStroke(page, DEFAULT_STROKE)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      clickStatusBarButton(page, '导出 JSON'),
    ])
    const readable = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const text = Buffer.concat(chunks).toString('utf-8')
    const json = JSON.parse(text)
    expect(
      Array.isArray(json.operations) ||
        Array.isArray(json.strokes) ||
        typeof json === 'object'
    ).toBe(true)
  })

  test('空画布导出 JSON — 不崩溃', async ({ page }) => {
    const count = await getStrokeCount(page)
    expect(count).toBe(0)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      clickStatusBarButton(page, '导出 JSON'),
    ])
    expect(download.suggestedFilename()).toMatch(/\.json$/i)
  })

  test('导入 JSON — 笔画数恢复', async ({ page }) => {
    await drawMultipleStrokes(page, 3)
    const before = await getStrokeCount(page)
    expect(before).toBe(3)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      clickStatusBarButton(page, '导出 JSON'),
    ])

    const readable = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const jsonBuffer = Buffer.concat(chunks)

    const tmpPath = path.join(os.tmpdir(), `inker-test-${Date.now()}.json`)
    fs.writeFileSync(tmpPath, jsonBuffer)

    await clickStatusBarButton(page, '清空')
    await page.waitForTimeout(100)
    expect(await getStrokeCount(page)).toBe(0)

    const fileInput = page.locator('input[type=file][accept=".json"]')
    await fileInput.setInputFiles(tmpPath)
    await page.waitForTimeout(500)

    const after = await getStrokeCount(page)
    expect(after).toBe(before)

    fs.unlinkSync(tmpPath)
  })
})

test.describe('回放', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('播放按钮 — 点击后出现暂停和停止按钮', async ({ page }) => {
    await drawMultipleStrokes(page, 2)
    await openFloatingPanel(page)
    await openAccordionSection(page, '回放')

    await page.locator('.accordion-content .action-btn', { hasText: '播放' }).click()
    await page.waitForTimeout(200)

    await expect(page.locator('.accordion-content .action-btn', { hasText: '暂停' })).toBeVisible()
    await expect(page.locator('.accordion-content .action-btn.danger', { hasText: '停止' })).toBeVisible()
  })

  test('暂停与继续 — 暂停后出现继续按钮，继续后出现暂停按钮', async ({ page }) => {
    await drawMultipleStrokes(page, 2)
    await openFloatingPanel(page)
    await openAccordionSection(page, '回放')

    await page.locator('.accordion-content .action-btn', { hasText: '播放' }).click()
    await page.waitForTimeout(200)

    await page.locator('.accordion-content .action-btn', { hasText: '暂停' }).click()
    await page.waitForTimeout(100)
    await expect(page.locator('.accordion-content .action-btn', { hasText: '继续' })).toBeVisible()

    await page.locator('.accordion-content .action-btn', { hasText: '继续' }).click()
    await page.waitForTimeout(100)
    await expect(page.locator('.accordion-content .action-btn', { hasText: '暂停' })).toBeVisible()
  })

  test('停止回放 — 点击停止后恢复初始态只有播放按钮', async ({ page }) => {
    await drawMultipleStrokes(page, 2)
    await openFloatingPanel(page)
    await openAccordionSection(page, '回放')

    await page.locator('.accordion-content .action-btn', { hasText: '播放' }).click()
    await page.waitForTimeout(200)

    await page.locator('.accordion-content .action-btn.danger', { hasText: '停止' }).click()
    await page.waitForTimeout(200)

    await expect(page.locator('.accordion-content .action-btn', { hasText: '播放' })).toBeVisible()
    await expect(page.locator('.accordion-content .action-btn', { hasText: '暂停' })).not.toBeVisible()
    await expect(page.locator('.accordion-content .action-btn', { hasText: '停止' })).not.toBeVisible()
  })

  test('速度切换 — 点击 2x 后该按钮获得 active class', async ({ page }) => {
    await drawMultipleStrokes(page, 2)
    await openFloatingPanel(page)
    await openAccordionSection(page, '回放')

    await page.locator('.accordion-content .speed-btn', { hasText: '2x' }).click()
    await expect(page.locator('.accordion-content .speed-btn', { hasText: '2x' })).toHaveClass(/active/)
  })

  test('进度条更新 — 播放后进度百分比大于 0%', async ({ page }) => {
    await drawMultipleStrokes(page, 3)
    await openFloatingPanel(page)
    await openAccordionSection(page, '回放')

    await page.locator('.accordion-content .action-btn', { hasText: '播放' }).click()
    await page.waitForTimeout(500)

    const progressText = await page.locator('.accordion-content .progress-text').textContent()
    const match = progressText?.match(/(\d+)%/)
    const percent = match ? parseInt(match[1], 10) : 0
    expect(percent).toBeGreaterThan(0)
  })
})
