import type { DensityId, LogicId, RenderNodeKind } from '../compiler/types'

export type SkeletonRegion = {
  id: string
  kind: RenderNodeKind
  required: boolean
  role: 'title' | 'summary' | 'evidence' | 'body' | 'reference'
}

export type SkeletonConfig = {
  logic: LogicId
  density: DensityId
  regions: SkeletonRegion[]
}
