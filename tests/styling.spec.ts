import { expect, test } from '@playwright/test'
import { loadViaTextarea } from './helpers'

test.describe('styling and layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('uses the intended floating stats layout and visual shell after load', async ({ page }) => {
    await loadViaTextarea(page)

    const statsDock = page.locator('.stats-dock')
    const themeButton = page.getByRole('button', {
      name: /Switch to dark theme|Switch to light theme/,
    })

    await expect(statsDock).toHaveCSS('position', 'fixed')
    await expect(page.locator('body')).not.toHaveCSS('background-image', 'none')
    await expect(page.locator('.hero-panel')).toHaveClass(/hero-panel--collapsed/)

    const statsBox = await statsDock.boundingBox()
    const themeBox = await themeButton.boundingBox()

    expect(statsBox).not.toBeNull()
    expect(themeBox).not.toBeNull()

    if (statsBox && themeBox) {
      expect(statsBox.width).toBeLessThanOrEqual(320)
      expect(statsBox.y).toBeGreaterThan(themeBox.y + themeBox.height)
    }
  })

  test('switches themes and updates the document theme attribute', async ({ page }) => {
    const html = page.locator('html')
    const toggle = page.getByRole('button', {
      name: /Switch to dark theme|Switch to light theme/,
    })

    const previousTheme = await html.getAttribute('data-theme')
    await toggle.click()
    await expect(html).toHaveAttribute(
      'data-theme',
      previousTheme === 'dark' ? 'light' : 'dark',
    )
  })

  test('keeps values visually close to their keys for glanceable rows', async ({ page }) => {
    await loadViaTextarea(page)

    const authorRow = page.getByRole('button', {
      name: /^element author Gambardella, Matthew/i,
    })
    const label = authorRow.locator('.tree-row__label')
    const value = authorRow.locator('.tree-row__value')

    const labelBox = await label.boundingBox()
    const valueBox = await value.boundingBox()

    expect(labelBox).not.toBeNull()
    expect(valueBox).not.toBeNull()

    if (labelBox && valueBox) {
      expect(valueBox.x).toBeGreaterThan(labelBox.x + labelBox.width)
      expect(valueBox.x - (labelBox.x + labelBox.width)).toBeLessThan(120)
    }
  })
})
