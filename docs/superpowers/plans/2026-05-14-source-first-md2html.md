# Source-First md2html Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of a source-mapped Markdown projection editor that updates human-optimized HTML directly from editable Markdown, with source-map-backed render nodes and single-file export.

**Architecture:** The app uses a pure compiler pipeline from Markdown to SourceBlock, SemanticDocument, RenderPlan, and HTML projection. React owns the shell/editor/preview UI, while compiler modules remain framework-independent and fully unit-testable. This is intentionally not an agentic HTML generator: the MVP preview path must not call agent CLIs, LLM APIs, or `/api/convert`.

**Tech Stack:** Vite, React, TypeScript, CodeMirror 6, unified/remark, Vitest, Playwright.

---

## File Structure

Create this structure:

```text
package.json
index.html
tsconfig.json
vite.config.ts
vitest.config.ts
playwright.config.ts
src/
  main.tsx
  app/App.tsx
  app/layout/Toolbar.tsx
  app/layout/SplitPane.tsx
  editor/MarkdownEditor.tsx
  editor/editorSelection.ts
  preview/HtmlPreview.tsx
  preview/previewInteractions.ts
  compiler/types.ts
  compiler/extractSourceBlocks.ts
  compiler/buildSemanticDocument.ts
  compiler/buildRenderPlan.ts
  compiler/renderHtmlDocument.ts
  compiler/exportHtml.ts
  compiler/compileMarkdown.ts
  render-modes/faithful.ts
  render-modes/reader.ts
  render-modes/brief.ts
  render-modes/deck.ts
  themes/tokens.ts
  themes/editorialLight.ts
  themes/denseBrief.ts
  themes/darkStudio.ts
  samples/defaultMarkdown.ts
  styles/app.css
  test/fixtures/sampleMarkdown.ts
tests/
  compiler/extractSourceBlocks.test.ts
  compiler/buildSemanticDocument.test.ts
  compiler/renderModes.test.ts
  compiler/renderHtmlDocument.test.ts
  compiler/exportHtml.test.ts
  e2e/app.spec.ts
```

Responsibilities:

- `compiler/`: pure TypeScript functions, no React imports.
- `render-modes/`: RenderPlan builders for each mode.
- `themes/`: tokens and CSS variable generation.
- `editor/`: CodeMirror editor and source-line highlighting.
- `preview/`: iframe rendering and source-map click messages.
- `app/`: state orchestration, toolbar, layout.

## Competitive Guardrails

This plan is calibrated against `nexu-io/html-anything`, which already covers the adjacent “agentic HTML editor” lane: prompt/template → local agent CLI → streaming HTML artifact → preview/export.

Do not implement that lane in the MVP. The MVP must prove a different core:

- Markdown is the canonical editable source.
- HTML is a deterministic projection regenerated from Markdown.
- Source maps connect render nodes to Markdown blocks.
- Editing Markdown updates HTML without pressing a generation button.
- Agent/LLM support is future enhancement only; it may later generate RenderPlan, ThemeTokens, MarkdownPatch, or IRPatch, but not replace the core compiler.

---

### Task 1: Scaffold Vite React TypeScript app

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/styles/app.css`

- [ ] **Step 1: Create package manifest**

`package.json` content:

```json
{
  "name": "source-first-md2html",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "check": "npm run test && npm run build"
  },
  "dependencies": {
    "@codemirror/lang-markdown": "latest",
    "@codemirror/state": "latest",
    "@codemirror/view": "latest",
    "@uiw/react-codemirror": "latest",
    "github-slugger": "latest",
    "react": "latest",
    "react-dom": "latest",
    "remark-gfm": "latest",
    "remark-parse": "latest",
    "unified": "latest",
    "unist-util-visit": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Create HTML entry**

`index.html` content:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Source-First md2html</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create TypeScript and Vite config**

`tsconfig.json` content:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"],
  "references": []
}
```

`vite.config.ts` content:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

`vitest.config.ts` content:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

`playwright.config.ts` content:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

- [ ] **Step 4: Create minimal React shell**

`src/main.tsx` content:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`src/app/App.tsx` content:

```tsx
export function App() {
  return (
    <main className="appShell">
      <header className="topBar">
        <strong>Source-First md2html</strong>
      </header>
      <section className="splitPane">
        <div className="pane editorPane">Markdown editor</div>
        <div className="pane previewPane">HTML projection</div>
      </section>
    </main>
  )
}
```

`src/styles/app.css` content:

```css
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f4f1ea;
  color: #181512;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 960px;
  min-height: 100vh;
}

.appShell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 56px 1fr;
}

.topBar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  border-bottom: 1px solid #ddd4c5;
  background: #fffaf1;
}

.splitPane {
  display: grid;
  grid-template-columns: minmax(360px, 46vw) 1fr;
  min-height: 0;
}

.pane {
  min-height: 0;
  overflow: auto;
}

.editorPane {
  border-right: 1px solid #ddd4c5;
  background: #111827;
  color: #e5e7eb;
}

.previewPane {
  background: #f8f4ec;
}
```

- [ ] **Step 5: Install dependencies and verify scaffold**

Run:

```bash
npm install
npm run build
```

Expected: `vite build` completes and writes `dist/` without TypeScript errors.

---

### Task 2: Define compiler contracts and fixtures

**Files:**
- Create: `src/compiler/types.ts`
- Create: `src/test/fixtures/sampleMarkdown.ts`
- Create: `tests/compiler/extractSourceBlocks.test.ts`

- [ ] **Step 1: Write the type contracts**

`src/compiler/types.ts` content:

```ts
export type SourceBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'code'
  | 'quote'
  | 'thematicBreak'
  | 'html'

export type SourceBlock = {
  id: string
  type: SourceBlockType
  startLine: number
  endLine: number
  startOffset: number
  endOffset: number
  raw: string
  text: string
  depth?: number
  parentHeadingId?: string
}

export type OutlineItem = {
  id: string
  sourceBlockId: string
  depth: number
  title: string
  children: OutlineItem[]
}

