import { expect, test } from '@playwright/test'
import fs from 'node:fs'
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

test('e2e download metadata defaults off while preview keeps source map for clickback', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Keep source map')).not.toBeChecked()
  const previewHtml = await page.locator('iframe[title="HTML projection preview"]').getAttribute('srcdoc')
  expect(previewHtml).toContain('data-source-blocks')

  const [withoutMetadata] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download HTML' }).click(),
  ])
  const withoutPath = await withoutMetadata.path()
  expect(withoutPath).toBeTruthy()
  expect(fs.readFileSync(withoutPath!, 'utf8')).not.toContain('data-source-blocks')

  await page.getByLabel('Keep source map').check()
  const [withMetadata] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download HTML' }).click(),
  ])
  expect(withMetadata.suggestedFilename()).toBe('md2html.html')
  const withPath = await withMetadata.path()
  expect(withPath).toBeTruthy()
  expect(fs.readFileSync(withPath!, 'utf8')).toContain('data-source-blocks')
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


test('e2e non-faithful preset applies a local model render plan through the server bridge', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Preset').selectOption('brief')
  await expect(page.getByTestId('model-status')).toContainText('Applied(mock)', { timeout: 10_000 })
  await expect(page.frameLocator('iframe[title="HTML projection preview"]').locator('[data-render-node]').first()).toBeVisible()
})

test('e2e editor uses CodeMirror with line numbers and persists local markdown', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.cm-editor')).toBeVisible()
  await expect(page.locator('.cm-lineNumbers')).toBeVisible()
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.type('# Persisted\n\nLocal draft')
  await expect(page.frameLocator('iframe[title="HTML projection preview"]').locator('h1')).toHaveText('Persisted')
  await page.reload()
  await expect(page.locator('.cm-content')).toContainText('Persisted')
  await expect(page.frameLocator('iframe[title="HTML projection preview"]').locator('h1')).toHaveText('Persisted')
})

test('e2e UI language persists across reloads', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('UI').selectOption('zh')
  await expect(page.getByLabel('上传')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('上传')).toBeVisible()
})

test('e2e copy HTML writes export HTML without metadata by default', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('button', { name: 'Copy HTML' }).click()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('<!doctype html>')
  expect(copied).not.toContain('data-source-blocks')
})

test('e2e text-only edit reuses model plan without calling render-plan API', async ({ page }) => {
  const readme = fs.readFileSync(path.resolve('fixtures/inputs/readme.md'), 'utf8')
  let renderPlanRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/render-plan')) renderPlanRequests += 1
  })
  await page.goto('/')
  await page.getByLabel('Markdown source').fill(readme)
  await page.getByLabel('Preset').selectOption('brief')
  await expect(page.getByTestId('model-status')).toContainText('Applied(mock)', { timeout: 10_000 })
  renderPlanRequests = 0
  await page.getByLabel('Markdown source').fill(readme.replace('适合写', '适合继续写'))
  await page.waitForTimeout(900)
  expect(renderPlanRequests).toBe(0)
})

test('e2e structural edit and regenerate button call render-plan API', async ({ page }) => {
  let renderPlanRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/render-plan')) renderPlanRequests += 1
  })
  await page.goto('/')
  await page.getByLabel('Preset').selectOption('brief')
  await expect(page.getByTestId('model-status')).toContainText('Applied(mock)', { timeout: 10_000 })
  const afterInitial = renderPlanRequests
  await page.getByLabel('Markdown source').fill(`${fs.readFileSync(path.resolve('fixtures/inputs/readme.md'), 'utf8')}\n\n新增结构段落。`)
  await expect.poll(() => renderPlanRequests).toBeGreaterThan(afterInitial)
  const afterStructural = renderPlanRequests
  await page.getByRole('button', { name: 'Regenerate layout' }).click()
  await expect.poll(() => renderPlanRequests).toBeGreaterThan(afterStructural)
})

test('e2e load sample uses current UI language without auto-rewriting on UI switch', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('UI').selectOption('zh')
  await page.getByRole('button', { name: '载入示例' }).click()
  await expect(page.locator('.cm-content')).toContainText('Markdown 适合写')
  const zhPreview = await page.locator('iframe[title="HTML projection preview"]').getAttribute('srcdoc')
  await page.getByLabel('界面').selectOption('en')
  const afterSwitch = await page.locator('iframe[title="HTML projection preview"]').getAttribute('srcdoc')
  expect(afterSwitch).toBe(zhPreview)
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page.locator('.cm-content')).toContainText('Markdown is for editing')
})


test('e2e content language switch triggers render-plan API in non-faithful mode', async ({ page }) => {
  let renderPlanRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/render-plan')) renderPlanRequests += 1
  })
  await page.goto('/')
  await page.getByLabel('Preset').selectOption('brief')
  await expect(page.getByTestId('model-status')).toContainText('Applied(mock)', { timeout: 10_000 })
  const afterInitial = renderPlanRequests
  await page.getByLabel('Content').selectOption('zh')
  await expect.poll(() => renderPlanRequests).toBeGreaterThan(afterInitial)
})
