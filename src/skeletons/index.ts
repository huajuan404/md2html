import type { DensityId, LogicId } from '../compiler/types'
import type { SkeletonConfig } from './types'

const baseRegions = {
  none: [
    { id: 'hero', kind: 'hero', required: true, role: 'title' },
    { id: 'quote', kind: 'quote', required: false, role: 'summary' },
    { id: 'body', kind: 'section', required: true, role: 'body' },
    { id: 'list', kind: 'card', required: false, role: 'body' },
    { id: 'table', kind: 'table', required: false, role: 'reference' },
    { id: 'code', kind: 'code', required: false, role: 'reference' },
  ],
  'result-first': [
    { id: 'hero', kind: 'hero', required: true, role: 'title' },
    { id: 'summary', kind: 'summary', required: true, role: 'summary' },
    { id: 'evidence', kind: 'card', required: true, role: 'evidence' },
    { id: 'quote', kind: 'quote', required: false, role: 'evidence' },
    { id: 'table', kind: 'table', required: false, role: 'reference' },
    { id: 'details', kind: 'section', required: true, role: 'body' },
    { id: 'code', kind: 'code', required: false, role: 'reference' },
  ],
  narrative: [
    { id: 'hero', kind: 'hero', required: true, role: 'title' },
    { id: 'toc', kind: 'toc', required: false, role: 'summary' },
    { id: 'background', kind: 'section', required: true, role: 'body' },
    { id: 'timeline', kind: 'timeline', required: false, role: 'body' },
    { id: 'quote', kind: 'quote', required: false, role: 'evidence' },
    { id: 'table', kind: 'table', required: false, role: 'reference' },
    { id: 'code', kind: 'code', required: false, role: 'reference' },
    { id: 'appendix', kind: 'appendix', required: false, role: 'reference' },
  ],
} as const

function makeSkeleton(logic: LogicId, density: DensityId): SkeletonConfig {
  return {
    logic,
    density,
    regions: baseRegions[logic].map((region) => ({ ...region })),
  }
}

export const skeletons = Object.fromEntries(
  (['none', 'result-first', 'narrative'] as const).flatMap((logic) =>
    (['comfortable', 'compact', 'per-screen'] as const).map((density) => [`${logic}:${density}`, makeSkeleton(logic, density)]),
  ),
) as Record<`${LogicId}:${DensityId}`, SkeletonConfig>

export function getSkeleton(logic: LogicId, density: DensityId): SkeletonConfig {
  return skeletons[`${logic}:${density}`]
}
