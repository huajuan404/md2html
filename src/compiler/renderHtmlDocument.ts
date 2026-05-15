import type { CompileOptions, RenderPlan, SourceBlock, ThemeId } from './types'

type RenderContext = {
  blocksById: Map<string, SourceBlock>
  includeSourceMetadata: boolean
}

export function renderHtmlDocument(blocks: SourceBlock[], renderPlan: RenderPlan, options: CompileOptions): string {
  const contentLanguage = options.contentLanguage === 'auto' ? detectContentLanguage(blocks) : options.contentLanguage
  const context: RenderContext = {
    blocksById: new Map(blocks.map((block) => [block.id, block])),
    includeSourceMetadata: options.includeSourceMetadata ?? true,
  }
  const includeSourceMetadata = options.includeSourceMetadata ?? true
  const body = renderPlan.nodes.map((node) => {
    const nodeBlocks = node.sourceBlockIds.map((id) => context.blocksById.get(id)).filter((block): block is SourceBlock => Boolean(block))
    if (!nodeBlocks.length) return ''
    return renderNode(node.kind, nodeBlocks, node.id, node.sourceBlockIds, context)
  }).join('\n')

  return `<!doctype html>
<html lang="${escapeAttribute(contentLanguage)}" data-theme="${escapeAttribute(options.theme)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(blocks[0]?.text || 'md2html')}</title>
<style>${themeCss(options.theme)}</style>
${includeSourceMetadata ? `<script>document.addEventListener('click',event=>{const el=event.target.closest('[data-render-node]');if(el)parent.postMessage({type:'md2html:select-source',sourceBlockIds:el.dataset.sourceBlocks},'*')})</script>` : ''}
</head>
<body>
<article class="page ${escapeAttribute(renderPlan.density)}">
${body}
</article>
</body>
</html>`
}

function renderNode(kind: string, blocks: SourceBlock[], nodeId: string, sourceBlockIds: string[], context: RenderContext): string {
  const block = blocks[0]
  if (blocks.length > 1) {
    const attrs = context.includeSourceMetadata
      ? ` data-render-node="${escapeAttribute(nodeId)}" data-source-blocks="${escapeAttribute(sourceBlockIds.join(' '))}"`
      : ''
    const inner = blocks.map((child) => renderBlockInner(child)).join('')
    return `<section${attrs} class="${escapeAttribute(kind)}">${inner}</section>`
  }
  return renderSingleBlock(block, nodeId, sourceBlockIds, context)
}

function renderSingleBlock(block: SourceBlock, nodeId: string, sourceBlockIds: string[], context: RenderContext): string {
  const attrs = context.includeSourceMetadata
    ? ` data-render-node="${escapeAttribute(nodeId)}" data-source-blocks="${escapeAttribute(sourceBlockIds.join(' '))}"`
    : ''

  if (block.type === 'heading') {
    const level = Math.min(Math.max(block.depth ?? 2, 1), 6)
    if (level === 1) return `<header${attrs} class="hero"><h1>${escapeHtml(block.text)}</h1></header>`
    return `<section${attrs} class="heading heading-${level}"><h${level}>${escapeHtml(block.text)}</h${level}></section>`
  }
  if (block.type === 'quote') return `<blockquote${attrs}>${inlineMarkdown(block.text)}</blockquote>`
  if (block.type === 'list') return renderList(block, attrs)
  if (block.type === 'table') return renderTable(block, attrs)
  if (block.type === 'code') return `<pre${attrs}><code>${escapeHtml(block.text)}</code></pre>`
  if (block.type === 'thematicBreak') return `<hr${attrs} />`
  return `<section${attrs} class="paragraph"><p>${inlineMarkdown(block.text)}</p></section>`
}

function renderBlockInner(block: SourceBlock): string {
  if (block.type === 'heading') {
    const level = Math.min(Math.max(block.depth ?? 2, 1), 6)
    return `<h${level}>${escapeHtml(block.text)}</h${level}>`
  }
  if (block.type === 'quote') return `<blockquote>${inlineMarkdown(block.text)}</blockquote>`
  if (block.type === 'list') return renderList(block, '')
  if (block.type === 'table') return renderTable(block, '')
  if (block.type === 'code') return `<pre><code>${escapeHtml(block.text)}</code></pre>`
  if (block.type === 'thematicBreak') return '<hr />'
  return `<p>${inlineMarkdown(block.text)}</p>`
}

function renderList(block: SourceBlock, attrs: string): string {
  const tag = block.ordered ? 'ol' : 'ul'
  const items = block.raw
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line))
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, ''))
    .map((item) => `<li>${inlineMarkdown(item)}</li>`)
    .join('')
  return `<section${attrs} class="list"><${tag}>${items}</${tag}></section>`
}

function renderTable(block: SourceBlock, attrs: string): string {
  const rows = block.raw.split(/\r?\n/).filter((line) => line.includes('|'))
  const cleanedRows = rows.filter((line) => !/^\s*\|?\s*:?-{3,}:?/.test(line))
  const htmlRows = cleanedRows.map((line, rowIndex) => {
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
    const cellTag = rowIndex === 0 ? 'th' : 'td'
    return `<tr>${cells.map((cell) => `<${cellTag}>${inlineMarkdown(cell)}</${cellTag}>`).join('')}</tr>`
  }).join('')
  return `<section${attrs} class="table"><table>${htmlRows}</table></section>`
}

function detectContentLanguage(blocks: SourceBlock[]): 'zh' | 'en' {
  const text = blocks.map((block) => block.text).join('')
  const cjk = text.match(/[\u3400-\u9fff]/g)?.length ?? 0
  return cjk > text.length * 0.1 ? 'zh' : 'en'
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function themeCss(theme: ThemeId): string {
  const tokens = {
    'editorial-light': ['#f8f5ef', '#1f2933', '#7c3aed', 'Georgia, serif'],
    'dense-brief': ['#f4f7fb', '#111827', '#2563eb', 'Inter, system-ui, sans-serif'],
    'dark-studio': ['#10131a', '#eef2ff', '#8b5cf6', 'Inter, system-ui, sans-serif'],
  }[theme]
  const [background, color, accent, font] = tokens
  return `:root{color-scheme:light dark}body{margin:0;background:${background};color:${color};font-family:${font};line-height:1.65}.page{max-width:980px;margin:0 auto;padding:48px 24px}.hero{border-bottom:2px solid ${accent};margin-bottom:32px}.hero h1{font-size:clamp(2.4rem,8vw,5rem);line-height:1}.paragraph,.heading,.list,.table,blockquote,pre{margin:24px 0;padding:18px 20px;background:rgba(255,255,255,.58);border:1px solid rgba(127,127,127,.22);border-radius:18px}blockquote{border-left:5px solid ${accent}}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid rgba(127,127,127,.25);padding:8px;text-align:left}pre{overflow:auto}.compact{max-width:1180px}.compact .paragraph,.compact .list,.compact .table{display:inline-block;vertical-align:top;width:calc(50% - 52px);margin-right:12px}.per-screen>*{min-height:70vh;display:flex;flex-direction:column;justify-content:center}`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
