# Source-First Markdown to Human-Optimized HTML Architecture

日期：2026-05-15  
状态：架构 v0.2（grill 后）  
对应 PRD：`docs/PRD.md`  
对应决策：`docs/adr/0001-llm-in-build-render-plan.md` ~ `0005-skeleton-templates.md`

## 1. 架构目标

系统主链路：

```text
Editable Markdown Source
  -> Markdown AST + SourceBlock[]    (确定性)
  -> Shape diff vs lastCommit         (确定性)
  -> SemanticDocument                 (确定性)
  -> RenderPlan                       (LLM 可参与 ← 仅此一步；详见 ADR 0001)
  -> Style Renderer                   (确定性)
  -> HTML Projection + SourceMap
```

核心约束：

- Markdown 是唯一 canonical editable source。
- HTML 是可重新生成的 projection。
- Source map 是第一版核心技术底座，粒度 = RenderNode 边界（ADR 0003）。
- 输出由三个正交轴决定：逻辑 / 密度 / 主题（详见 PRD §5.5 与 `CONTEXT.md`）。
- 主题、骨架、内容语言字典都必须可扩展。
- 第一版本地优先，导出单文件 HTML。
- HTML 由确定性 renderer 产出；LLM 仅在 `buildRenderPlan` 一步参与，且输出 schema 封闭。

## 1.1 竞品校准后的架构边界

`nexu-io/html-anything` 已经覆盖了 agentic HTML editor 的强相邻方向：左侧输入、模板/skill picker、右侧 iframe preview、本地 agent CLI、SSE 流式生成、多 surface 和一键导出。它的主要主链路是：

```text
User Input
  -> Template / Skill
  -> Local Agent CLI
  -> Streaming HTML Artifact
  -> Preview / Export
```

本项目不能复制这条主链路。我们的主链路必须保证两条不变量（详见 `CONTEXT.md` Source-First 条目）：

1. **可追溯性**：任何主要 HTML 节点都能追溯到至少一个 SourceBlock。
2. **HTML 由确定性 renderer 产出**：不允许 agent 直接写 HTML 字符串作为 projection。

架构含义：

- `compiler/` 是核心产品，不是 agent prompt 的包装层。
- `compiler/buildRenderPlan` 步骤允许 LLM 参与，但 LLM 输出必须是结构化 RenderPlan，不允许 HTML 字符串、不允许引入新内容。详见 ADR 0001。
- `skeletons/` 是产品团队预写的骨架模板配置目录，AI 必须在骨架声明的"区"内填空（ADR 0005）。
- `preview/` 渲染 projection，并把点击事件映射回 `SourceBlock`。
- AI 辅助编辑的产物优先是 `MarkdownPatch`（改源），不允许 HTML diff-edit 成为主编辑模型。
- 如果未来支持 agent 直接生成 HTML，必须标记为独立 mode（例如 `agent-artifact`），且明确不参与 source map 不变量，不能替代 source-mapped 主链路。

## 2. 推荐技术栈

### 2.1 App 层

建议：

- Vite
- React
- TypeScript

理由：

- 适合快速构建本地 Web 工具。
- 组件生态成熟。
- 方便把 editor、preview、toolbar 拆成独立模块。
- TypeScript 有利于锁定 SourceBlock、RenderPlan、Theme 等核心契约。

### 2.2 Markdown 编辑器

建议：CodeMirror 6。

理由：

- 比 Monaco 更轻。
- Markdown 支持成熟。
- 行号、选区、高亮、滚动控制、定位源行都更直接。
- 适合后续实现“右侧点击 → 左侧定位”。

### 2.3 Markdown 解析

建议：unified / remark 系列，或 markdown-it。

第一版推荐 unified/remark：

- remark 可以保留 AST position。
- position 对 source map 关键。
- 后续可以通过插件处理 GFM、表格、脚注、数学公式。

### 2.4 HTML 安全与预览

- 预览使用 iframe `srcdoc`。
- iframe sandbox 配置：**仅 `allow-scripts`**，其他权限全部关闭。
  - 关闭 `allow-same-origin` → iframe 视为独立 origin，无法读主页面 cookie/localStorage。
  - 关闭 `allow-forms / allow-popups / allow-top-navigation / allow-downloads / allow-modals` → 防止用户 Markdown 内嵌恶意 HTML 弹窗或跳转。
  - `allow-scripts` 必须保留：iframe 内部脚本要监听点击、postMessage 给主页面（ADR 0003 的点击→定位机制依赖此）。
