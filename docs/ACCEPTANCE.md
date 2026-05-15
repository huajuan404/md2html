# 验收方法

- 日期:2026-05-15
- 状态:验收方法 v0.1
- 相关:`docs/PRD.md` §10、`docs/ARCHITECTURE.md` §10、`fixtures/`、五个 ADR

## 起点(AI 实现者从这里开始)

如果你是来实现这个项目的 AI agent 或工程师,先按顺序读完:

1. **`CONTEXT.md`** —— 领域术语词典(逻辑 / 密度 / 主题 / 形状 / 骨架等)。
2. **`docs/PRD.md`** —— 产品需求与验收清单。
3. **`docs/ARCHITECTURE.md`** —— 主链路、模块边界、数据结构。
4. **`docs/adr/0001-...md` ~ `0005-...md`** —— 五个核心决策记录。
5. **`docs/ACCEPTANCE.md`(本文件)** —— 验收方法。
6. **`fixtures/`** —— 第一个 (输入, golden) 对。

实施第一步建议:把 `fixtures/inputs/readme.md` 解析成 SourceBlock[],验证输出能匹配 §3.1 的形状期望。这是最小可验证的产出,从这一步往后续展开。

## 一、为什么是三层验收

最自然的验收思路是"给定输入,系统输出等于 golden HTML"。但本系统的输出有两类不确定性:

1. **AI 抖动**:LLM 在 `buildRenderPlan` 步骤的输出不字节稳定。
2. **视觉细节抖动**:浏览器渲染、字体回落、抗锯齿差异都会让像素不一致。

因此字节级 / 像素级对照行不通,会让 CI 永远红。改用三层叠加:

| 层 | 检查的是 | 容忍度 | 跑法 |
|---|---|---|---|
| L1 视觉 golden | 输出**看起来像** golden | 人眼对位 + 像素阈值 | 截图 + 像素 diff |
| L2 结构断言 | 输出**结构满足**硬不变量 | 字节级精确 | Vitest 单测 |
| L3 端到端流程 | 用户**完整路径**能跑通 | 行为级精确 | Playwright |

每层独立可跑,失败信号语义不同,debug 路径清晰。

## 二、L1 视觉 golden

### 定义

每份 golden HTML 是**人(或强 LLM)预先产出的"目标视觉"**,放在 `fixtures/golden/<input>-<preset>.html`。开发者实现系统时,**目标是让系统输出在视觉上接近 golden**,不要求字节一致。

### 性质

- 每份 golden 是**完整、独立、可双击打开**的 HTML 文件(内联 CSS/JS,无外部依赖)。
- 携带真实的 `data-render-node` 和 `data-source-blocks` 属性(模拟系统应产出的 source map)。
- 不依赖任何运行环境,审 golden 就是审 HTML 文件本身。

### 当前清单

| 输入 | 预设 | Golden 文件 | 状态 |
|---|---|---|---|
| `readme.md` | Reader | `fixtures/golden/readme-reader.html` | ✅ 完成 |
| `readme.md` | Brief | `fixtures/golden/readme-brief.html` | ✅ 完成 |
| `readme.md` | Faithful | (无,自动测试覆盖) | — |
| `readme.md` | Deck | TODO | ⏳ |
| `karpathy-thread.md` | Brief | TODO | ⏳ |
| `karpathy-thread.md` | Deck | TODO | ⏳ |
| `meeting-summary.md` | Brief | TODO | ⏳ |
| `ai-long-answer.md` | Brief | TODO | ⏳ |
| `ai-long-answer.md` | Deck | TODO | ⏳ |
| `tutorial.md` | Deck | TODO | ⏳ |
| `data-report.md` | Brief | TODO | ⏳ |
| `landing-page.md` | Brief | TODO | ⏳ |
| `research-note.md` | Reader | TODO | ⏳ |

`Faithful` 预设(`logic: none`)用例不需要 golden——它就是"按 Markdown 原结构铺",L2 的结构断言完全可以覆盖。

### 添加新 golden 的流程

1. 在 `fixtures/inputs/` 加一份代表性 Markdown 输入。
2. 写一份 golden HTML 到 `fixtures/golden/<input>-<preset>.html`,可由产品决策者手写、或让强 LLM 在无约束条件下产出。
3. golden 必须挂正确的 `data-render-node` / `data-source-blocks`,引用的 block id 必须能在输入的 SourceBlock[] 里对上。
4. 更新本文件 §2.3 清单。

### 比对方法