export type SemanticSection = {
  id: string
  headingBlockId?: string
  title: string
  sourceBlockIds: string[]
  summaryText: string
}

export type DocumentStats = {
  blockCount: number
  wordCount: number
  headingCount: number
  tableCount: number
  codeBlockCount: number
}

export type SemanticDocument = {
  title: string
  subtitle?: string
  blocks: SourceBlock[]
  outline: OutlineItem[]
  stats: DocumentStats
  sections: SemanticSection[]
}

export type RenderModeId = 'faithful' | 'reader' | 'brief' | 'deck'

export type RenderNodeKind =
  | 'hero'
  | 'toc'
  | 'section'
  | 'card'
  | 'quote'
  | 'table'
  | 'code'
  | 'timeline'
  | 'summary'
  | 'slide'
  | 'appendix'

export type RenderNode = {
  id: string
  kind: RenderNodeKind
  title?: string
  body?: string
  sourceBlockIds: string[]
  children?: RenderNode[]
  metadata?: Record<string, string | number | boolean>
}

export type SourceMapIndex = {
  byRenderNodeId: Record<string, string[]>
  bySourceBlockId: Record<string, string[]>
}

export type RenderPlan = {
  mode: RenderModeId
  title: string
  nodes: RenderNode[]
  sourceMap: SourceMapIndex
}

export type ThemeId = 'editorial-light' | 'dense-brief' | 'dark-studio'

export type Density = 'comfortable' | 'compact' | 'dense'

export type CompileOptions = {
  mode: RenderModeId
  theme: ThemeId
  density: Density
  includeSourceMetadata: boolean
}

export type CompileResult = {
  markdown: string
  sourceBlocks: SourceBlock[]
  semanticDocument: SemanticDocument
  renderPlan: RenderPlan
  html: string
}
```

- [ ] **Step 2: Create a shared Markdown fixture**

`src/test/fixtures/sampleMarkdown.ts` content:

```ts
export const sampleMarkdown = `# AI Output Should Become HTML

Markdown is easy to edit. HTML is easier to consume.

## Why this matters

- Markdown keeps source control simple.
- HTML unlocks layout and interaction.

> The source should remain editable.

| Format | Strength |
| --- | --- |
| Markdown | Editing |
| HTML | Reading |

\`\`\`ts
const source = 'markdown'
\`\`\`
`
```

- [ ] **Step 3: Write an initial failing test for source blocks**

`tests/compiler/extractSourceBlocks.test.ts` content:

```ts
import { describe, expect, it } from 'vitest'
import { sampleMarkdown } from '../../src/test/fixtures/sampleMarkdown'
import { extractSourceBlocks } from '../../src/compiler/extractSourceBlocks'

describe('extractSourceBlocks', () => {
  it('extracts block-level source map units with line ranges', () => {
    const blocks = extractSourceBlocks(sampleMarkdown)

    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'list',
      'quote',
      'table',
      'code',
    ])
    expect(blocks[0]).toMatchObject({
      id: 'block-1',
      type: 'heading',
      startLine: 1,
      endLine: 1,
      text: 'AI Output Should Become HTML',
      depth: 1,
    })
    expect(blocks[5].raw).toContain('| Markdown | Editing |')
    expect(blocks[6].raw).toContain("const source = 'markdown'")
  })
})
```

- [ ] **Step 4: Run test and verify it fails because implementation does not exist**

Run:

```bash
npm run test -- tests/compiler/extractSourceBlocks.test.ts
```

Expected: FAIL with an import error for `extractSourceBlocks`.

---

### Task 3: Implement SourceBlock extraction

**Files:**
- Create: `src/compiler/extractSourceBlocks.ts`
- Modify: `tests/compiler/extractSourceBlocks.test.ts`

- [ ] **Step 1: Implement source block extraction**

`src/compiler/extractSourceBlocks.ts` content:

```ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import type { SourceBlock, SourceBlockType } from './types'

type MdAstNode = {
  type: string
  depth?: number
  value?: string
  children?: MdAstNode[]
  position?: {
    start: { line: number; offset: number }
    end: { line: number; offset: number }
  }
}

const BLOCK_TYPES = new Map<string, SourceBlockType>([
  ['heading', 'heading'],
  ['paragraph', 'paragraph'],
  ['list', 'list'],
  ['table', 'table'],
  ['code', 'code'],
  ['blockquote', 'quote'],
  ['thematicBreak', 'thematicBreak'],
  ['html', 'html'],
])

export function extractSourceBlocks(markdown: string): SourceBlock[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MdAstNode
  const blocks: SourceBlock[] = []

  visit(tree, (node: MdAstNode, index, parent: MdAstNode | undefined) => {
    if (!parent || parent.type !== 'root') return

    const type = BLOCK_TYPES.get(node.type)
    if (!type || !node.position) return

    const raw = sliceByOffsets(markdown, node.position.start.offset, node.position.end.offset)
    const id = `block-${blocks.length + 1}`

    blocks.push({
      id,
      type,
      startLine: node.position.start.line,
      endLine: node.position.end.line,
      startOffset: node.position.start.offset,
      endOffset: node.position.end.offset,
      raw,
      text: nodeToText(node),
      depth: node.type === 'heading' ? node.depth : undefined,
    })
  })

  return assignParentHeadings(blocks)
}

function sliceByOffsets(markdown: string, startOffset: number, endOffset: number) {
  return markdown.slice(startOffset, endOffset)
}

function nodeToText(node: MdAstNode): string {
  if (typeof node.value === 'string') return node.value.trim()
  if (!node.children) return ''
  return node.children.map(nodeToText).join(' ').replace(/\s+/g, ' ').trim()
}

