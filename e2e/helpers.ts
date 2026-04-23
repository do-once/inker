import { type Page, expect } from '@playwright/test'

// 基础场景 URL
export const BASIC_URL = '/#/basic'
export const RECOGNITION_URL = '/#/recognition'

// 在画布上绘制一条笔画（通过 mouse 事件模拟）
export async function drawStroke(
  page: Page,
  points: Array<{ x: number; y: number }>,
  options?: { steps?: number }
) {
  if (points.length < 2) return
  const canvas = page.locator('.editor-container canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('画布未找到')

  const abs = (p: { x: number; y: number }) => ({
    x: box.x + p.x,
    y: box.y + p.y
  })

  const start = abs(points[0])
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()

  for (let i = 1; i < points.length; i++) {
    const pt = abs(points[i])
    await page.mouse.move(pt.x, pt.y, { steps: options?.steps ?? 5 })
  }

  await page.mouse.up()
  // 等一帧让渲染完成
  await page.waitForTimeout(100)
}

// 在画布上绘制多条笔画
export async function drawMultipleStrokes(
  page: Page,
  count: number,
  options?: { startX?: number; startY?: number; spacing?: number }
) {
  const startX = options?.startX ?? 100
  const startY = options?.startY ?? 100
  const spacing = options?.spacing ?? 40

  for (let i = 0; i < count; i++) {
    const y = startY + i * spacing
    await drawStroke(page, [
      { x: startX, y },
      { x: startX + 50, y: y + 10 },
      { x: startX + 100, y: y - 5 },
      { x: startX + 150, y }
    ])
  }
}

// 获取当前笔画数（从状态栏读取）
export async function getStrokeCount(page: Page): Promise<number> {
  const text = await page.locator('.info-item').first().textContent()
  const match = text?.match(/笔画:\s*(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

// 获取当前缩放百分比
export async function getZoomLevel(page: Page): Promise<number> {
  const text = await page.locator('.zoom-value').first().textContent()
  const match = text?.match(/(\d+)%/)
  return match ? parseInt(match[1], 10) : 100
}

// 选择工具
export async function selectTool(page: Page, toolName: string) {
  await page.locator('.tool-btn', { hasText: toolName }).click()
  await expect(
    page.locator('.tool-btn', { hasText: toolName })
  ).toHaveClass(/active/)
}

// 点击状态栏按钮
export async function clickStatusBarButton(page: Page, text: string) {
  await page.locator('.statusbar .action-btn', { hasText: text }).click()
}

// 等待画布就绪
export async function waitForCanvas(page: Page) {
  await page.locator('.editor-container canvas').first().waitFor({ state: 'visible' })
  await page.waitForTimeout(300)
}

// 展开浮动面板
export async function openFloatingPanel(page: Page) {
  const toggle = page.locator('.panel-toggle')
  if (await toggle.isVisible()) {
    await toggle.click()
    await page.locator('.panel-header').waitFor({ state: 'visible' })
  }
}

// 展开手风琴面板
export async function openAccordionSection(page: Page, sectionName: string) {
  const header = page.locator('.accordion-header', { hasText: sectionName })
  // 检查是否已展开（查看同级 content 是否可见）
  const item = header.locator('..')
  const content = item.locator('.accordion-content')
  if (!(await content.isVisible())) {
    await header.click()
    await content.waitFor({ state: 'visible' })
  }
}