Playwright 截图 + 阈值容忍:

```ts
test('readme reader visual', async ({ page }) => {
  // 系统产出(运行 compiler)
  const systemHtml = compileMarkdownToHtml(readmeMd, { logic: 'narrative', density: 'comfortable', theme: 'editorial-light', ... }).html
  await page.setContent(systemHtml)
  const systemShot = await page.screenshot()

  // golden
  const goldenHtml = fs.readFileSync('fixtures/golden/readme-reader.html', 'utf8')
  await page.setContent(goldenHtml)
  const goldenShot = await page.screenshot()

  // 像素 diff,阈值 5%(允许字体/抗锯齿差异)
  expect(pixelMatch(systemShot, goldenShot)).toBeLessThan(0.05)
})
```

像素 diff 工具可选 `pixelmatch` / `odiff` / `playwright-visual-regression`。MVP 阶段建议:**人审为主、机审为辅**——CI 上跑截图存为 artifact,人眼对位即可。

## 三、L2 结构断言

这一层是验收的**硬骨头**。所有断言都是确定性的,不依赖 AI 或视觉。

### 3.1 SourceBlock 切分(对应 PRD §10.8 #1)

对每份输入,验证 parser 输出的 SourceBlock[] 满足预期形状。

**`readme.md` 期望**:48 个 block,类型序列与 heading depth 如下:

```
1: heading (depth=1)
2: quote
3: paragraph
4: paragraph
5: heading (depth=2)
6: paragraph
7: paragraph
8: table
9: paragraph
10: paragraph
11: heading (depth=2)
12: list
13: heading (depth=2)
14: list
15: heading (depth=2)
16: paragraph
17: heading (depth=3)
18: paragraph
19: list
20: heading (depth=3)
21: paragraph
22: list
23: heading (depth=3)
24: paragraph
25: heading (depth=2)
26: paragraph
27: table
28: heading (depth=2)
29: heading (depth=3)
30: paragraph
31: heading (depth=3)
32: paragraph
33: heading (depth=3)
34: paragraph
35: heading (depth=3)
36: paragraph
37: heading (depth=3)
38: paragraph
39: heading (depth=2)
40: list (ordered)
41: heading (depth=2)
42: list
43: heading (depth=2)
44: table
45: heading (depth=2)
46: paragraph
47: table
48: paragraph
```

断言代码骨架:

```ts
test('readme.md → 48 SourceBlocks with expected shape', () => {
  const md = fs.readFileSync('fixtures/inputs/readme.md', 'utf8')
  const blocks = extractSourceBlocks(md)
  expect(blocks.length).toBe(48)
  expect(blocks[0]).toMatchObject({ type: 'heading', depth: 1 })
  expect(blocks[1]).toMatchObject({ type: 'quote' })
  expect(blocks[7]).toMatchObject({ type: 'table' })
  // ... 完整断言由 fixtures/expected/readme.shape.json 提供
})
```

每份输入对应一份 `fixtures/expected/<input>.shape.json`,声明完整 type+depth 序列。

### 3.2 Source map 不变量(ADR 0003)

对任意 (输入, 预设) 组合产出的 HTML:

```ts
test('source map invariants', () => {
  const result = compileMarkdownToHtml(md, options)
  const dom = parseHTML(result.html)

  // 不变量 1: RenderPlan.nodes.length === [data-render-node] 元素数
  const taggedElements = dom.querySelectorAll('[data-render-node]')
  expect(taggedElements.length).toBe(result.renderPlan.nodes.length)

  // 不变量 2: 每个带 data-source-blocks 的元素都同时带 data-render-node
  for (const el of dom.querySelectorAll('[data-source-blocks]')) {
    expect(el.hasAttribute('data-render-node')).toBe(true)
  }

  // 不变量 3: data-source-blocks 引用的 block id 都存在
  const validIds = new Set(result.sourceBlocks.map(b => b.id))
  for (const el of taggedElements) {
    const blockIds = el.getAttribute('data-source-blocks').split(' ').filter(Boolean)
    for (const id of blockIds) {
      expect(validIds.has(id)).toBe(true)
    }
  }
})
```

### 3.3 原子节点约束(ADR 0003)

```ts
test('atomic nodes have exactly 1 source block', () => {
  const result = compileMarkdownToHtml(md, options)
  for (const node of allRenderNodes(result.renderPlan)) {
    if (['quote', 'table', 'code'].includes(node.kind)) {
      expect(node.sourceBlockIds.length).toBe(1)
    }
  }
})
```