function assignParentHeadings(blocks: SourceBlock[]): SourceBlock[] {
  const headingStack: SourceBlock[] = []

  return blocks.map((block) => {
    if (block.type === 'heading') {
      while (headingStack.length > 0 && (headingStack.at(-1)?.depth ?? 0) >= (block.depth ?? 1)) {
        headingStack.pop()
      }
      headingStack.push(block)
      return block
    }

    return {
      ...block,
      parentHeadingId: headingStack.at(-1)?.id,
    }
  })
}
```

- [ ] **Step 2: Add a parent heading assertion**

Append this test case to `tests/compiler/extractSourceBlocks.test.ts`:

```ts
  it('links body blocks to their nearest parent heading', () => {
    const blocks = extractSourceBlocks(sampleMarkdown)
    const list = blocks.find((block) => block.type === 'list')

    expect(list?.parentHeadingId).toBe('block-3')
  })
```

- [ ] **Step 3: Run source block tests**

Run:

```bash
npm run test -- tests/compiler/extractSourceBlocks.test.ts
```

Expected: PASS.

---

### Task 4: Build SemanticDocument from SourceBlock

**Files:**
- Create: `src/compiler/buildSemanticDocument.ts`
- Create: `tests/compiler/buildSemanticDocument.test.ts`

- [ ] **Step 1: Write semantic document tests**

`tests/compiler/buildSemanticDocument.test.ts` content:

```ts
import { describe, expect, it } from 'vitest'
import { extractSourceBlocks } from '../../src/compiler/extractSourceBlocks'
import { buildSemanticDocument } from '../../src/compiler/buildSemanticDocument'
import { sampleMarkdown } from '../../src/test/fixtures/sampleMarkdown'

