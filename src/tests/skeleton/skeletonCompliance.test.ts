import fs from 'node:fs'
import { describe, expect, test } from 'vitest'
import { compileMarkdownToHtml } from '../../compiler/compileMarkdown'
import type { DensityId, LogicId } from '../../compiler/types'
import { getSkeleton, skeletons } from '../../skeletons'

const readmeMd = () => fs.readFileSync('fixtures/inputs/readme.md', 'utf8')
const combinations: Array<[LogicId, DensityId]> = [
  ['none', 'comfortable'], ['none', 'compact'], ['none', 'per-screen'],
  ['result-first', 'comfortable'], ['result-first', 'compact'], ['result-first', 'per-screen'],
  ['narrative', 'comfortable'], ['narrative', 'compact'], ['narrative', 'per-screen'],
]

describe('skeleton registry', () => {
  test('contains all 9 logic-density skeletons', () => {
    expect(Object.keys(skeletons).sort()).toEqual(combinations.map(([logic, density]) => `${logic}:${density}`).sort())
  })

  test.each(combinations)('%s/%s render plan follows skeleton order and kinds', (logic, density) => {
    const skeleton = getSkeleton(logic, density)
    const result = compileMarkdownToHtml(readmeMd(), {
      logic,
      density,
      theme: 'editorial-light',
      contentLanguage: 'zh',
      includeSourceMetadata: true,
    })
    const allowedKinds = skeleton.regions.map((region) => region.kind)
    const actualKinds = result.renderPlan.nodes.map((node) => node.kind)

    for (const region of skeleton.regions.filter((region) => region.required)) {
      expect(actualKinds).toContain(region.kind)
    }
    for (const kind of actualKinds) {
      expect(allowedKinds).toContain(kind)
    }
    if (logic !== 'none') {
      expect(actualKinds.map((kind) => allowedKinds.indexOf(kind))).toEqual([...actualKinds.map((kind) => allowedKinds.indexOf(kind))].sort((a, b) => a - b))
    }
  })
})
