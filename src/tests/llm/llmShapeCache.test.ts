import fs from 'node:fs'
import { describe, expect, test, vi } from 'vitest'
import { compileMarkdownToHtml, createCompileCache } from '../../compiler/compileMarkdown'
import type { LlmClient } from '../../compiler/llmClient'

const md = () => fs.readFileSync('fixtures/inputs/readme.md', 'utf8')
const options = { logic: 'result-first', density: 'compact', theme: 'dense-brief', contentLanguage: 'zh', includeSourceMetadata: true } as const

describe('LLM shape and cache gates', () => {
  test('LLM failure falls back to faithful render plan', () => {
    const llm: LlmClient = { invoke: vi.fn(() => { throw new Error('429 rate limited') }) }
    const result = compileMarkdownToHtml(md(), options, { llm })

    expect(llm.invoke).toHaveBeenCalledTimes(1)
    expect(result.fellBackToFaithful).toBe(true)
    expect(result.renderPlan.logic).toBe('none')
  })

  test('text-only edit reuses last render plan and does not invoke LLM', () => {
    const llm: LlmClient = { invoke: vi.fn((request) => request.fallbackPlan) }
    const first = compileMarkdownToHtml(md(), options, { llm })
    vi.mocked(llm.invoke).mockClear()

    const edited = md().replace('适合写', '适合继续写')
    const second = compileMarkdownToHtml(edited, options, { llm, lastResult: first })

    expect(llm.invoke).not.toHaveBeenCalled()
    expect(second.renderPlan).toBe(first.renderPlan)
  })

  test('structural edit invokes LLM once', () => {
    const llm: LlmClient = { invoke: vi.fn((request) => request.fallbackPlan) }
    const first = compileMarkdownToHtml(md(), options, { llm })
    vi.mocked(llm.invoke).mockClear()

    compileMarkdownToHtml(`${md()}\n\n新增一段。`, options, { llm, lastResult: first })

    expect(llm.invoke).toHaveBeenCalledTimes(1)
  })

  test('undo structural edit hits cache and does not invoke LLM again', () => {
    const llm: LlmClient = { invoke: vi.fn((request) => request.fallbackPlan) }
    const cache = createCompileCache()
    compileMarkdownToHtml(md(), options, { llm, cache })
    compileMarkdownToHtml(`${md()}\n\n新增一段。`, options, { llm, cache })
    vi.mocked(llm.invoke).mockClear()

    compileMarkdownToHtml(md(), options, { llm, cache })

    expect(llm.invoke).not.toHaveBeenCalled()
  })

  test('content language change misses cache and invokes LLM', () => {
    const llm: LlmClient = { invoke: vi.fn((request) => request.fallbackPlan) }
    const cache = createCompileCache()
    compileMarkdownToHtml(md(), { ...options, contentLanguage: 'zh' }, { llm, cache })
    vi.mocked(llm.invoke).mockClear()

    compileMarkdownToHtml(md(), { ...options, contentLanguage: 'en' }, { llm, cache })

    expect(llm.invoke).toHaveBeenCalledTimes(1)
  })

  test('renderPlanOverride renders a server-provided model plan without invoking local compiler LLM', () => {
    const llm: LlmClient = { invoke: vi.fn((request) => request.fallbackPlan) }
    const fallback = compileMarkdownToHtml(md(), options)
    const overridePlan = {
      ...fallback.renderPlan,
      nodes: fallback.renderPlan.nodes.map((node, index) => index === 0 ? { ...node, title: 'server model plan' } : node),
    }

    const result = compileMarkdownToHtml(md(), options, { llm, renderPlanOverride: overridePlan })

    expect(llm.invoke).not.toHaveBeenCalled()
    expect(result.renderPlan.nodes[0].title).toBe('server model plan')
  })
})