describe('buildSemanticDocument', () => {
  it('builds title, outline, stats, and sections', () => {
    const blocks = extractSourceBlocks(sampleMarkdown)
    const document = buildSemanticDocument(blocks)

    expect(document.title).toBe('AI Output Should Become HTML')
    expect(document.stats).toMatchObject({
      blockCount: 7,
      headingCount: 2,
      tableCount: 1,
      codeBlockCount: 1,
    })
    expect(document.outline[0]).toMatchObject({
      title: 'AI Output Should Become HTML',
      depth: 1,
      sourceBlockId: 'block-1',
    })
    expect(document.sections[0].sourceBlockIds).toContain('block-2')
    expect(document.sections[1].title).toBe('Why this matters')
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm run test -- tests/compiler/buildSemanticDocument.test.ts
```

Expected: FAIL with an import error for `buildSemanticDocument`.

- [ ] **Step 3: Implement semantic document builder**

`src/compiler/buildSemanticDocument.ts` content:

```ts
import type { OutlineItem, SemanticDocument, SemanticSection, SourceBlock } from './types'

export function buildSemanticDocument(blocks: SourceBlock[]): SemanticDocument {
  const title = blocks.find((block) => block.type === 'heading' && block.depth === 1)?.text || 'Untitled Markdown'
  const outline = buildOutline(blocks)
  const sections = buildSections(blocks)

  return {
    title,
    blocks,
    outline,
    sections,
    stats: {
      blockCount: blocks.length,
      wordCount: countWords(blocks),
      headingCount: blocks.filter((block) => block.type === 'heading').length,
      tableCount: blocks.filter((block) => block.type === 'table').length,
      codeBlockCount: blocks.filter((block) => block.type === 'code').length,
    },
  }
}

function buildOutline(blocks: SourceBlock[]): OutlineItem[] {
  const root: OutlineItem[] = []
  const stack: OutlineItem[] = []

  for (const block of blocks) {
    if (block.type !== 'heading') continue

    const item: OutlineItem = {
      id: `outline-${block.id}`,
      sourceBlockId: block.id,
      depth: block.depth ?? 1,
      title: block.text,
      children: [],
    }

    while (stack.length > 0 && stack.at(-1)!.depth >= item.depth) stack.pop()

    const parent = stack.at(-1)
    if (parent) parent.children.push(item)
    else root.push(item)

    stack.push(item)
  }

  return root
}

function buildSections(blocks: SourceBlock[]): SemanticSection[] {
  const sections: SemanticSection[] = []
  let current: SemanticSection | undefined

  for (const block of blocks) {
    if (block.type === 'heading') {
      current = {
        id: `section-${sections.length + 1}`,
        headingBlockId: block.id,
        title: block.text,
        sourceBlockIds: [block.id],
        summaryText: '',
      }
      sections.push(current)
      continue
    }

    if (!current) {
      current = {
        id: `section-${sections.length + 1}`,
        title: 'Opening',
        sourceBlockIds: [],
        summaryText: '',
      }
      sections.push(current)
    }

    current.sourceBlockIds.push(block.id)
    if (!current.summaryText && block.text) current.summaryText = block.text
  }

  return sections
}

function countWords(blocks: SourceBlock[]): number {
  return blocks
    .map((block) => block.text)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length
}
```

- [ ] **Step 4: Run semantic document tests**

Run:

```bash
npm run test -- tests/compiler/buildSemanticDocument.test.ts
```

Expected: PASS.

---

### Task 5: Implement render modes and source map index

**Files:**
- Create: `src/compiler/buildRenderPlan.ts`
- Create: `src/render-modes/faithful.ts`
- Create: `src/render-modes/reader.ts`
- Create: `src/render-modes/brief.ts`
- Create: `src/render-modes/deck.ts`
- Create: `tests/compiler/renderModes.test.ts`

- [ ] **Step 1: Write render mode tests**

`tests/compiler/renderModes.test.ts` content:

```ts
import { describe, expect, it } from 'vitest'
import { extractSourceBlocks } from '../../src/compiler/extractSourceBlocks'
import { buildSemanticDocument } from '../../src/compiler/buildSemanticDocument'
import { buildRenderPlan } from '../../src/compiler/buildRenderPlan'
import { sampleMarkdown } from '../../src/test/fixtures/sampleMarkdown'
import type { RenderModeId } from '../../src/compiler/types'

function planFor(mode: RenderModeId) {
  const blocks = extractSourceBlocks(sampleMarkdown)
  const document = buildSemanticDocument(blocks)
  return buildRenderPlan(document, mode)
}

describe('render modes', () => {
  it('builds source-mapped render nodes for every mode', () => {
    for (const mode of ['faithful', 'reader', 'brief', 'deck'] satisfies RenderModeId[]) {
      const plan = planFor(mode)
      expect(plan.mode).toBe(mode)
      expect(plan.nodes.length).toBeGreaterThan(0)
      expect(Object.keys(plan.sourceMap.byRenderNodeId).length).toBeGreaterThan(0)
      expect(plan.nodes.some((node) => node.sourceBlockIds.length > 0)).toBe(true)
    }
  })

  it('brief mode creates cards from sections', () => {
    const plan = planFor('brief')
    expect(plan.nodes.some((node) => node.kind === 'card')).toBe(true)
  })

  it('deck mode creates slide nodes', () => {
    const plan = planFor('deck')
    expect(plan.nodes.filter((node) => node.kind === 'slide').length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Implement render plan dispatcher**

`src/compiler/buildRenderPlan.ts` content:

```ts
import type { RenderModeId, RenderNode, RenderPlan, SemanticDocument, SourceMapIndex } from './types'
import { buildFaithfulPlan } from '../render-modes/faithful'
import { buildReaderPlan } from '../render-modes/reader'
import { buildBriefPlan } from '../render-modes/brief'
import { buildDeckPlan } from '../render-modes/deck'

export function buildRenderPlan(document: SemanticDocument, mode: RenderModeId): RenderPlan {
  const nodes = buildNodes(document, mode)
  return {
    mode,
    title: document.title,
    nodes,
    sourceMap: buildSourceMap(nodes),
  }
}

function buildNodes(document: SemanticDocument, mode: RenderModeId): RenderNode[] {
  if (mode === 'faithful') return buildFaithfulPlan(document)
  if (mode === 'reader') return buildReaderPlan(document)
  if (mode === 'brief') return buildBriefPlan(document)
  return buildDeckPlan(document)
}

function buildSourceMap(nodes: RenderNode[]): SourceMapIndex {
  const byRenderNodeId: SourceMapIndex['byRenderNodeId'] = {}
  const bySourceBlockId: SourceMapIndex['bySourceBlockId'] = {}

  const visit = (node: RenderNode) => {
    byRenderNodeId[node.id] = node.sourceBlockIds
    for (const sourceBlockId of node.sourceBlockIds) {
      bySourceBlockId[sourceBlockId] ??= []
      bySourceBlockId[sourceBlockId].push(node.id)
    }
    node.children?.forEach(visit)
  }

  nodes.forEach(visit)
  return { byRenderNodeId, bySourceBlockId }
}
```

- [ ] **Step 3: Implement faithful mode**

`src/render-modes/faithful.ts` content:

```ts
import type { RenderNode, SemanticDocument } from '../compiler/types'

export function buildFaithfulPlan(document: SemanticDocument): RenderNode[] {
  return [
    {
      id: 'node-hero',
      kind: 'hero',
      title: document.title,
      body: `${document.stats.blockCount} source blocks`,
      sourceBlockIds: document.blocks.slice(0, 1).map((block) => block.id),
    },
    ...document.blocks.map((block, index) => ({
      id: `node-faithful-${index + 1}`,
      kind: block.type === 'table' ? 'table' : block.type === 'code' ? 'code' : block.type === 'quote' ? 'quote' : 'section',
      title: block.type === 'heading' ? block.text : undefined,
      body: block.raw,
      sourceBlockIds: [block.id],
    } satisfies RenderNode)),
  ]
}
```

- [ ] **Step 4: Implement reader mode**

`src/render-modes/reader.ts` content:

```ts
import type { RenderNode, SemanticDocument } from '../compiler/types'

export function buildReaderPlan(document: SemanticDocument): RenderNode[] {
  const firstBodyBlock = document.blocks.find((block) => block.type !== 'heading')

  return [
    {
      id: 'node-reader-hero',
      kind: 'hero',
      title: document.title,
      body: firstBodyBlock?.text || 'Readable HTML projection',
      sourceBlockIds: [document.blocks[0]?.id, firstBodyBlock?.id].filter(Boolean) as string[],
    },
    {
      id: 'node-reader-toc',
      kind: 'toc',
      title: 'Contents',
      body: document.outline.map((item) => item.title).join('\n'),
      sourceBlockIds: document.outline.map((item) => item.sourceBlockId),
    },
    ...document.sections.map((section, index) => ({
      id: `node-reader-section-${index + 1}`,
      kind: 'section' as const,
      title: section.title,
      body: section.summaryText,
      sourceBlockIds: section.sourceBlockIds,
    })),
  ]
}
```

- [ ] **Step 5: Implement brief mode**

`src/render-modes/brief.ts` content:

```ts
import type { RenderNode, SemanticDocument } from '../compiler/types'

export function buildBriefPlan(document: SemanticDocument): RenderNode[] {
  const cardSections = document.sections.filter((section) => section.sourceBlockIds.length > 0).slice(0, 6)

  return [
    {
      id: 'node-brief-hero',
      kind: 'hero',
      title: document.title,
      body: 'A compressed decision-friendly view of the source Markdown.',
      sourceBlockIds: document.blocks.slice(0, 1).map((block) => block.id),
    },
    {
      id: 'node-brief-summary',
      kind: 'summary',
      title: 'Core signal',
      body: cardSections.map((section) => section.title).join(' · '),
      sourceBlockIds: cardSections.flatMap((section) => section.sourceBlockIds.slice(0, 1)),
    },
    ...cardSections.map((section, index) => ({
      id: `node-brief-card-${index + 1}`,
      kind: 'card' as const,
      title: section.title,
      body: section.summaryText,
      sourceBlockIds: section.sourceBlockIds,
    })),
  ]
}
```

- [ ] **Step 6: Implement deck mode**

`src/render-modes/deck.ts` content:

```ts
import type { RenderNode, SemanticDocument } from '../compiler/types'

export function buildDeckPlan(document: SemanticDocument): RenderNode[] {
  const slides: RenderNode[] = [
    {
      id: 'node-deck-cover',
      kind: 'slide',
      title: document.title,
      body: 'Generated from editable Markdown source.',
      sourceBlockIds: document.blocks.slice(0, 1).map((block) => block.id),
    },
  ]

  document.sections.forEach((section, index) => {
    slides.push({
      id: `node-deck-slide-${index + 1}`,
      kind: 'slide',
      title: section.title,
      body: section.summaryText,
      sourceBlockIds: section.sourceBlockIds,
    })
  })

  slides.push({
    id: 'node-deck-close',
    kind: 'slide',
    title: 'Source stays editable',
    body: `${document.stats.blockCount} Markdown blocks mapped into ${slides.length} slides.`,
    sourceBlockIds: document.blocks.map((block) => block.id),
  })

  return slides
}
```

- [ ] **Step 7: Run render mode tests**

Run:

```bash
npm run test -- tests/compiler/renderModes.test.ts
```

Expected: PASS.

---

### Task 6: Render HTML document and export single file

**Files:**
- Create: `src/themes/tokens.ts`
- Create: `src/themes/editorialLight.ts`
- Create: `src/themes/denseBrief.ts`
- Create: `src/themes/darkStudio.ts`
- Create: `src/compiler/renderHtmlDocument.ts`
- Create: `src/compiler/exportHtml.ts`
- Create: `src/compiler/compileMarkdown.ts`
- Create: `tests/compiler/renderHtmlDocument.test.ts`
- Create: `tests/compiler/exportHtml.test.ts`

- [ ] **Step 1: Write HTML rendering tests**

`tests/compiler/renderHtmlDocument.test.ts` content:

```ts
import { describe, expect, it } from 'vitest'
import { compileMarkdownToHtml } from '../../src/compiler/compileMarkdown'
import { sampleMarkdown } from '../../src/test/fixtures/sampleMarkdown'

describe('renderHtmlDocument', () => {
  it('renders data attributes for source mapped render nodes', () => {
    const result = compileMarkdownToHtml(sampleMarkdown, {
      mode: 'brief',
      theme: 'editorial-light',
      density: 'comfortable',
      includeSourceMetadata: true,
    })

    expect(result.html).toContain('data-render-node="node-brief-card-1"')
    expect(result.html).toContain('data-source-blocks=')
    expect(result.html).toContain('AI Output Should Become HTML')
  })
})
```

`tests/compiler/exportHtml.test.ts` content:

```ts
import { describe, expect, it } from 'vitest'
import { compileMarkdownToHtml } from '../../src/compiler/compileMarkdown'
import { exportHtml } from '../../src/compiler/exportHtml'
import { sampleMarkdown } from '../../src/test/fixtures/sampleMarkdown'

describe('exportHtml', () => {
  it('can strip source metadata for clean exported HTML', () => {
    const result = compileMarkdownToHtml(sampleMarkdown, {
      mode: 'reader',
      theme: 'dark-studio',
      density: 'compact',
      includeSourceMetadata: true,
    })

    const cleanHtml = exportHtml(result.html, { includeSourceMetadata: false })

    expect(cleanHtml).toContain('<!doctype html>')
    expect(cleanHtml).not.toContain('data-render-node=')
    expect(cleanHtml).not.toContain('data-source-blocks=')
  })
})
```

- [ ] **Step 2: Implement theme tokens and CSS variables**

`src/themes/tokens.ts` content:

```ts
import { darkStudio } from './darkStudio'
import { denseBrief } from './denseBrief'
import { editorialLight } from './editorialLight'
import type { ThemeId } from '../compiler/types'

export type ThemeTokens = {
  id: ThemeId
  name: string
  background: string
  surface: string
  surfaceAlt: string
  text: string
  muted: string
  accent: string
  border: string
  bodyFont: string
  displayFont: string
  monoFont: string
  radius: string
  shadow: string
}

export const themes = {
  'editorial-light': editorialLight,
  'dense-brief': denseBrief,
  'dark-studio': darkStudio,
} satisfies Record<ThemeId, ThemeTokens>

export function themeToCss(tokens: ThemeTokens, density: string): string {
  const densityScale = density === 'dense' ? '0.78' : density === 'compact' ? '0.9' : '1'
  return `
:root {
  --bg: ${tokens.background};
  --surface: ${tokens.surface};
  --surface-alt: ${tokens.surfaceAlt};
  --text: ${tokens.text};
  --muted: ${tokens.muted};
  --accent: ${tokens.accent};
  --border: ${tokens.border};
  --body-font: ${tokens.bodyFont};
  --display-font: ${tokens.displayFont};
  --mono-font: ${tokens.monoFont};
  --radius: ${tokens.radius};
  --shadow: ${tokens.shadow};
  --density: ${densityScale};
}
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--body-font); }
.projection { max-width: 1120px; margin: 0 auto; padding: calc(48px * var(--density)); }
.node { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: calc(24px * var(--density)); margin: 0 0 calc(18px * var(--density)); }
.node:hover { outline: 2px solid color-mix(in srgb, var(--accent), transparent 50%); }
.hero { background: var(--surface-alt); }
.card, .slide { display: grid; gap: 10px; }
h1, h2, h3 { font-family: var(--display-font); margin: 0 0 12px; }
p { line-height: 1.65; }
pre { overflow: auto; background: #111827; color: #e5e7eb; padding: 16px; border-radius: 12px; }
.sourceHint { color: var(--muted); font-size: 12px; font-family: var(--mono-font); }
`
}
```

`src/themes/editorialLight.ts` content:

```ts
import type { ThemeTokens } from './tokens'

export const editorialLight: ThemeTokens = {
  id: 'editorial-light',
  name: 'Editorial Light',
  background: '#f6efe3',
  surface: '#fffaf1',
  surfaceAlt: '#efe0c8',
  text: '#1f1a14',
  muted: '#766a5a',
  accent: '#a65f2b',
  border: '#dfd1bd',
  bodyFont: 'Inter, ui-sans-serif, system-ui, sans-serif',
  displayFont: 'Georgia, ui-serif, serif',
  monoFont: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  radius: '22px',
  shadow: '0 18px 60px rgba(72, 48, 24, 0.10)',
}
```

`src/themes/denseBrief.ts` content:

```ts
import type { ThemeTokens } from './tokens'

export const denseBrief: ThemeTokens = {
  id: 'dense-brief',
  name: 'Dense Brief',
  background: '#eef2f7',
  surface: '#ffffff',
  surfaceAlt: '#dce7f5',
  text: '#111827',
  muted: '#5b6472',
  accent: '#2563eb',
  border: '#cad5e3',
  bodyFont: 'Inter, ui-sans-serif, system-ui, sans-serif',
  displayFont: 'Inter, ui-sans-serif, system-ui, sans-serif',
  monoFont: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  radius: '14px',
  shadow: '0 12px 40px rgba(30, 41, 59, 0.10)',
}
```

`src/themes/darkStudio.ts` content:

```ts
import type { ThemeTokens } from './tokens'

export const darkStudio: ThemeTokens = {
  id: 'dark-studio',
  name: 'Dark Studio',
  background: '#080b12',
  surface: '#101826',
  surfaceAlt: '#172033',
  text: '#f8fafc',
  muted: '#aab4c5',
  accent: '#7dd3fc',
  border: '#263348',
  bodyFont: 'Inter, ui-sans-serif, system-ui, sans-serif',
  displayFont: 'Inter, ui-sans-serif, system-ui, sans-serif',
  monoFont: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  radius: '18px',
  shadow: '0 20px 70px rgba(0, 0, 0, 0.35)',
}
```

- [ ] **Step 3: Implement HTML rendering and export**

`src/compiler/renderHtmlDocument.ts` content:

```ts
import type { CompileOptions, RenderNode, RenderPlan } from './types'
import { themes, themeToCss } from '../themes/tokens'

export function renderHtmlDocument(renderPlan: RenderPlan, options: CompileOptions): string {
  const theme = themes[options.theme]
  const css = themeToCss(theme, options.density)
  const body = renderNodes(renderPlan.nodes, options)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(renderPlan.title)}</title>
<style>${css}</style>
</head>
<body>
<main class="projection" data-render-mode="${renderPlan.mode}" data-theme="${options.theme}">
${body}
</main>
<script>
window.addEventListener('click', function(event) {
  var target = event.target.closest('[data-render-node]');
  if (!target) return;
  window.parent.postMessage({
    type: 'render-node-selected',
    renderNodeId: target.getAttribute('data-render-node'),
    sourceBlockIds: (target.getAttribute('data-source-blocks') || '').split(' ').filter(Boolean)
  }, '*');
});
</script>
</body>
</html>`
}

function renderNodes(nodes: RenderNode[], options: CompileOptions): string {
  return nodes.map((node) => renderNode(node, options)).join('\n')
}

function renderNode(node: RenderNode, options: CompileOptions): string {
  const attrs = options.includeSourceMetadata
    ? ` data-render-node="${escapeHtml(node.id)}" data-source-blocks="${escapeHtml(node.sourceBlockIds.join(' '))}"`
    : ''
  const childHtml = node.children?.length ? renderNodes(node.children, options) : ''
  const title = node.title ? `<h2>${escapeHtml(node.title)}</h2>` : ''
  const body = node.body ? `<p>${escapeHtml(node.body)}</p>` : ''
  const sourceHint = options.includeSourceMetadata && node.sourceBlockIds.length
    ? `<div class="sourceHint">source: ${escapeHtml(node.sourceBlockIds.join(', '))}</div>`
    : ''

  return `<section class="node ${node.kind}"${attrs}>${title}${body}${childHtml}${sourceHint}</section>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
```

`src/compiler/exportHtml.ts` content:

```ts
export function exportHtml(html: string, options: { includeSourceMetadata: boolean }): string {
  if (options.includeSourceMetadata) return html

  return html
    .replace(/\sdata-render-node="[^"]*"/g, '')
    .replace(/\sdata-source-blocks="[^"]*"/g, '')
}
```

`src/compiler/compileMarkdown.ts` content:

```ts
import type { CompileOptions, CompileResult } from './types'
import { buildRenderPlan } from './buildRenderPlan'
import { buildSemanticDocument } from './buildSemanticDocument'
import { extractSourceBlocks } from './extractSourceBlocks'
import { renderHtmlDocument } from './renderHtmlDocument'

export function compileMarkdownToHtml(markdown: string, options: CompileOptions): CompileResult {
  const sourceBlocks = extractSourceBlocks(markdown)
  const semanticDocument = buildSemanticDocument(sourceBlocks)
  const renderPlan = buildRenderPlan(semanticDocument, options.mode)
  const html = renderHtmlDocument(renderPlan, options)

  return {
    markdown,
    sourceBlocks,
    semanticDocument,
    renderPlan,
    html,
  }
}
```

- [ ] **Step 4: Run compiler tests**

Run:

```bash
npm run test -- tests/compiler
```

Expected: PASS.

---

### Task 7: Build editor, preview, toolbar, and source-map interaction

**Files:**
- Create: `src/samples/defaultMarkdown.ts`
- Create: `src/app/layout/Toolbar.tsx`
- Create: `src/app/layout/SplitPane.tsx`
- Create: `src/editor/MarkdownEditor.tsx`
- Create: `src/editor/editorSelection.ts`
- Create: `src/preview/HtmlPreview.tsx`
- Create: `src/preview/previewInteractions.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Create default Markdown sample**

`src/samples/defaultMarkdown.ts` content:

```ts
export const defaultMarkdown = `# Markdown Is the Source, HTML Is the Projection

Markdown remains the editable source of truth. HTML becomes the richer surface for reading, sharing, and understanding.

## The editing problem

HTML is excellent for human consumption, but painful for incremental edits. Markdown is easy to patch, diff, and version.

## The product bet

- Left side: editable Markdown.
- Right side: regenerated HTML projection.
- Source map: the bridge between them.

> The page can be beautiful without becoming uneditable.
`
```

- [ ] **Step 2: Create toolbar**

`src/app/layout/Toolbar.tsx` content:

```tsx
import type { CompileOptions, Density, RenderModeId, ThemeId } from '../../compiler/types'

export type ToolbarProps = {
  options: CompileOptions
  onOptionsChange: (options: CompileOptions) => void
  onUpload: (file: File) => void
  onDownload: () => void
  onCopyHtml: () => void
}

export function Toolbar({ options, onOptionsChange, onUpload, onDownload, onCopyHtml }: ToolbarProps) {
  return (
    <header className="topBar">
      <strong>Source-First md2html</strong>
      <label>
        Mode
        <select
          value={options.mode}
          onChange={(event) => onOptionsChange({ ...options, mode: event.target.value as RenderModeId })}
        >
          <option value="faithful">Faithful</option>
          <option value="reader">Reader</option>
          <option value="brief">Brief</option>
          <option value="deck">Deck</option>
        </select>
      </label>
      <label>
        Theme
        <select
          value={options.theme}
          onChange={(event) => onOptionsChange({ ...options, theme: event.target.value as ThemeId })}
        >
          <option value="editorial-light">Editorial Light</option>
          <option value="dense-brief">Dense Brief</option>
          <option value="dark-studio">Dark Studio</option>
        </select>
      </label>
      <label>
        Density
        <select
          value={options.density}
          onChange={(event) => onOptionsChange({ ...options, density: event.target.value as Density })}
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
          <option value="dense">Dense</option>
        </select>
      </label>
      <label className="checkLabel">
        <input
          type="checkbox"
          checked={options.includeSourceMetadata}
          onChange={(event) => onOptionsChange({ ...options, includeSourceMetadata: event.target.checked })}
        />
        source map metadata
      </label>
      <label className="fileButton">
        Upload Markdown
        <input
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
          }}
        />
      </label>
      <button type="button" onClick={onCopyHtml}>Copy HTML</button>
      <button type="button" onClick={onDownload}>Download HTML</button>
    </header>
  )
}
```

- [ ] **Step 3: Create split pane and editor**

`src/app/layout/SplitPane.tsx` content:

```tsx
import type { ReactNode } from 'react'

export function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <section className="splitPane">
      <div className="pane editorPane">{left}</div>
      <div className="pane previewPane">{right}</div>
    </section>
  )
}
```

`src/editor/MarkdownEditor.tsx` content:

```tsx
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import type { SourceBlock } from '../compiler/types'

export type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  selectedBlocks: SourceBlock[]
}

export function MarkdownEditor({ value, onChange, selectedBlocks }: MarkdownEditorProps) {
  const selectedLabel = selectedBlocks.length
    ? `Selected source: lines ${selectedBlocks[0].startLine}-${selectedBlocks.at(-1)!.endLine}`
    : 'Click a preview block to reveal its Markdown source.'

  return (
    <div className="editorWrap">
      <div className="sourceStatus">{selectedLabel}</div>
      <CodeMirror
        value={value}
        height="calc(100vh - 88px)"
        extensions={[markdown()]}
        theme="dark"
        basicSetup={{ lineNumbers: true, foldGutter: true }}
        onChange={onChange}
      />
    </div>
  )
}
```

`src/editor/editorSelection.ts` content:

```ts
import type { SourceBlock } from '../compiler/types'

export function findSelectedBlocks(blocks: SourceBlock[], sourceBlockIds: string[]): SourceBlock[] {
  const selected = new Set(sourceBlockIds)
  return blocks.filter((block) => selected.has(block.id))
}
```

- [ ] **Step 4: Create preview iframe and interactions**

`src/preview/previewInteractions.ts` content:

```ts
export type PreviewMessage = {
  type: 'render-node-selected'
  renderNodeId: string
  sourceBlockIds: string[]
}

export function isPreviewMessage(value: unknown): value is PreviewMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as PreviewMessage
  return message.type === 'render-node-selected' && Array.isArray(message.sourceBlockIds)
}
```

`src/preview/HtmlPreview.tsx` content:

```tsx
import { useEffect } from 'react'
import { isPreviewMessage } from './previewInteractions'

export type HtmlPreviewProps = {
  html: string
  onSourceBlocksSelected: (sourceBlockIds: string[]) => void
}

export function HtmlPreview({ html, onSourceBlocksSelected }: HtmlPreviewProps) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (isPreviewMessage(event.data)) {
        onSourceBlocksSelected(event.data.sourceBlockIds)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onSourceBlocksSelected])

  return <iframe className="previewFrame" title="HTML projection" sandbox="allow-scripts" srcDoc={html} />
}
```

- [ ] **Step 5: Wire app state**

Replace `src/app/App.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { compileMarkdownToHtml } from '../compiler/compileMarkdown'
import type { CompileOptions } from '../compiler/types'
import { findSelectedBlocks } from '../editor/editorSelection'
import { MarkdownEditor } from '../editor/MarkdownEditor'
import { HtmlPreview } from '../preview/HtmlPreview'
import { defaultMarkdown } from '../samples/defaultMarkdown'
import { SplitPane } from './layout/SplitPane'
import { Toolbar } from './layout/Toolbar'
import { exportHtml } from '../compiler/exportHtml'

