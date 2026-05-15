import { buildRenderPlan } from '../compiler/buildRenderPlan'
import { extractSourceBlocks } from '../compiler/extractSourceBlocks'
import type { CompileOptions, RenderPlan, SourceBlock } from '../compiler/types'
import { createConfiguredLocalCliClient } from './localCliLlm'
import { validateRenderPlan } from './renderPlanValidation'

export type AsyncLlmRequest = {
  sourceBlocks: SourceBlock[]
  fallbackPlan: RenderPlan
  options: CompileOptions
}

export type AsyncLlmClient = {
  providerName?: string
  invoke(request: AsyncLlmRequest): Promise<RenderPlan>
}

export type RenderPlanApiRequest = {
  markdown: string
  options: CompileOptions
}

export type RenderPlanApiResponse = {
  plan: RenderPlan
  provider: string
  usedModel: boolean
  fellBack: boolean
  error?: string
}

export async function renderPlanForRequest(request: RenderPlanApiRequest, client?: AsyncLlmClient): Promise<RenderPlanApiResponse> {
  const sourceBlocks = extractSourceBlocks(request.markdown)
  const fallbackPlan = buildRenderPlan(sourceBlocks, request.options)

  if (request.options.logic === 'none') {
    return { plan: fallbackPlan, provider: 'deterministic', usedModel: false, fellBack: false }
  }

  const llm = client ?? createConfiguredLocalCliClient()
  if (!llm) {
    return { plan: fallbackPlan, provider: 'none', usedModel: false, fellBack: true, error: 'No local model provider configured or detected' }
  }

  try {
    const modelPlan = await llm.invoke({ sourceBlocks, fallbackPlan, options: request.options })
    const errors = validateRenderPlan(modelPlan, sourceBlocks, request.options)
    if (errors.length) {
      return { plan: fallbackPlan, provider: llm.providerName ?? 'injected', usedModel: false, fellBack: true, error: errors.join('; ') }
    }
    return { plan: modelPlan, provider: llm.providerName ?? 'injected', usedModel: true, fellBack: false }
  } catch (error) {
    return { plan: fallbackPlan, provider: llm.providerName ?? 'injected', usedModel: false, fellBack: true, error: error instanceof Error ? error.message : String(error) }
  }
}
