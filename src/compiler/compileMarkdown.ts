import { buildRenderPlanFaithful } from './buildRenderPlanFaithful'
import { extractSourceBlocks } from './extractSourceBlocks'
import { renderHtmlDocument } from './renderHtmlDocument'
import type { CompileOptions, CompileResult } from './types'

export function compileMarkdownToHtml(markdown: string, options: CompileOptions): CompileResult {
  const sourceBlocks = extractSourceBlocks(markdown)
  const renderPlan = buildRenderPlanFaithful(sourceBlocks, options)
  const html = renderHtmlDocument(sourceBlocks, renderPlan, options)

  return {
    html,
    sourceBlocks,
    renderPlan,
    fellBackToFaithful: options.logic !== 'none',
  }
}