const defaultOptions: CompileOptions = {
  mode: 'brief',
  theme: 'editorial-light',
  density: 'comfortable',
  includeSourceMetadata: true,
}

export function App() {
  const [markdown, setMarkdown] = useState(() => localStorage.getItem('md2html.markdown') || defaultMarkdown)
  const [options, setOptions] = useState<CompileOptions>(defaultOptions)
  const [selectedSourceBlockIds, setSelectedSourceBlockIds] = useState<string[]>([])

  const result = useMemo(() => compileMarkdownToHtml(markdown, options), [markdown, options])
  const selectedBlocks = useMemo(
    () => findSelectedBlocks(result.sourceBlocks, selectedSourceBlockIds),
    [result.sourceBlocks, selectedSourceBlockIds],
  )

  const updateMarkdown = (nextMarkdown: string) => {
    setMarkdown(nextMarkdown)
    localStorage.setItem('md2html.markdown', nextMarkdown)
  }

  const uploadFile = async (file: File) => {
    const text = await file.text()
    updateMarkdown(text)
  }

  const htmlForExport = () => exportHtml(result.html, { includeSourceMetadata: options.includeSourceMetadata })

  const downloadHtml = () => {
    const blob = new Blob([htmlForExport()], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'md2html-projection.html'
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyHtml = async () => {
    await navigator.clipboard.writeText(htmlForExport())
  }

  return (
    <main className="appShell">
      <Toolbar
        options={options}
        onOptionsChange={setOptions}
        onUpload={uploadFile}
        onDownload={downloadHtml}
        onCopyHtml={copyHtml}
      />
      <SplitPane
        left={<MarkdownEditor value={markdown} onChange={updateMarkdown} selectedBlocks={selectedBlocks} />}
        right={<HtmlPreview html={result.html} onSourceBlocksSelected={setSelectedSourceBlockIds} />}
      />
    </main>
  )
}
```

- [ ] **Step 6: Extend CSS for real UI**

Append to `src/styles/app.css`:

```css
.topBar select,
.topBar button,
.fileButton {
  border: 1px solid #cbbda8;
  border-radius: 10px;
  background: #ffffff;
  color: #1f1a14;
  padding: 7px 10px;
  font: inherit;
}

.topBar label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.checkLabel {
  margin-left: auto;
}

.fileButton {
  cursor: pointer;
}

.fileButton input {
  display: none;
}

.editorWrap {
  height: 100%;
}

.sourceStatus {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid #293548;
  color: #93c5fd;
  background: #0f172a;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.previewFrame {
  width: 100%;
  height: calc(100vh - 56px);
  border: 0;
  background: white;
}
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

---

### Task 8: Add E2E tests for MVP user flows

**Files:**
- Create: `tests/e2e/app.spec.ts`

- [ ] **Step 1: Write E2E tests**

`tests/e2e/app.spec.ts` content:

```ts
import { expect, test } from '@playwright/test'

test('renders split markdown editor and HTML projection', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Source-First md2html')).toBeVisible()
  await expect(page.locator('.cm-editor')).toBeVisible()
  await expect(page.locator('iframe.previewFrame')).toBeVisible()
})

test('switches render modes and keeps source metadata in preview', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Mode').selectOption('deck')

  const frame = page.frameLocator('iframe.previewFrame')
  await expect(frame.locator('[data-render-node="node-deck-cover"]')).toBeVisible()
})

test('clicking preview reveals source line range in editor status', async ({ page }) => {
  await page.goto('/')

  const frame = page.frameLocator('iframe.previewFrame')
  await frame.locator('[data-render-node]').first().click()

  await expect(page.locator('.sourceStatus')).toContainText('Selected source: lines')
})

test('can disable source metadata in rendered export option', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('source map metadata').uncheck()

  const frame = page.frameLocator('iframe.previewFrame')
  await expect(frame.locator('[data-render-node]')).toHaveCount(0)
})

test('editing markdown updates the HTML projection without an agent generate step', async ({ page }) => {
  const convertRequests: string[] = []
  await page.route('**/api/convert', async (route) => {
    convertRequests.push(route.request().url())
    await route.abort()
  })

  await page.goto('/')
  await page.locator('.cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.type('# Live Source Update\\n\\nThis changed from Markdown source.')

  const frame = page.frameLocator('iframe.previewFrame')
  await expect(frame.getByText('Live Source Update')).toBeVisible()
  await expect(frame.getByText('This changed from Markdown source.')).toBeVisible()
  expect(convertRequests).toEqual([])
})
```

- [ ] **Step 2: Install Playwright browser**

Run:

```bash
npx playwright install chromium
```

Expected: Chromium browser installed for Playwright.

- [ ] **Step 3: Run E2E tests**

Run:

```bash
npm run e2e
```

Expected: PASS.

---

### Task 9: Final verification and documentation alignment

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run check
npm run e2e
```

Expected: both commands pass.

- [ ] **Step 2: Check PRD acceptance list against implementation**

Open `docs/PRD.md` and confirm each MVP acceptance item is satisfied by one of:

- A unit test in `tests/compiler/`.
- An E2E test in `tests/e2e/app.spec.ts`.
- A visible UI control in `Toolbar.tsx`.
- A data structure in `src/compiler/types.ts`.

Also confirm the competitive guardrail:

- No MVP code path sends Markdown to an agent/LLM endpoint to render the normal preview.
- No MVP code path treats generated HTML as the canonical editable source.
- E2E proves Markdown edits update preview while `/api/convert` is not called.

If an item has no evidence, add either a unit test or E2E test before declaring the MVP complete.

- [ ] **Step 3: Record verification evidence in final implementation report**

The final report must include:

```markdown
## Changed files
- package/config files
- src compiler files
- src app/editor/preview files
- tests

## Product behavior
- Left Markdown editor updates right HTML projection.
- Preview updates directly from Markdown compiler, not agent generation.
- Render modes: Faithful, Reader, Brief, Deck.
- Themes: Editorial Light, Dense Brief, Dark Studio.
- Source map metadata connects render nodes to Markdown blocks.
- Single-file HTML export works.

## Verification
- npm run test
- npm run build
- npm run e2e

## Remaining risks
- Source map is block-level, not token-level.
- AI semantic patching is not implemented in MVP.
- Agent artifact mode is intentionally not implemented in MVP.
- Rich Markdown extensions beyond GFM need additional tests.
```

---

## Self-Review

Spec coverage:

- PRD input/editor/preview/toolbar/mode/theme/source-map/export requirements are covered by Tasks 1-8.
- Architecture compiler pipeline is covered by Tasks 2-6.
- Source map click interaction is covered by Task 7 and Task 8.
- Competitive guardrail against agentic HTML generation is covered by the Task 8 `/api/convert` route assertion.
- Verification is covered by Task 9.

Placeholder scan:

- This plan contains concrete file paths, code snippets, commands, and expected outcomes.
- The implementation intentionally limits source mapping to block level, matching the PRD.

Type consistency:

- `CompileOptions`, `RenderModeId`, `ThemeId`, `SourceBlock`, `RenderNode`, and `RenderPlan` are defined once in `src/compiler/types.ts` and reused across tasks.
