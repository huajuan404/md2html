import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import type { RenderPlan } from '../compiler/types'
import type { AsyncLlmClient, AsyncLlmRequest } from './renderPlanApi'

const execFileAsync = promisify(execFile)

type ProviderId = 'mock' | 'claude' | 'codex'

type ProviderConfig = {
  id: ProviderId
  command: string
  argsBeforePrompt: string[]
}

const providers: Record<ProviderId, ProviderConfig> = {
  mock: { id: 'mock', command: 'mock', argsBeforePrompt: [] },
  claude: { id: 'claude', command: 'claude', argsBeforePrompt: ['--print'] },
  codex: { id: 'codex', command: 'codex', argsBeforePrompt: ['exec', '--sandbox', 'read-only', '--ephemeral', '--ignore-rules'] },
}

export function createConfiguredLocalCliClient(): AsyncLlmClient | undefined {
  const provider = (process.env.MD2HTML_LLM_PROVIDER || 'auto').toLowerCase()
  if (provider === 'off' || provider === 'none') return undefined
  if (provider === 'mock') return createMockModelClient()
  if (provider === 'claude' || provider === 'codex') return createLocalCliClient(providers[provider])
  if (process.env.MD2HTML_LLM_COMMAND) return createShellCommandClient(process.env.MD2HTML_LLM_COMMAND)
  return createAutoClient()
}

function createAutoClient(): AsyncLlmClient | undefined {
  if (commandExists('claude')) return createLocalCliClient(providers.claude)
  if (commandExists('codex')) return createLocalCliClient(providers.codex)
  return undefined
}

export function createMockModelClient(): AsyncLlmClient {
  return {
    providerName: 'mock',
    async invoke({ fallbackPlan }) {
      return {
        ...fallbackPlan,
        nodes: fallbackPlan.nodes.map((node, index) => index === 0 ? { ...node, title: `[mock model] ${node.title ?? node.id}` } : node),
      }
    },
  }
}

export function createLocalCliClient(config: ProviderConfig): AsyncLlmClient {
  return {
    providerName: config.id,
    async invoke(request) {
      const prompt = buildRenderPlanPrompt(request)
      const { stdout } = await execFileAsync(config.command, [...config.argsBeforePrompt, prompt], {
        timeout: Number(process.env.MD2HTML_LLM_TIMEOUT_MS || 60_000),
        maxBuffer: 4 * 1024 * 1024,
        cwd: process.cwd(),
      })
      return parseRenderPlanFromText(stdout)
    },
  }
}

function createShellCommandClient(command: string): AsyncLlmClient {
  return {
    providerName: 'custom-shell',
    async invoke(request) {
      const prompt = buildRenderPlanPrompt(request)
      const { stdout } = await execFileAsync('sh', ['-lc', `${command} <<'MD2HTML_PROMPT'\n${escapeHereDoc(prompt)}\nMD2HTML_PROMPT`], {
        timeout: Number(process.env.MD2HTML_LLM_TIMEOUT_MS || 60_000),
        maxBuffer: 4 * 1024 * 1024,
        cwd: process.cwd(),
      })
      return parseRenderPlanFromText(stdout)
    },
  }
}

function commandExists(command: string): boolean {
  try {
    execFileSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function escapeHereDoc(value: string): string {
  return value.replace(/MD2HTML_PROMPT/g, 'MD2HTML_PROMPT_ESCAPED')
}

function buildRenderPlanPrompt({ sourceBlocks, fallbackPlan, options }: AsyncLlmRequest): string {
  return `You are md2html's RenderPlan planner. Return ONLY valid JSON for a RenderPlan. Do not return Markdown or explanation.

Rules:
- Do not generate HTML.
- Use only these sourceBlockIds: ${sourceBlocks.map((block) => block.id).join(', ')}
- Keep logic exactly ${options.logic} and density exactly ${options.density}.
- Every node must have id, kind, sourceBlockIds, and optional title.
- quote/table/code nodes must reference exactly one source block.
- You may reorder and group source blocks, but do not invent content.

Fallback plan shape you may improve:
${JSON.stringify(fallbackPlan, null, 2)}

Source blocks:
${JSON.stringify(sourceBlocks.map(({ id, type, depth, text }) => ({ id, type, depth, text })), null, 2)}

Return JSON object now:`
}

export function parseRenderPlanFromText(text: string): RenderPlan {
  const trimmed = text.trim()
  const candidates = [
    trimmed,
    ...[...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((match) => match[1].trim()),
    extractFirstJsonObject(trimmed),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as RenderPlan
    } catch {
      // try next candidate
    }
  }
  throw new Error('Model did not return parseable RenderPlan JSON')
}

function extractFirstJsonObject(text: string): string | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  return text.slice(start, end + 1)
}
