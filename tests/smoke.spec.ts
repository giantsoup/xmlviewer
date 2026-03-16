import { expect, test } from '@playwright/test'
import { loadViaTextarea } from './helpers'

test.describe('smoke', () => {
  test('renders the app shell and loads a document end to end', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Arbor XML Viewer' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Switch to dark theme|Switch to light theme/ })).toBeVisible()
    await expect(page.locator('.stats-dock')).toBeVisible()

    await loadViaTextarea(page)

    await expect(page.getByRole('button', { name: /element catalog/i })).toBeVisible()
    await expect(page.locator('.document-pill')).toContainText('Pasted XML')
    await expect(page.locator('.stats-grid__item').filter({ hasText: 'Root' })).toContainText('catalog')
    await expect(page.locator('.viewer-card')).toBeVisible()
  })
})
