import { buildRenderPlan } from './buildRenderPlan'
import { buildRenderPlanFaithful } from './buildRenderPlanFaithful'
import { detectShape } from './detectShape'
import { extractSourceBlocks } from './extractSourceBlocks'
import type { LlmClient } from './llmClient'
import { renderHtmlDocument } from './renderHtmlDocument'
import type { CompileOptions, CompileResult, RenderPlan } from './types'

export type CompileCache = Map<string, RenderPlan>

export type CompileContext = {
  llm?: LlmClient
  lastResult?: CompileResult
  cache?: CompileCache
  forceRelayout?: boolean
  renderPlanOverride?: RenderPlan
}

export function createCompileCache(): CompileCache {
  return new Map<string, RenderPlan>()
}

export function compileMarkdownToHtml(markdown: string, options: CompileOptions, context: CompileContext = {}): CompileResult {
  const sourceBlocks = extractSourceBlocks(markdown)
  const shape = detectShape(sourceBlocks)
  const lastShape = context.lastResult ? detectShape(context.lastResult.sourceBlocks) : undefined
  const cacheKey = `${shape}::${options.logic}::${options.density}::${options.contentLanguage}`

  let renderPlan: RenderPlan
  let fellBackToFaithful = false

  if (context.renderPlanOverride) {
    renderPlan = context.renderPlanOverride
  } else if (options.logic !== 'none' && context.lastResult && !context.forceRelayout && shape === lastShape) {
    renderPlan = context.lastResult.renderPlan
  } else if (options.logic !== 'none' && context.cache?.has(cacheKey)) {
    renderPlan = context.cache.get(cacheKey)!
  } else if (options.logic !== 'none' && context.llm) {
    const fallbackPlan = buildRenderPlan(sourceBlocks, options)
    try {
      renderPlan = context.llm.invoke({ sourceBlocks, fallbackPlan, options })
    } catch {
      renderPlan = buildRenderPlanFaithful(sourceBlocks, options)
      fellBackToFaithful = true
    }
    context.cache?.set(cacheKey, renderPlan)
  } else {
    renderPlan = buildRenderPlan(sourceBlocks, options)
    context.cache?.set(cacheKey, renderPlan)
  }

  const html = renderHtmlDocument(sourceBlocks, renderPlan, options)

  return {
    html,
    sourceBlocks,
    renderPlan,
    fellBackToFaithful,
  }
}