- postMessage（iframe ↔ 主页面）天然不需要 `allow-same-origin`。
- Markdown 内嵌 HTML 默认 sanitize 后保留（剥离 script / iframe / object / on* 事件属性）；MVP 不提供"原样保留"开关。

### 2.5 测试

建议：

- Vitest：模块单元测试。
- Playwright：端到端预览和下载测试。

额外架构回归要求：

- 测试必须证明 Markdown 修改会直接触发 compiler 更新 HTML。
- 测试必须证明核心预览路径不需要 `/api/convert` 之类的 agent endpoint。
- 测试必须证明 source metadata 是 renderer 输出，而不是 agent 输出里碰巧存在。

## 3. 模块边界

建议目录结构：

```text
src/
  app/
    App.tsx
    layout/
      SplitPane.tsx
      Toolbar.tsx
  editor/
    MarkdownEditor.tsx
    editorSelection.ts
  preview/
    HtmlPreview.tsx
    previewInteractions.ts
  compiler/
    compileMarkdown.ts
    extractSourceBlocks.ts
    detectShape.ts
    detectContentLanguage.ts
    buildSemanticDocument.ts
    buildRenderPlan.ts
    buildRenderPlanFaithful.ts    // 原文顺序的确定性实现
    buildRenderPlanLlm.ts         // 走 AI 的实现 + 回落
    renderHtmlDocument.ts
    exportHtml.ts
    cache.ts
    types.ts
  skeletons/
    types.ts                       // SkeletonConfig 类型
    resultFirstCompact.ts          // (logic, density) 对应一份配置
    resultFirstComfortable.ts
    resultFirstPerScreen.ts
    narrativeCompact.ts
    narrativeComfortable.ts
    narrativePerScreen.ts
    noneCompact.ts
    noneComfortable.ts
    nonePerScreen.ts
    index.ts                       // 按 (logic, density) 查找
  themes/
    tokens.ts
    editorialLight.ts
    denseBrief.ts
    darkStudio.ts
  i18n/
    types.ts
    ui/
      zh.ts
      en.ts
    output/
      zh.ts
      en.ts
    prompts/
      zh.ts
      en.ts
    samples/
      zh.ts
      en.ts
  tests/
```

职责说明：

| 模块 | 职责 |
|---|---|
| `editor/` | Markdown 输入、行号、选区、高亮、源定位 |
| `preview/` | iframe 渲染、右侧区块事件、source map 交互 |
| `compiler/` | 从 Markdown 到 HTML projection 的主链路（含形状判定 + LLM 调用 + 缓存） |
| `skeletons/` | 9 份 (逻辑, 密度) 对应的骨架配置；可扩展为插件 |
| `themes/` | 主题 token 与 CSS 变量 |
| `i18n/` | UI / 输出 / prompt / 示例 四类字典；按 LangId 索引 |

## 4. 核心数据结构

### 4.1 SourceBlock

