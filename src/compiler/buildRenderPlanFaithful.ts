import type { CompileOptions, RenderNode, RenderNodeKind, RenderPlan, SourceBlock } from './types'

export function buildRenderPlanFaithful(blocks: SourceBlock[], options: Pick<CompileOptions, 'density'>): RenderPlan {
  return {
    logic: 'none',
    density: options.density,
    nodes: blocks.map((block): RenderNode => ({
      id: `node-${block.id}`,
      kind: blockToRenderKind(block),
      sourceBlockIds: [block.id],
      title: block.type === 'heading' ? block.text : undefined,
    })),
  }
}

function blockToRenderKind(block: SourceBlock): RenderNodeKind {
  if (block.type === 'heading' && block.depth === 1) return 'hero'
  if (block.type === 'quote') return 'quote'
  if (block.type === 'table') return 'table'
  if (block.type === 'code') return 'code'
  if (block.type === 'list') return 'card'
  return 'section'
}