### 3.4 骨架契约(ADR 0005)

对每个 (logic, density),AI 产出的 RenderPlan 必须匹配骨架声明:

```ts
test('result-first + compact: skeleton compliance', () => {
  const skeleton = getSkeleton('result-first', 'compact')
  const result = compileMarkdownToHtml(md, {
    logic: 'result-first', density: 'compact', theme: 'dense-brief', ...
  })

  // 必有区都出现了
  for (const region of skeleton.regions.filter(r => r.required)) {
    expect(result.renderPlan.nodes.some(n => n.kind === region.kind)).toBe(true)
  }

  // 区的顺序符合骨架声明
  const actualKinds = result.renderPlan.nodes.map(n => n.kind)
  const skeletonKinds = skeleton.regions.map(r => r.kind)
  expect(actualKinds).toMatchSkeletonOrder(skeletonKinds)

  // 没出现骨架没声明的 kind
  for (const node of result.renderPlan.nodes) {
    expect(skeletonKinds).toContain(node.kind)
  }
})
```

### 3.5 LLM 失败回落(ADR 0001)

```ts
test('LLM failure → fall back to faithful', async () => {
  const mockLlm = { invoke: async () => { throw new Error('429 rate limited') } }
  const result = await compileMarkdownToHtml(md, {
    logic: 'result-first', ...
  }, { llm: mockLlm })

  expect(result.fellBackToFaithful).toBe(true)
  expect(result.renderPlan.logic).toBe('none')  // 实际跑的是 faithful
})
```

### 3.6 形状变化驱动重编译(ADR 0002)

```ts
test('text-only edit does NOT invoke LLM', async () => {
  const llmSpy = jest.spyOn(llmClient, 'invoke')
  const ctx = await compileMarkdownToHtml(md1, options)

  // 改一个错别字,shape 不变
  const md2 = md1.replace('适合', '合适')  // 句内换字
  await compileMarkdownToHtml(md2, options, { lastResult: ctx })

  expect(llmSpy).not.toHaveBeenCalled()
})

test('structural edit DOES invoke LLM after debounce', async () => {
  const llmSpy = jest.spyOn(llmClient, 'invoke')
  const ctx = await compileMarkdownToHtml(md1, options)

  // 加一段新内容,shape 变了
  const md2 = md1 + '\n\n新的一段。'
  await compileMarkdownToHtml(md2, options, { lastResult: ctx })

  expect(llmSpy).toHaveBeenCalledTimes(1)
})
```

### 3.7 缓存命中(ADR 0002)

```ts
test('undo structural change → cache hit, no LLM invoke', async () => {
  const llmSpy = jest.spyOn(llmClient, 'invoke')
  const md1 = readmeMd
  const md2 = md1 + '\n\n新的一段。'

  await compileMarkdownToHtml(md1, options)
  await compileMarkdownToHtml(md2, options)
  llmSpy.mockClear()
  await compileMarkdownToHtml(md1, options)  // 撤回

  expect(llmSpy).not.toHaveBeenCalled()
})
```

### 3.8 UI 语言不影响输出(ADR 0004)

```ts
test('UI language change does NOT trigger recompile', async () => {
  // UI 语言切换是 React state 操作,不应路由到 compile
  // 这条更适合 L3 E2E 验证
})
```

### 3.9 内容语言切换触发重算(ADR 0004)

```ts
test('content language change → cache miss → LLM invoke', async () => {
  const llmSpy = jest.spyOn(llmClient, 'invoke')

  await compileMarkdownToHtml(md, { ...options, contentLanguage: 'zh' })
  llmSpy.mockClear()
  await compileMarkdownToHtml(md, { ...options, contentLanguage: 'en' })

  expect(llmSpy).toHaveBeenCalledTimes(1)
})
```

### 3.10 输出 `<html lang>` 来自内容语言(ADR 0004)

```ts
test('export <html lang> matches contentLanguage', () => {
  const zhResult = compileMarkdownToHtml(zhMd, { ...options, contentLanguage: 'zh' })
  expect(zhResult.html).toMatch(/<html\s+[^>]*lang="zh"/)

  const enResult = compileMarkdownToHtml(enMd, { ...options, contentLanguage: 'en' })
  expect(enResult.html).toMatch(/<html\s+[^>]*lang="en"/)
})
```

### 3.11 Source metadata 开关(PRD §5.8)

