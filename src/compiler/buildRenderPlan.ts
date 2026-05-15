import { getSkeleton } from '../skeletons'
import { buildRenderPlanFaithful } from './buildRenderPlanFaithful'
import type { CompileOptions, RenderNode, RenderPlan, SourceBlock, SourceBlockType } from './types'

export function buildRenderPlan(blocks: SourceBlock[], options: Pick<CompileOptions, 'logic' | 'density'>): RenderPlan {
  if (options.logic === 'none') return buildRenderPlanFaithful(blocks, options)

  const skeleton = getSkeleton(options.logic, options.density)
  const used = new Set<string>()
  const nodes: RenderNode[] = []

  for (const region of skeleton.regions) {
    const selected = selectRegionBlocks(region.role, blocks, used)
    if (!selected.length) continue

    if (region.kind === 'quote' || region.kind === 'table' || region.kind === 'code') {
      for (const block of selected.filter((block) => atomicTypeForKind(region.kind).includes(block.type))) {
        used.add(block.id)
        nodes.push({ id: `node-${region.id}-${block.id}`, kind: region.kind, sourceBlockIds: [block.id], title: block.text })
      }
      continue
    }

    for (const block of selected) used.add(block.id)
    nodes.push({
      id: `node-${region.id}`,
      kind: region.kind,
      sourceBlockIds: selected.map((block) => block.id),
      title: selected[0]?.text,
    })
  }

  const remaining = blocks.filter((block) => !used.has(block.id))
  if (remaining.length) {
    nodes.push({ id: 'node-appendix-rest', kind: options.logic === 'narrative' ? 'appendix' : 'section', sourceBlockIds: remaining.map((block) => block.id), title: 'More' })
  }

  return { logic: options.logic, density: options.density, nodes }
}

function selectRegionBlocks(role: string, blocks: SourceBlock[], used: Set<string>): SourceBlock[] {
  const available = blocks.filter((block) => !used.has(block.id))
  if (role === 'title') return available.filter((block) => block.type === 'heading' && block.depth === 1).slice(0, 1)
  if (role === 'summary') return available.filter((block) => ['quote', 'paragraph'].includes(block.type)).slice(0, 3)
  if (role === 'evidence') return available.filter((block) => ['list', 'quote'].includes(block.type)).slice(0, 3)
  if (role === 'reference') return available.filter((block) => ['table', 'code'].includes(block.type)).slice(0, 3)
  return available.filter((block) => ['heading', 'paragraph', 'list'].includes(block.type)).slice(0, 12)
}

function atomicTypeForKind(kind: RenderNode['kind']): SourceBlockType[] {
  if (kind === 'quote') return ['quote']
  if (kind === 'table') return ['table']
  if (kind === 'code') return ['code']
  return []
}
