import { test, expect } from '@playwright/test'
import {
  BASIC_URL,
  drawStroke,
  drawMultipleStrokes,
  getStrokeCount,
  selectTool,
  clickStatusBarButton,
  waitForCanvas,
} from './helpers'

test.describe('橡皮擦与编辑操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASIC_URL)
    await waitForCanvas(page)
  })

  test('橡皮擦基础 — 擦除后笔画数减少', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawStroke(page, [
      { x: 100, y: 150 },
      { x: 150, y: 130 },
      { x: 200, y: 160 },
    ])
    await drawStroke(page, [
      { x: 100, y: 220 },
      { x: 150, y: 200 },
      { x: 200, y: 230 },
    ])
    const before = await getStrokeCount(page)
    expect(before).toBe(2)

    await selectTool(page, '橡皮')
    await drawStroke(page, [
      { x: 90, y: 145 },
      { x: 210, y: 165 },
    ])
    await page.waitForTimeout(200)
    const after = await getStrokeCount(page)
    expect(after).toBeLessThan(before)
  })

  test('橡皮擦空画布 — 擦除不崩溃且笔画数保持 0', async ({ page }) => {
    const before = await getStrokeCount(page)
    expect(before).toBe(0)

    await selectTool(page, '橡皮')
    await drawStroke(page, [
      { x: 100, y: 150 },
      { x: 200, y: 150 },
    ])
    await page.waitForTimeout(200)
    const after = await getStrokeCount(page)
    expect(after).toBe(0)
  })

  test('撤销单笔 — 撤销后笔画数为 0', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawStroke(page, [
      { x: 100, y: 150 },
      { x: 200, y: 150 },
    ])
    expect(await getStrokeCount(page)).toBe(1)

    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(100)
    expect(await getStrokeCount(page)).toBe(0)
  })

  test('撤销多笔 — 撤销两次后笔画数为 1', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawMultipleStrokes(page, 3)
    expect(await getStrokeCount(page)).toBe(3)

    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(100)
    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(100)
    expect(await getStrokeCount(page)).toBe(1)
  })

  test('重做 — 撤销后重做恢复笔画数为 1', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawStroke(page, [
      { x: 100, y: 150 },
      { x: 200, y: 150 },
    ])
    expect(await getStrokeCount(page)).toBe(1)

    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(100)
    expect(await getStrokeCount(page)).toBe(0)

    await clickStatusBarButton(page, '↪ 恢复')
    await page.waitForTimeout(100)
    expect(await getStrokeCount(page)).toBe(1)
  })

  test('撤销按钮禁用态 — 空画布时撤销按钮 disabled', async ({ page }) => {
    const undoBtn = page.locator('.statusbar .action-btn', { hasText: '↩ 撤销' })
    await expect(undoBtn).toBeDisabled()
  })

  test('重做按钮禁用态 — 空画布时恢复按钮 disabled', async ({ page }) => {
    const redoBtn = page.locator('.statusbar .action-btn', { hasText: '↪ 恢复' })
    await expect(redoBtn).toBeDisabled()
  })

  test('撤销后新绘制清除重做栈 — 绘制新笔后恢复按钮 disabled', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawMultipleStrokes(page, 2)
    expect(await getStrokeCount(page)).toBe(2)

    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(100)

    await drawStroke(page, [
      { x: 100, y: 300 },
      { x: 200, y: 300 },
    ])
    await page.waitForTimeout(100)

    const redoBtn = page.locator('.statusbar .action-btn', { hasText: '↪ 恢复' })
    await expect(redoBtn).toBeDisabled()
  })

  test('清空画布 — 点击清空后笔画数为 0', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawMultipleStrokes(page, 3)
    expect(await getStrokeCount(page)).toBe(3)

    await clickStatusBarButton(page, '清空')
    await page.waitForTimeout(100)
    expect(await getStrokeCount(page)).toBe(0)
  })

  test('清空后撤销恢复 — 清空后撤销笔画数恢复为 3', async ({ page }) => {
    await selectTool(page, '钢笔')
    await drawMultipleStrokes(page, 3)
    expect(await getStrokeCount(page)).toBe(3)

    await clickStatusBarButton(page, '清空')
    await page.waitForTimeout(100)
    expect(await getStrokeCount(page)).toBe(0)

    await clickStatusBarButton(page, '↩ 撤销')
    await page.waitForTimeout(100)
    expect(await getStrokeCount(page)).toBe(3)
  })
})
