import { expect, test } from '@playwright/test'
import { loadViaDrop, loadViaFileInput, loadViaTextarea, sampleXml } from './helpers'

test.describe('import methods', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('imports XML from the paste area and collapses the importer', async ({ page }) => {
    await loadViaTextarea(page, sampleXml)

    await expect(page.locator('.hero-panel')).toHaveClass(/hero-panel--collapsed/)
    await expect(page.getByRole('button', { name: 'Paste or replace' })).toBeVisible()
  })

  test('imports XML from the file input picker path', async ({ page }) => {
    await loadViaFileInput(page, { fileName: 'catalog.xml', xml: sampleXml })

    await expect(page.locator('.document-pill')).toContainText('catalog.xml')
    await expect(page.locator('.stats-grid__item').filter({ hasText: 'File' })).toContainText('catalog.xml')
  })

  test('imports XML from drag and drop', async ({ page }) => {
    await loadViaDrop(page, sampleXml)

    await expect(page.locator('.document-pill')).toContainText('dragged.xml')
    await expect(page.locator('.drop-overlay')).toHaveCount(0)
  })

  test('shows a clear error for malformed XML and keeps the tree hidden', async ({ page }) => {
    await page.getByLabel('XML input').fill('<catalog><book></catalog>')
    await page.getByRole('button', { name: 'Parse XML' }).click()

    await expect(page.getByRole('alert')).toContainText('XML parsing failed')
    await expect(page.getByRole('tree')).toHaveCount(0)
    await expect(page.getByLabel('XML input')).toHaveValue('<catalog><book></catalog>')
  })
})
