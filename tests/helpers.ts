import { expect, type Locator, type Page } from '@playwright/test'

export const sampleXml = `<?xml version="1.0"?>
<catalog region="west">
  <book id="bk101">
    <title>XML Developer's Guide</title>
    <author>Gambardella, Matthew</author>
  </book>
</catalog>`

export const nestedXml = `<?xml version="1.0"?>
<catalog region="west">
  <book id="bk101">
    <title>XML Developer's Guide</title>
    <chapters>
      <chapter>
        <name>Introduction</name>
      </chapter>
    </chapters>
  </book>
</catalog>`

export async function loadViaTextarea(page: Page, xml: string = sampleXml) {
  await page.getByLabel('XML input').fill(xml)
  await page.getByRole('button', { name: 'Parse XML' }).click()
  await expect(page.getByRole('tree')).toBeVisible()
}

export async function loadViaFileInput(
  page: Page,
  {
    fileName = 'catalog.xml',
    mimeType = 'application/xml',
    xml = sampleXml,
  }: { fileName?: string; mimeType?: string; xml?: string } = {},
) {
  await page.setInputFiles('input[type="file"]', {
    name: fileName,
    mimeType,
    buffer: Buffer.from(xml, 'utf8'),
  })

  await expect(page.getByRole('tree')).toBeVisible()
}

export async function loadViaDrop(page: Page, xml: string = sampleXml) {
  const dataTransfer = await page.evaluateHandle((payload) => {
    const transfer = new DataTransfer()
    const file = new File([payload.xml], payload.fileName, {
      type: 'application/xml',
    })
    transfer.items.add(file)
    return transfer
  }, {
    fileName: 'dragged.xml',
    xml,
  })

  await page.dispatchEvent('.app-shell', 'dragenter', { dataTransfer })
  await page.dispatchEvent('.app-shell', 'dragover', { dataTransfer })
  await page.dispatchEvent('.app-shell', 'drop', { dataTransfer })
  await expect(page.getByRole('tree')).toBeVisible()
}

export async function expectSelectedTreeItem(locator: Locator, pattern: RegExp) {
  await expect(locator).toHaveAttribute('aria-selected', 'true')
  await expect(locator).toContainText(pattern)
}
