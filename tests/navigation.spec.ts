import { expect, test } from '@playwright/test'
import { expectSelectedTreeItem, loadViaTextarea, nestedXml } from './helpers'

test.describe('navigation and shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await loadViaTextarea(page, nestedXml)
  })

  test('supports keyboard tree navigation and expand-collapse controls', async ({ page }) => {
    const tree = page.getByRole('tree')
    await tree.focus()

    let selected = page.locator('[role="treeitem"][aria-selected="true"]')
    await expectSelectedTreeItem(selected, /catalog/i)

    await tree.press('ArrowDown')
    selected = page.locator('[role="treeitem"][aria-selected="true"]')
    await expectSelectedTreeItem(selected, /@attributes/i)

    await tree.press('ArrowDown')
    selected = page.locator('[role="treeitem"][aria-selected="true"]')
    await expectSelectedTreeItem(selected, /region/i)

    await tree.press('End')
    selected = page.locator('[role="treeitem"][aria-selected="true"]')
    await expect(selected).toContainText(/chapters/i)

    const chapterRow = page.getByRole('button', { name: /^element chapter 1 child/i })

    await page.keyboard.press('Shift+E')
    await expect(chapterRow).toBeVisible()

    await page.keyboard.press('Shift+C')
    await expect(chapterRow).toHaveCount(0)
  })

  test('toggles expansion from anywhere on the row and omits chevrons for leaf nodes', async ({
    page,
  }) => {
    const bookRow = page.getByRole('button', { name: /^element book 1 attr · 2 child/i })
    const chaptersRow = page.getByRole('button', { name: /^element chapters 1 child/i })
    const regionAttributeRow = page.getByRole('button', { name: /^attribute region west/i })

    await expect(chaptersRow).toBeVisible()
    await expect(regionAttributeRow.locator('.tree-row__chevron')).toHaveCount(0)

    await bookRow.click()
    await expect(chaptersRow).toHaveCount(0)

    await bookRow.click()
    await expect(chaptersRow).toBeVisible()
  })

  test('supports search focus, search result navigation, stats toggle, and shortcut help', async ({
    page,
  }) => {
    const tree = page.getByRole('tree')

    await tree.focus()
    await tree.press('/')
    const search = page.getByPlaceholder('Search tags, attributes, or text')
    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.getAttribute('placeholder')))
      .toBe('Search tags, attributes, or text')

    await search.fill('chapter')
    await search.focus()
    await page.keyboard.type('i/')
    await expect(search).toHaveValue('chapteri/')
    await expect(page.locator('.stats-dock')).toBeVisible()
    await expect(page.locator('.shortcut-popover')).toHaveCount(0)

    await search.fill('chapter')
    await expect(page.getByText('1/2')).toBeVisible()

    await search.press('Enter')
    await expect(page.locator('[role="treeitem"][aria-selected="true"]')).toContainText(/name|chapter/i)

    await page.getByRole('tree').click()
    await page.keyboard.press('I')
    await expect(page.getByRole('button', { name: 'Show stats' })).toBeVisible()

    await page.keyboard.press('I')
    await expect(page.locator('.stats-dock')).toBeVisible()

    await page.keyboard.press('?')
    const shortcutPopover = page.locator('.shortcut-popover')
    await expect(shortcutPopover).toBeVisible()
    await shortcutPopover.press('Escape')
    await expect(shortcutPopover).toHaveCount(0)
  })
})