SourceBlock 是 source map 的基础单位。第一版做 block-level mapping，不做 token-level mapping。

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
```

设计原则：

- `id` 应在同一 Markdown 文档内稳定。
- 第一版可以使用 `block-${index}`。
- 后续可升级为基于内容 hash + position 的稳定 id。
- `startLine/endLine` 服务 UI 定位。
- `startOffset/endOffset` 服务编辑器选区。

### 4.2 SemanticDocument

SemanticDocument 是对 Markdown 内容的轻量理解，不直接绑定视觉。

```ts
export type SemanticDocument = {
  title: string
  subtitle?: string
  blocks: SourceBlock[]
  outline: OutlineItem[]
  stats: DocumentStats
  sections: SemanticSection[]
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
```

第一版 SemanticDocument 不做复杂 NLP，只做可靠抽取：

- 标题结构。
- 段落组。
- 列表组。
- 表格数量。
- 代码块数量。
- 简单摘要候选。

### 4.3 RenderPlan

RenderPlan 是"信息设计计划"。它决定 HTML 的结构，但不直接决定主题样式。结构由 (逻辑, 密度) 联合决定的骨架模板约束。

```ts
export type LogicId = 'none' | 'result-first' | 'narrative'
export type DensityId = 'comfortable' | 'compact' | 'per-screen'

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
  | 'appendix'
// 注：原 'slide' kind 已删除（ADR 0005）。
// "一屏一页"由 density='per-screen' 在 renderer 层用包装实现，不引入新 kind。

export type RenderNode = {
  id: string
  kind: RenderNodeKind
  title?: string
  body?: string
  sourceBlockIds: string[]
  children?: RenderNode[]
  metadata?: Record<string, string | number | boolean>
}

export type RenderPlan = {
  logic: LogicId
  density: DensityId
  title: string
  nodes: RenderNode[]
  sourceMap: SourceMapIndex
}

export type SourceMapIndex = {
  byRenderNodeId: Record<string, string[]>
  bySourceBlockId: Record<string, string[]>
}
```

约束：

- 每个 RenderNode 必须有 `sourceBlockIds`。纯装饰节点可以是空数组，但不能承载原文外的新事实。
- 允许一个 render node 来自多个 source blocks。
- 允许一个 source block 被多个 render nodes 引用。
- **原子节点**（`quote / table / code`）的 `sourceBlockIds` 长度恒为 1（ADR 0003）。
- AI 生成的 RenderPlan 必须满足骨架模板声明的区集合与顺序；违反 → 非法响应 → 回落原文顺序逻辑（ADR 0001 + 0005）。

### 4.4 Theme

Theme 是视觉 token，不应该改变语义结构。

```ts
export type ThemeId = 'editorial-light' | 'dense-brief' | 'dark-studio'

export type ThemeTokens = {
  id: ThemeId
  name: string
  color: {
    background: string
    surface: string
    surfaceAlt: string
    text: string
    muted: string
    accent: string
    border: string
  }
  typography: {
    bodyFont: string
    displayFont: string
    monoFont: string
  }
  radius: {
    sm: string
    md: string
    lg: string
  }
  spacing: {
    page: string
    section: string
    card: string
  }
  shadow: {
    card: string
  }
}
```

### 4.5 CompileOptions

```ts
export type LangId = 'zh' | 'en'  // 可扩展

export type CompileOptions = {
  logic: LogicId
  density: DensityId
  theme: ThemeId
  contentLanguage: LangId      // 自动检测或用户覆盖（ADR 0004）
  includeSourceMetadata: boolean
}
```

注：UI 语言不进入 `CompileOptions`——它不影响 HTML 输出，只影响工具自身的 chrome 与示例 Markdown。

## 5. 编译主链路

主入口：

```ts
export type CompileResult = {
  markdown: string
  sourceBlocks: SourceBlock[]
  shape: ShapeSignature
  semanticDocument: SemanticDocument
  renderPlan: RenderPlan
  html: string
  llmInvoked: boolean              // 本次是否调用了 LLM
  fellBackToFaithful: boolean      // LLM 失败导致的回落
}

export async function compileMarkdownToHtml(
  markdown: string,
  options: CompileOptions,
  context?: CompileContext         // 上次结果，用于形状判定与缓存
): Promise<CompileResult>
```

流程：

1. `extractSourceBlocks(markdown)`
   - 解析 Markdown AST，生成 SourceBlock[]，保留行号/偏移。
   - `id = block-${index}`（ADR 0002 + ADR 0005 决定 MVP 不做跨编辑稳定 id）。

2. `detectShape(sourceBlocks)` → `ShapeSignature`
   - 计算 `(block.type 序列, 每个 heading 的 depth)`。
   - 与 `context.lastShape` 对比，决定本次走"文本编辑路径"或"结构编辑路径"。

3. `detectContentLanguage(markdown)` （若 `options.contentLanguage = 'auto'`）
   - CJK 占比 > 30% → `zh`，否则 `en`。

4. `buildSemanticDocument(sourceBlocks)` （确定性）
   - 建立标题层级、统计文档结构、生成 sections。

5. `buildRenderPlan(semanticDocument, options)` ← **本步骤是 AI 唯一可参与点**
   - 加载骨架模板：`getSkeleton(options.logic, options.density)`。
   - 路径 A（`logic = 'none'` 或文本编辑路径）：用骨架的确定性实现。
   - 路径 B（其他逻辑 + 结构编辑路径）：
     - 缓存键：`hash(shape, logicId, densityId, blockTextDigests, contentLang)`。命中 → 跳过 LLM。
     - 未命中：调 LLM，输入 (sourceBlocks, skeleton, contentLang)，输出受骨架约束的 RenderPlan。
     - LLM 失败 / 超时 / 输出违反骨架 → 回落到路径 A，`fellBackToFaithful = true`。

6. `renderHtmlDocument(renderPlan, options)` （确定性）
   - 选主题 tokens。
   - 渲染完整 HTML。
   - 每个 RenderNode 的最外层元素挂 `data-render-node` + `data-source-blocks`（ADR 0003）。
   - `density = 'per-screen'` 时把现有节点用一层壳子包成分页（不引入新 kind）。

7. `exportHtml(compileResult, options)`
   - 输出单文件 HTML。
   - `<html lang>` = `options.contentLanguage`。
   - 根据 `options.includeSourceMetadata` 保留或剥离 `data-source-*`。默认剥离。

## 6. 骨架模板 + 密度修饰

每个 (逻辑, 密度) 组合对应一份骨架模板。骨架声明：

- 包含哪些"区"（节点 kind）。
- 每个区是必有还是可选。
- 可选区的出现条件。
- 区之间的顺序。

详见 ADR 0005。

### 6.1 骨架配置类型

```ts
export type SkeletonRegion = {
  kind: RenderNodeKind
  required: boolean                       // 必有 / 可选
  conditional?: (doc: SemanticDocument) => boolean  // 可选区的出现条件
  promptHint?: string                     // LLM 填空时的提示
}

export type SkeletonConfig = {
  logic: LogicId
  density: DensityId
  regions: SkeletonRegion[]               // 按顺序排列
}
```

### 6.2 9 份骨架内容

#### 6.2.1 原文顺序（`logic = 'none'`）

不调用 LLM，骨架直接镜像 Markdown 结构。

- `hero`：从文档第一个 heading 或文件名取标题。
- `section`：按顶层 heading 分组，原子节点（quote / table / code）按原位置内联。

三个密度的差异：

- `comfortable`：单栏，留白宽。
- `compact`：多栏（CSS grid），同样的 RenderPlan 结构。
- `per-screen`：把每个顶层 section 包一层壳子作为一屏。

#### 6.2.2 结果先行（`logic = 'result-first'`）

骨架：

| 区 | required | 条件 |
|---|---|---|
| `hero` | 是 | 必有 |
| `summary` | 否 | AI 能在原文里识别出明确结论时才出现；找不到则跳过 |
| `section`（证据组）* | 是 | LLM 按相关性分组 |
| `appendix` | 否 | 仅当还有未归类内容时出现 |

密度差异：

- `comfortable`：单栏，appendix 默认展开。
- `compact`：appendix 默认折叠（CSS `<details>`）；证据 section 之间允许多栏分区。
- `per-screen`：hero / summary / 每个证据组各自一屏；appendix 在末尾。

#### 6.2.3 时序展开（`logic = 'narrative'`）

骨架：

| 区 | required | 条件 |
|---|---|---|
| `hero` | 是 | 必有 |
| `toc` | 否 | section 数 ≥ 4 时出现 |
| `section`（背景） | 否 | AI 识别到背景类内容时出现 |
| `section`（问题/调查） | 否 | AI 识别到问题类内容时出现 |
| `section`（方案） | 否 | AI 识别到方案类内容时出现 |
| `section`（结果） | 否 | AI 识别到结果类内容时出现 |
| `appendix` | 否 | 仅当还有未归类内容时出现 |

至少有一个 section 出现是必须的（否则等价于 `none`）。

密度差异同上。

### 6.3 LLM 的工作范围（path B）

输入：`(SourceBlock[], SkeletonConfig, contentLanguage)`。

LLM 必须输出符合骨架声明的 RenderPlan：

1. 把每个 SourceBlock 分类（结论 / 证据 / 背景 / 问题 / 方法 / 结果 / 其他）。
2. 按骨架的区顺序把 source blocks 分配到对应 RenderNode。
3. 为每个出现的区生成 `title`（用 `contentLanguage`）。

不允许：

- 改变骨架声明的区数量与顺序。
- 创造新的 RenderNode kind。
- 引入 SourceBlock 之外的文字。
- 拆散原子节点（quote / table / code）。

违反任一条 → 视为非法响应 → 回落到 `logic = 'none'` 的确定性路径。

## 7. Source Map 机制

### 7.1 HTML metadata

**粒度规则（ADR 0003）**：每个 RenderNode 渲染出的最外层 HTML 元素挂 `data-render-node` 和 `data-source-blocks`；其余子元素一律不挂。

```html
<section
  data-render-node="node-7"
  data-source-blocks="block-12 block-13"
>
  <h2>证据组：性能数据</h2>
  <p>...</p>
  <ul><li>...</li></ul>
</section>
```

`<h2>`、`<p>`、`<li>` 都不带 source map 属性——它们的来源通过外层 `<section>` 的 `data-source-blocks` 反推。

导出时若 `includeSourceMetadata = false`（默认），两个属性都被剥离：

```html
<section>
  ...
</section>
```

### 7.2 Preview interaction

预览 iframe 中点击节点时：

1. 找到最近的 `[data-render-node]` 元素。
2. 读取 `data-source-blocks`。
3. postMessage 给父页面。
4. 父页面查找对应 SourceBlock。
5. 编辑器高亮并滚动到 `startLine`。

消息格式：

```ts
export type PreviewMessage = {
  type: 'render-node-selected'
  renderNodeId: string
  sourceBlockIds: string[]
}
```

### 7.3 编辑器响应

编辑器收到 sourceBlockIds 后：

- 找到第一个 block。
- 滚动到 `startLine`。
- 临时高亮 `startLine` 到 `endLine`。
- 记录当前 selectedSourceBlockIds。

### 7.4 增量更新策略（ADR 0002 落地）

MVP 的"增量"是**形状级别的二分类**，不做 token-level / block-level diff：

```
new = parse(markdown)
if shape(new) == shape(lastCommittedSourceBlocks):
    # 文本编辑路径：保留 lastRenderPlan，仅替换 block 的 text 字段
    return renderHtml(lastRenderPlan, withUpdatedTexts(newSourceBlocks))
else:
    # 结构编辑路径
    1. 立即用 logic='none' 渲染 fallback（用户体感即时）
    2. cancel 任何 pending LLM 调用
    3. 750ms debounce 后触发 buildRenderPlan(logic, density)
    4. LLM 完成 → 替换 lastRenderPlan、重渲染 HTML
```

手动按钮 "重新生成布局" 走 path B 的强制版：

```
forceRebuildRenderPlan() {
    cancel pending LLM 调用
    trigger buildRenderPlan(logic, density) 立即
    UI 显示 loading
}
```

未来若需要更细粒度增量（block 级别 diff、跨编辑稳定 id），见 ADR 0002 的"未来扩展路径"段。

## 8. HTML 导出

导出结果应是完整 HTML：

```text
<!doctype html>
<html lang="zh">  <!-- 来自 contentLanguage，不来自 UI 语言 -->
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>...</title>
    <style>/* theme + layout css */</style>
  </head>
  <body>
    <main>...</main>
    <script>/* only interactions needed for exported file */</script>
  </body>
</html>
```

导出约束：

- 默认内联 CSS。
- 默认不加载外部 CDN。
- 默认不包含编辑器代码。
- 只包含右侧 HTML 消费所需代码。
- source metadata 可开关，**默认关闭**。
- `<html lang>` 来自 `CompileOptions.contentLanguage`（ADR 0004）。

## 9. 扩展机制

### 9.1 新输入类型

未来新增 PDF/DOCX/URL/CSV 时，不应绕过主链路。应先转成可编辑 Markdown 或 SourceBlock-like structure。

推荐接口：

```ts
export type InputAdapter = {
  id: string
  accept: string[]
  load(input: File | string): Promise<MarkdownSource>
}

export type MarkdownSource = {
  markdown: string
  origin: {
    kind: 'paste' | 'file' | 'url' | 'generated'
    name?: string
  }
}
```

### 9.2 新 Render Mode

新增模式只需实现：

```ts
export type RenderMode = {
  id: RenderModeId | string
  name: string
  buildPlan(document: SemanticDocument): RenderPlan
}
```

### 9.3 新 Theme

新增主题只需提供 ThemeTokens 和少量 mode-specific CSS overrides。

```ts
export type Theme = {
  id: string
  tokens: ThemeTokens
  css: string
}
```

### 9.4 未来 AI Patch

未来 AI 辅助编辑必须优先落回 Markdown：

```ts
export type MarkdownPatch = {
  sourceBlockIds: string[]
  replacementMarkdown: string
  reason: string
}
```

流程：

1. 用户点击右侧 render node。
2. 系统通过 source map 找到 source blocks。
3. 用户说"把这个压缩成 CEO 能看懂的版本"。
4. AI 生成 MarkdownPatch。
5. 编辑器应用 patch。
6. 系统重新编译 HTML。

原则：AI 不直接修改 HTML projection，除非用户明确进入开发者模式。

注：原 v0.1 文档曾提及 `IRPatch`，本版本已删除该词。如未来需要"AI 局部改 RenderPlan 而不重跑整篇"的能力，再在新的 ADR 中定义形态。

### 9.5 未来 Agent Artifact Mode

可以借鉴 `nexu-io/html-anything` 的本地 agent CLI 复用、SSE streaming、template picker 和 diff-edit 思想，但必须作为旁路能力，而不是替代主链路。

建议接口：

```ts
export type AgentArtifactRequest = {
  markdown: string
  semanticDocument: SemanticDocument
  renderPlan?: RenderPlan
  instruction: string
}

export type AgentArtifactResult = {
  html: string
  provenance: 'agent-artifact'
  sourceBlockIdsUsed: string[]
}
```

约束：

- Agent artifact mode 输出可以用于探索新样式。
- 若用户要把结果纳入可持续编辑链路，必须转回 RenderPlan / Theme / MarkdownPatch。
- 不允许把 agent 生成的 HTML 当作 canonical source。
- 不允许因为 agent 输出漂亮而丢弃 source map。

## 10. 测试策略

### 10.1 单元测试

必须测试：

- Markdown → SourceBlock[]（解析正确性 + 行号/偏移）。
- `detectShape(blocks)` 的稳定性：相同 type/depth 序列产生相同签名。
- `detectContentLanguage(markdown)`：中文 / 英文 / 混合素材。
- SemanticDocument outline。
- 9 份骨架配置的合法性（必有区数量 ≥ 1、原子节点约束、可选区条件可执行）。
- 每个 (logic, density) 的确定性 RenderPlan 路径（path A）。
- AI path（path B）的输出校验：违反骨架 → 回落 path A。
- HTML metadata 输出（粒度规则）。
- metadata stripping。
- LangId 字典完整性（每个 UI/output/prompt key 在所有 LangId 下都有定义）。

### 10.2 集成测试

必须测试：

- 文本编辑（形状不变）→ 不调用 LLM；既有 RenderPlan 内容文字被替换；HTML 结构稳定。
- 结构编辑（形状变）→ 立即显示原文顺序 fallback；750ms 后 LLM 完成并覆盖。
- 撤销结构变化 → 命中缓存，不重复调用 LLM。
- 切换逻辑 → 调用 LLM；切换密度 / 主题 → 不调用 LLM。
- 切换 UI 语言 → 不重编译；切换内容语言 → 重编译。
- 手动 "重新生成布局" → 强制 LLM 调用，无视形状。
- 下载 HTML 包含完整 document，`<html lang>` 与内容语言匹配。

### 10.3 不变量测试

必须断言（写成 property-based test）：

- `RenderPlan.nodes.length === HTML.querySelectorAll('[data-render-node]').length`。
- 每个 `[data-source-blocks]` 元素都同时有 `[data-render-node]`，反之亦然。
- 任何 `quote / table / code` 节点的 `sourceBlockIds.length === 1`。
- 当 LLM 输出违反骨架时，`fellBackToFaithful === true`。
- 没有任何 render-mode 模板字符串里出现字面中文/英文标签（必须走 `t(key)`）。

### 10.4 E2E 测试

必须测试：

- 打开页面看到双栏，左侧出示例 Markdown，右侧出 HTML。
- 粘贴 Markdown 看到预览。
- 上传 `.md` 看到预览。
- 点击右侧区块，左侧对应行高亮。
- 切换三轴下拉，右侧响应正确。
- 切换命名预设，三轴下拉同步变化。
- 下载 HTML 后文件内容包含 `<!doctype html>`，可双击在浏览器打开。
- iframe sandbox 配置正确（只允许 scripts，其他权限关闭）。

## 11. 版本演进

### v0.1 MVP

- 双栏编辑/预览。
- Markdown upload/paste。
- 4 render modes。
- 3 themes。
- source map core。
- HTML 下载。

### v0.2

- 更强 source map UI。
- Mermaid/数学公式/代码高亮增强。
- AI 手动重组按钮。
- 更多主题。

### v0.3

- 右侧区块语义编辑 → Markdown patch。
- 多输入 adapter。
- 发布/分享。

### v1.0

- 插件化 render modes。
- 模板/主题生态。
- 协作评论。
- Artifact gallery。
