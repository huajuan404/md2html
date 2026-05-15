import type { SourceBlock, SourceBlockType } from './types'

type Line = {
  raw: string
  startOffset: number
  endOffset: number
}

export function extractSourceBlocks(markdown: string): SourceBlock[] {
  const lines = splitLines(markdown)
  const blocks: SourceBlock[] = []
  const headingStack: Array<{ depth: number; id: string }> = []
  let index = 0

  while (index < lines.length) {
    if (isBlank(lines[index].raw)) {
      index += 1
      continue
    }

    const start = index
    const first = lines[index].raw
    let end = index
    let type: SourceBlockType = 'paragraph'
    let depth: number | undefined
    let ordered: boolean | undefined

    const heading = first.match(/^(#{1,6})\s+(.+)\s*$/)
    if (heading) {
      type = 'heading'
      depth = heading[1].length
    } else if (/^```/.test(first.trim())) {
      type = 'code'
      end = consumeFencedCode(lines, index)
    } else if (/^>\s?/.test(first)) {
      type = 'quote'
      end = consumeWhile(lines, index, (line) => /^>\s?/.test(line.raw) || isBlank(line.raw))
    } else if (isTableStart(lines, index)) {
      type = 'table'
      end = consumeWhile(lines, index, (line) => isTableLine(line.raw))
    } else if (isListItem(first)) {
      type = 'list'
      ordered = isOrderedListItem(first)
      end = consumeWhile(lines, index, (line) => isListItem(line.raw) || isIndentedContinuation(line.raw) || isBlank(line.raw))
    } else if (/^---+$/.test(first.trim()) || /^\*\*\*+$/.test(first.trim())) {
      type = 'thematicBreak'
    } else if (/^<[^>]+>/.test(first.trim())) {
      type = 'html'
      end = consumeParagraph(lines, index)
    } else {
      type = 'paragraph'
      end = consumeParagraph(lines, index)
    }

    end = trimTrailingBlank(lines, start, end)
    const raw = sliceRaw(markdown, lines[start].startOffset, lines[end].endOffset)
    const block: SourceBlock = {
      id: `block-${blocks.length}`,
      type,
      startLine: start + 1,
      endLine: end + 1,
      startOffset: lines[start].startOffset,
      endOffset: lines[end].endOffset,
      raw,
      text: toPlainText(raw, type),
      ...(depth ? { depth } : {}),
      ...(ordered ? { ordered } : {}),
    }

    const parentHeadingId = currentParentHeading(headingStack, depth)
    if (parentHeadingId) {
      block.parentHeadingId = parentHeadingId
    }

    blocks.push(block)

    if (type === 'heading' && depth) {
      while (headingStack.length && headingStack[headingStack.length - 1].depth >= depth) {
        headingStack.pop()
      }
      headingStack.push({ depth, id: block.id })
    }

    index = end + 1
  }

  return blocks
}

function splitLines(input: string): Line[] {
  const matches = input.matchAll(/.*(?:\r?\n|$)/g)
  const lines: Line[] = []
  for (const match of matches) {
    const rawWithBreak = match[0]
    if (rawWithBreak === '') continue
    const startOffset = match.index ?? 0
    const raw = rawWithBreak.replace(/\r?\n$/, '')
    lines.push({ raw, startOffset, endOffset: startOffset + raw.length })
  }
  return lines
}

function isBlank(line: string): boolean {
  return /^\s*$/.test(line)
}

function consumeFencedCode(lines: Line[], start: number): number {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^```/.test(lines[index].raw.trim())) return index
  }
  return lines.length - 1
}

function consumeWhile(lines: Line[], start: number, predicate: (line: Line) => boolean): number {
  let end = start
  for (let index = start + 1; index < lines.length; index += 1) {
    if (!predicate(lines[index])) break
    end = index
  }
  return end
}

function consumeParagraph(lines: Line[], start: number): number {
  let end = start
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].raw
    if (isBlank(line) || startsBlock(line, lines, index)) break
    end = index
  }
  return end
}

function startsBlock(line: string, lines: Line[], index: number): boolean {
  return (
    /^(#{1,6})\s+/.test(line) ||
    /^```/.test(line.trim()) ||
    /^>\s?/.test(line) ||
    isTableStart(lines, index) ||
    isListItem(line) ||
    /^---+$/.test(line.trim()) ||
    /^\*\*\*+$/.test(line.trim())
  )
}

function isTableStart(lines: Line[], index: number): boolean {
  return Boolean(lines[index + 1] && isTableLine(lines[index].raw) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1].raw))
}

function isTableLine(line: string): boolean {
  return line.includes('|') && !isBlank(line)
}

function isListItem(line: string): boolean {
  return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)
}

function isOrderedListItem(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line)
}

function isIndentedContinuation(line: string): boolean {
  return /^\s{2,}\S/.test(line)
}

function trimTrailingBlank(lines: Line[], start: number, end: number): number {
  while (end > start && isBlank(lines[end].raw)) end -= 1
  return end
}

function sliceRaw(markdown: string, startOffset: number, endOffset: number): string {
  return markdown.slice(startOffset, endOffset)
}

function toPlainText(raw: string, type: SourceBlockType): string {
  let text = raw
  if (type === 'heading') text = text.replace(/^#{1,6}\s+/, '')
  if (type === 'quote') text = text.replace(/^>\s?/gm, '')
  if (type === 'list') text = text.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, '')
  if (type === 'code') text = text.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '')
  if (type === 'table') text = text.replace(/\|/g, ' ')
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function currentParentHeading(headingStack: Array<{ depth: number; id: string }>, depth?: number): string | undefined {
  if (!headingStack.length) return undefined
  if (!depth) return headingStack[headingStack.length - 1].id
  for (let index = headingStack.length - 1; index >= 0; index -= 1) {
    if (headingStack[index].depth < depth) return headingStack[index].id
  }
  return undefined
}
