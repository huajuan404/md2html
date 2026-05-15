import { expect, test } from '@playwright/test'
import path from 'node:path'

test('e2e first open shows editor, preview, and full toolbar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Markdown source')).toContainText('# md2html')
  await expect(page.frameLocator('iframe[title="HTML projection preview"]').locator('h1')).toHaveText('md2html')
  for (const label of ['Upload', 'Preset', 'Logic', 'Density', 'Theme', 'UI', 'Content']) {
    await expect(page.getByLabel(label)).toBeVisible()
  }
  for (const name of ['Regenerate layout', 'Copy HTML', 'Download HTML']) {
    await expect(page.getByRole('button', { name })).toBeVisible()
  }
})

test('e2e paste and upload markdown refresh the preview', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByLabel('Markdown source')
  await editor.fill('# Tiny\n\nHello preview')
  await expect(page.frameLocator('iframe[title="HTML projection preview"]').locator('h1')).toHaveText('Tiny')
  await page.getByLabel('Upload').setInputFiles(path.resolve('fixtures/inputs/readme.md'))
  await expect(editor).toContainText('# md2html')
  await expect(page.frameLocator('iframe[title="HTML projection preview"]').locator('h1')).toHaveText('md2html')
})

test('e2e presets sync axes and manual axis switches to custom', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Preset').selectOption('brief')
  await expect(page.getByLabel('Logic')).toHaveValue('result-first')
  await expect(page.getByLabel('Density')).toHaveValue('compact')
  await expect(page.getByLabel('Theme')).toHaveValue('dense-brief')
  await page.getByLabel('Logic').selectOption('none')
  await expect(page.getByLabel('Preset')).toHaveValue('custom')
})

test('e2e download respects source metadata switch', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Keep source map').check()
  const [withMetadata] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download HTML' }).click(),
  ])
  expect(withMetadata.suggestedFilename()).toBe('md2html.html')
  const withText = await page.locator('iframe[title="HTML projection preview"]').getAttribute('srcdoc')
  expect(withText).toContain('data-source-blocks')

  await page.getByLabel('Keep source map').uncheck()
  const withoutText = await page.locator('iframe[title="HTML projection preview"]').getAttribute('srcdoc')
  expect(withoutText).not.toContain('data-source-blocks')
})

test('e2e clicking preview maps back to source lines', async ({ page }) => {
  await page.goto('/')
  const frame = page.frameLocator('iframe[title="HTML projection preview"]')
  await frame.locator('[data-render-node]').nth(1).click()
  await expect(page.getByTestId('source-selection-status')).toContainText('Lines')
})

test('e2e UI language switch does not change preview HTML', async ({ page }) => {
  await page.goto('/')
  const before = await page.locator('iframe[title="HTML projection preview"]').getAttribute('srcdoc')
  await page.getByLabel('UI').selectOption('zh')
  await expect(page.getByLabel('上传')).toBeVisible()
  const after = await page.locator('iframe[title="HTML projection preview"]').getAttribute('srcdoc')
  expect(after).toBe(before)
})
