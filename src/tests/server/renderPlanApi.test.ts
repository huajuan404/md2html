import fs from 'node:fs'
import { describe, expect, test, vi } from 'vitest'
import type { RenderNode } from '../../compiler/types'
import { renderPlanForRequest, type AsyncLlmClient } from '../../server/renderPlanApi'

const markdown = () => fs.readFileSync('fixtures/inputs/readme.md', 'utf8')
const options = { logic: 'result-first', density: 'compact', theme: 'dense-brief', contentLanguage: 'zh', includeSourceMetadata: true } as const

describe('render plan API core', () => {
  test('uses an injected model client and returns a validated model plan', async () => {
    const client: AsyncLlmClient = {
      invoke: vi.fn(async ({ fallbackPlan }) => ({
        ...fallbackPlan,
        nodes: fallbackPlan.nodes.map((node: RenderNode, index: number) => index === 0 ? { ...node, title: '模型重排标题' } : node),
      })),
    }

    const response = await renderPlanForRequest({ markdown: markdown(), options }, client)

    expect(client.invoke).toHaveBeenCalledTimes(1)
    expect(response.usedModel).toBe(true)
    expect(response.provider).toBe('injected')
    expect(response.plan.nodes[0].title).toBe('模型重排标题')
  })

  test('falls back when model returns an invalid source block id', async () => {
    const client: AsyncLlmClient = {
      invoke: vi.fn(async ({ fallbackPlan }) => ({
        ...fallbackPlan,
        nodes: [{ id: 'bad-node', kind: 'summary', sourceBlockIds: ['missing-block'] }],
      })),
    }

    const response = await renderPlanForRequest({ markdown: markdown(), options }, client)

    expect(response.usedModel).toBe(false)
    expect(response.fellBack).toBe(true)
    expect(response.error).toContain('unknown source block')
    expect(response.plan.logic).toBe('none')
    expect(response.plan.nodes.length).toBeGreaterThan(1)
  })



  test('falls back to faithful when no provider is available', async () => {
    const originalProvider = process.env.MD2HTML_LLM_PROVIDER
    process.env.MD2HTML_LLM_PROVIDER = 'none'
    try {
      const response = await renderPlanForRequest({ markdown: markdown(), options })
      expect(response.usedModel).toBe(false)
      expect(response.fellBack).toBe(true)
      expect(response.plan.logic).toBe('none')
    } finally {
      if (originalProvider === undefined) delete process.env.MD2HTML_LLM_PROVIDER
      else process.env.MD2HTML_LLM_PROVIDER = originalProvider
    }
  })

  test('faithful mode never invokes the model', async () => {
    const client: AsyncLlmClient = { invoke: vi.fn(async ({ fallbackPlan }) => fallbackPlan) }

    const response = await renderPlanForRequest({ markdown: markdown(), options: { ...options, logic: 'none' } }, client)

    expect(client.invoke).not.toHaveBeenCalled()
    expect(response.usedModel).toBe(false)
    expect(response.provider).toBe('deterministic')
  })
})
