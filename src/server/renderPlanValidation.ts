import { getSkeleton } from '../skeletons'
import type { CompileOptions, RenderNode, RenderPlan, SourceBlock } from '../compiler/types'

export function validateRenderPlan(plan: RenderPlan, blocks: SourceBlock[], options: Pick<CompileOptions, 'logic' | 'density'>): string[] {
  const errors: string[] = []
  if (plan.logic !== options.logic) errors.push(`logic mismatch: ${plan.logic}`)
  if (plan.density !== options.density) errors.push(`density mismatch: ${plan.density}`)
  if (!Array.isArray(plan.nodes) || plan.nodes.length === 0) errors.push('plan has no nodes')

  const validBlockIds = new Set(blocks.map((block) => block.id))
  const skeletonKinds = new Set(getSkeleton(options.logic, options.density).regions.map((region) => region.kind))

  for (const node of plan.nodes || []) {
    if (!node.id) errors.push('node missing id')
    if (!skeletonKinds.has(node.kind)) errors.push(`kind not in skeleton: ${node.kind}`)
    if (!Array.isArray(node.sourceBlockIds) || node.sourceBlockIds.length === 0) errors.push(`node ${node.id} has no source blocks`)
    for (const id of node.sourceBlockIds || []) {
      if (!validBlockIds.has(id)) errors.push(`node ${node.id} references unknown source block ${id}`)
    }
    if (isAtomic(node) && node.sourceBlockIds.length !== 1) errors.push(`atomic node ${node.id} must reference exactly one source block`)
  }

  return errors
}

function isAtomic(node: RenderNode): boolean {
  return node.kind === 'quote' || node.kind === 'table' || node.kind === 'code'
}
