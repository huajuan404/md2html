import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { compileMarkdownToHtml } from '../src/compiler/compileMarkdown'

const readmeMd = () => fs.readFileSync('fixtures/inputs/readme.md', 'utf8')

const visualCases = [
  {
    name: 'readme-reader',
    golden: 'fixtures/golden/readme-reader.html',
    options: { logic: 'narrative', density: 'comfortable', theme: 'editorial-light', contentLanguage: 'zh', includeSourceMetadata: true },
  },
  {
    name: 'readme-brief',
    golden: 'fixtures/golden/readme-brief.html',
    options: { logic: 'result-first', density: 'compact', theme: 'dense-brief', contentLanguage: 'zh', includeSourceMetadata: true },
  },
] as const

test('visual README golden audit renders comparable system and reference screenshots', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })

  for (const visualCase of visualCases) {
    const systemHtml = compileMarkdownToHtml(readmeMd(), visualCase.options).html
    const goldenHtml = fs.readFileSync(visualCase.golden, 'utf8')

    await page.setContent(systemHtml)
    await expect(page.locator('[data-render-node]').first()).toBeVisible()
    const systemShot = await page.screenshot({ fullPage: true })
    await testInfo.attach(`${visualCase.name}-system.png`, { body: systemShot, contentType: 'image/png' })

    await page.setContent(goldenHtml)
    await expect(page.locator('[data-render-node]').first()).toBeVisible()
    const goldenShot = await page.screenshot({ fullPage: true })
    await testInfo.attach(`${visualCase.name}-golden.png`, { body: goldenShot, contentType: 'image/png' })

    expect(systemShot.length).toBeGreaterThan(1_000)
    expect(goldenShot.length).toBeGreaterThan(1_000)
  }
})
