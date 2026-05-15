import fs from 'node:fs'
import { describe, expect, test } from 'vitest'
import expectedShape from '../../../fixtures/expected/readme.shape.json'
import { extractSourceBlocks } from '../../compiler/extractSourceBlocks'

describe('SourceBlock slicing', () => {
  test('readme.md yields the documented 48-block shape', () => {
    const md = fs.readFileSync('fixtures/inputs/readme.md', 'utf8')
    const blocks = extractSourceBlocks(md)

    expect(blocks).toHaveLength(48)
    expect(
      blocks.map((block) => ({
        type: block.type,
        ...(block.depth ? { depth: block.depth } : {}),
        ...(block.ordered ? { ordered: block.ordered } : {}),
      })),
    ).toEqual(expectedShape)
  })

  test('each source block has stable id, source span, and raw content', () => {
    const md = fs.readFileSync('fixtures/inputs/readme.md', 'utf8')
    const blocks = extractSourceBlocks(md)

    for (const [index, block] of blocks.entries()) {
      expect(block.id).toBe(`block-${index}`)
      expect(block.startLine).toBeGreaterThan(0)
      expect(block.endLine).toBeGreaterThanOrEqual(block.startLine)
      expect(block.startOffset).toBeGreaterThanOrEqual(0)
      expect(block.endOffset).toBeGreaterThan(block.startOffset)
      expect(md.slice(block.startOffset, block.endOffset)).toBe(block.raw)
      expect(block.text.trim().length).toBeGreaterThan(0)
    }
  })
})
