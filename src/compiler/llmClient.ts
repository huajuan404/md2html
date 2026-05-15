import type { CompileOptions, RenderPlan, SourceBlock } from './types'

export type LlmRenderPlanRequest = {
  sourceBlocks: SourceBlock[]
  fallbackPlan: RenderPlan
  options: CompileOptions
}

export type LlmClient = {
  invoke(request: LlmRenderPlanRequest): RenderPlan
}
