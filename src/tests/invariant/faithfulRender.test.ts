import fs from 'node:fs'
import { describe, expect, test } from 'vitest'
import { compileMarkdownToHtml } from '../../compiler/compileMarkdown'

const readmeMd = () => fs.readFileSync('fixtures/inputs/readme.md', 'utf8')

describe('Faithful render pipeline', () => {
  test('renders one tagged outer element for every render plan node', () => {
    const result = compileMarkdownToHtml(readmeMd(), {
      logic: 'none',
      density: 'comfortable',
      theme: 'editorial-light',
      contentLanguage: 'zh',
      includeSourceMetadata: true,
    })

    const taggedElements = [...result.html.matchAll(/data-render-node="([^"]+)"/g)]
    const sourceAttributes = [...result.html.matchAll(/data-source-blocks="([^"]+)"/g)]

    expect(taggedElements).toHaveLength(result.renderPlan.nodes.length)
    expect(sourceAttributes).toHaveLength(result.renderPlan.nodes.length)

    const validIds = new Set(result.sourceBlocks.map((block) => block.id))
    for (const [, ids] of sourceAttributes) {
      for (const id of ids.split(' ').filter(Boolean)) {
        expect(validIds.has(id)).toBe(true)
      }
    }
  })

  test('quote, table, and code render nodes remain atomic', () => {
    const result = compileMarkdownToHtml(readmeMd(), {
      logic: 'none',
      density: 'comfortable',
      theme: 'editorial-light',
      contentLanguage: 'zh',
      includeSourceMetadata: true,
    })

    for (const node of result.renderPlan.nodes) {
      if (['quote', 'table', 'code'].includes(node.kind)) {
        expect(node.sourceBlockIds).toHaveLength(1)
      }
    }
  })

  test('source metadata can be stripped for exported reader HTML', () => {
    const result = compileMarkdownToHtml(readmeMd(), {
      logic: 'none',
      density: 'comfortable',
      theme: 'editorial-light',
      contentLanguage: 'zh',
      includeSourceMetadata: false,
    })

    expect(result.html).toContain('<!doctype html>')
    expect(result.html).toContain('<html lang="zh"')
    expect(result.html).not.toMatch(/data-source-blocks/)
    expect(result.html).not.toMatch(/data-render-node/)
  })
})
