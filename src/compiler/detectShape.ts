import type { SourceBlock } from './types'

export function detectShape(blocks: SourceBlock[]): string {
  return blocks.map((block) => block.type === 'heading' ? `${block.type}:${block.depth ?? 0}` : block.type).join('|')
}