```ts
test('includeSourceMetadata: false strips all data-source-* and data-render-node', () => {
  const result = compileMarkdownToHtml(md, { ...options, includeSourceMetadata: false })
  expect(result.html).not.toMatch(/data-source-blocks/)
  expect(result.html).not.toMatch(/data-render-node/)
})

test('includeSourceMetadata: true preserves all source map attributes', () => {
  const result = compileMarkdownToHtml(md, { ...options, includeSourceMetadata: true })
  expect(result.html).toMatch(/data-source-blocks="block-\d+/)
})
```

### 3.12 i18n 字典完整性(ADR 0004)

```ts
test('every output label key exists in all supported languages', () => {
  const zhKeys = new Set(Object.keys(outputDictZh))
  const enKeys = new Set(Object.keys(outputDictEn))
  expect(zhKeys).toEqual(enKeys)
})

test('no render-mode template contains literal Chinese/English strings', () => {
  // 静态扫描:render-mode 模板代码不能含 Chinese 或英文 label 字面量,必须走 t(key)
  const sources = glob('src/skeletons/**/*.ts')
  for (const file of sources) {
    const content = fs.readFileSync(file, 'utf8')
    expect(content).not.toMatch(/['"`](摘要|证据|目录|结论|背景)['"`]/)
    expect(content).not.toMatch(/['"`](Summary|Evidence|TOC|Conclusion)['"`]/)
  }
})
```

## 四、L3 端到端流程(Playwright)

8 条用户路径,覆盖 PRD §10 全部验收项。

### E2E-1 首次打开

1. `playwright.goto(devUrl)`
2. 看到左右双栏
3. 左侧有示例 Markdown(随 UI 语言)
4. 右侧已自动渲染 HTML
5. 工具栏有:文件上传 / 4 预设按钮 / 3 个独立下拉 / 重新生成布局 / UI 语言切换 / 内容语言 / 下载 / 复制 / metadata 开关

### E2E-2 粘贴 Markdown

1. 清空左侧
2. 粘贴 `fixtures/inputs/readme.md` 内容
3. 等待 < 1 秒
4. 右侧出现非空 HTML
5. 右侧含 `<header>` 或 `<section>` 元素

### E2E-3 上传 .md 文件

1. 点工具栏"文件上传"
2. 选 `fixtures/inputs/readme.md`
3. 左侧填充
4. 右侧渲染

### E2E-4 切换预设 → 切换三轴 → 命名变"自定义"

1. 点 "Brief" 预设按钮
2. 三个独立下拉同步切到 (结果先行, 紧凑, dense-brief)
3. 点"逻辑"下拉,选"原文顺序"
4. 工具栏预设名变成"自定义"
5. 右侧重排

### E2E-5 文本编辑不调 LLM

1. 拦截网络请求 `/api/llm/*`(或所选 LLM endpoint)
2. 左侧改一个错别字(shape 不变)
3. 右侧 250ms 内更新
4. 网络拦截器无请求记录

### E2E-6 结构编辑触发 LLM + 形状判定 fallback

1. 拦截 LLM 请求,延迟 2 秒后返回
2. 左侧加一段新内容
3. 右侧 100ms 内显示原文顺序 fallback 渲染
4. 750ms debounce 后看到"AI 正在重排"loading
5. 2 秒后 LLM 返回,右侧更新为预设的 logic 形态

### E2E-7 重新生成布局按钮

1. 左侧 markdown 不变
2. 点工具栏"重新生成布局"按钮
3. 拦截器看到一次 LLM 请求
4. 右侧重渲染

### E2E-8 下载 HTML + 双击打开

1. 切 metadata 开关到"开"
2. 点下载,文件保存到 disk
3. 用 Node 读文件
4. 内容含 `<!doctype html>`
5. 内容含 `data-source-blocks="block-\d+"`
6. 切 metadata 到"关",再下载一次
7. 第二份文件不含 `data-source-blocks`

### E2E-9 Source map 双向点击

1. 点击右侧任一带 `data-render-node` 的元素
2. 左侧 CodeMirror 滚动到对应 startLine
3. 左侧高亮该行附近

### E2E-10 切换 UI 语言不重编译

1. 切换前记录右侧 HTML 内容
2. 工具栏切 UI 语言(中 ↔ 英)
3. UI chrome 文字改变
4. 右侧 HTML 内容**不变**(用 hash 对比)

## 五、运行方式

`package.json` 推荐脚本(实现者建立):

```json
{
  "scripts": {
    "test:unit": "vitest run src/",
    "test:shape": "vitest run src/tests/shape/",
    "test:invariant": "vitest run src/tests/invariant/",
    "test:visual": "playwright test --grep visual",
    "test:e2e": "playwright test --grep e2e",
    "test:all": "pnpm test:unit && pnpm test:visual && pnpm test:e2e"
  }
}
```

L1 视觉:`pnpm test:visual`
L2 结构:`pnpm test:unit` + `pnpm test:shape` + `pnpm test:invariant`
L3 流程:`pnpm test:e2e`

## 六、"验收通过"的定义

满足以下**所有**条件:

1. PRD §10 验收清单全部勾选。
2. 本文件 L2 §3.1 ~ §3.12 全部不变量通过。
3. 本文件 L3 §4 E2E-1 ~ E2E-10 全部通过。
4. L1 视觉对位人工审过(对 README Reader / Brief 两份 golden,系统输出"足够接近")。
5. fixtures/golden/ 至少 6 份覆盖 4 个预设(Faithful/Reader/Brief/Deck)各 ≥ 1 份。

注:MVP 第一里程碑可以只完成上面 1-4,L1 可以延后到 v0.2 接近发布时做。

## 七、实施里程碑建议

给 AI 实现者的分阶段路径:

| M | 目标 | L2 该过的断言 | L3 |
|---|---|---|---|
| M1 | 项目骨架 + parser + SourceBlock 切分 | §3.1 | — |
| M2 | Faithful 主链路 + 基础 renderer + iframe 预览 | §3.1-§3.3、§3.11 | E2E-1, E2E-2 |
| M3 | 三主题 + UI 工具栏 + UI 语言切换 | §3.10、§3.12 | E2E-1, E2E-10 |
| M4 | 骨架配置 + result-first / narrative 逻辑(确定性版,暂不接 LLM) | §3.4 | E2E-4 |
| M5 | 接入 LLM(buildRenderPlan) + 形状判定 + 缓存 | §3.5-§3.9 | E2E-5, E2E-6, E2E-7 |
| M6 | Source map 双向交互 + 下载 + 内容语言 | §3.11 | E2E-3, E2E-8, E2E-9 |
| M7 | 视觉对位审 + 额外 7 份 input/golden | L1 视觉审 | — |

## 八、Golden 维护

- Golden HTML 是**人审过的视觉目标**,不是机器自动产出。
- 当产品决策(配色、布局、结构)调整时,需要更新 golden。
- Golden 文件本身要能在浏览器双击打开看到完整效果——这是它的最低门槛。
- Golden 里的 `data-source-blocks` 引用的 block id 必须能在对应输入的 SourceBlock[] 里对上(参考 §3.1)。

## 九、开放问题(MVP 实现者可能遇到的歧义)

以下问题在当前规划文档里**未明确**,实施前需要澄清或在实施中以最简方式决定:

1. **LLM 集成模型**:用户的 LLM 请求怎么发?
   - (A) 用户在工具里填 API key,浏览器直接调 Anthropic / OpenAI(有 CORS 问题)
   - (B) 仿 html-anything,启动时探测本地 CLI(`claude` / `cursor-agent` / `gemini`),通过 stdin/stdout 通信
   - (C) 提供本地 server 中转
   - 推荐 (B),但需要写一份 ADR 锁定。

2. **数学公式 / Mermaid 图 / 图片**:MVP 是否支持?
   - 当前规划默认不支持(简洁优先),但 PRD §5.1 没明说。
   - 实施时若 Markdown 含 `$...$` 或 `mermaid` 代码块,默认按 code 块处理(原文展示)。
   - 图片在导出 HTML 时怎么内联?Base64 编码还是只支持远程 URL?需要决定。

3. **性能预算**:
   - 文本编辑反映到 HTML 的延迟目标?(建议 < 100ms)
   - 结构编辑 + LLM 返回的总延迟?(取决于所选 LLM,无强目标)
   - Compile 主链路对大文档的处理上限?(建议 10k 行内 < 500ms)

4. **浏览器支持**:仅现代浏览器(Chrome/Safari/Firefox 最新两版)。不需要 IE / 旧 Safari。

5. **测试环境的 LLM**:CI 上跑 L2/L3 需要 mock LLM。建议提供一个测试 stub(`testLlmStub`)在 `src/test/`,所有 LLM 测试都走它。

每条都**不阻塞 M1-M3**,但 M4 之后会陆续撞上。建议在实施前对每条写一份 ADR,本文件后续可链接到这些 ADR。
