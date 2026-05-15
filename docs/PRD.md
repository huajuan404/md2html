# Source-First Markdown to Human-Optimized HTML PRD

日期：2026-05-15  
状态：MVP 需求 v0.2（grill 后）  
阶段：规划完成前，不进入代码实现  
参考调研：

- `docs/research-2026-05-14.md`
- `docs/thread-tools-research-2026-05-14.md`

参考决策（grill 后产出）：

- `CONTEXT.md`（领域术语词典）
- `docs/adr/0001-llm-in-build-render-plan.md`
- `docs/adr/0002-shape-change-driven-recompile.md`
- `docs/adr/0003-source-map-granularity.md`
- `docs/adr/0004-ui-language-vs-content-language.md`
- `docs/adr/0005-skeleton-templates.md`

## 1. 产品一句话

一个 **source-mapped Markdown projection editor**：用户继续用 Markdown 做增量编辑，系统实时把 Markdown 投影成更适合人类阅读、理解、传播和下载的 HTML 页面，并且每个主要 HTML 视觉节点都能追溯到 Markdown 源块。

## 2. 背景与问题

Markdown 流行的根本原因之一是它适合人类维护：纯文本、可复制、可 diff、可版本化、容易做小幅增删改。

HTML 的优势刚好相反：它适合消费，而不适合普通用户编辑。HTML 可以承载布局、卡片、图表、交互、信息密度和视觉层级，但手动修改 HTML 对非开发者非常痛苦；让 AI 直接改 HTML 又容易出现语义定位不准、局部修改困难、视觉结果失控的问题。

因此，本产品要解决的核心矛盾是：

> 人类天然适合编辑 Markdown，但人类更适合消费 HTML。

本产品不是普通 Markdown 预览器，也不是一次性 AI HTML 生成器。它要把 Markdown 作为可编辑源，把 HTML 作为可再生成的消费投影，并通过 source map 让两者保持可追溯连接。

### 2.1 竞品校准后的边界

完整线程复核后，`nexu-io/html-anything` 是最接近的相邻产品。它已经支持左侧输入、模板/skill 选择、右侧 sandbox iframe preview、本地 agent CLI、SSE 流式生成、一键导出以及多 surface。它的核心模式是：用户输入内容后按快捷键，agent 生成 HTML artifact，右侧实时显示生成过程。

本产品不应和它正面竞争"更多模板 / 更多 surface / 更多导出平台"。我们的核心边界是：

- **不是 agentic HTML artifact generator**：AI 不直接产 HTML；AI 只参与产 RenderPlan（中间结构）这一步，HTML 由确定性 renderer 产出。
- **不是 WYSIWYG HTML editor**：第一版不把右侧 HTML 当作主编辑对象。
- **不是普通 Markdown previewer**：右侧不是忠实线性渲染，而是由 RenderPlan 组织的信息投影。
- **是 source-mapped Markdown projection editor**：Markdown 是源，HTML 是投影，source map 是交互和未来 AI patch 的桥。

因此，判断第一版是否成功的关键不是“能否生成很多漂亮模板”，而是“用户修改 Markdown 时，右侧 rich HTML projection 是否稳定、实时、可追溯地更新”。

## 3. 目标用户

### 3.1 第一优先用户

- 使用 ChatGPT / Claude / Codex / Gemini 生成长 Markdown 输出的人。
- 需要把研究笔记、推文整理、访谈记录、报告、教程、AI 回答转成更好阅读页面的人。
- 想保留 Markdown 可编辑性，但又希望输出结果比普通 Markdown 渲染更像“信息产品”的人。

### 3.2 暂不优先用户

- 只需要普通 Markdown 编辑器的用户。
- 需要多人实时协作文档的人。
- 需要完整 CMS、博客系统、团队发布系统的人。
- 需要手写 HTML/CSS 的前端开发者。

## 4. 核心产品原则

1. **Markdown 是 canonical editable source**  
   用户真正维护的是 Markdown。Markdown 是可信源、可编辑源、可版本化源。

2. **HTML 是 regenerated human-consumption projection**  
   HTML 是给人读、展示、下载、分享的投影。HTML 可以复杂，但不应该成为主要编辑对象。

3. **Source map / block map 是核心技术底座**  
   主要 HTML 视觉节点必须尽可能声明它来自哪些 Markdown source blocks。

4. **实时编辑是核心体验，但分两档**  
   - **文本编辑**（错别字、改词、改标点等不改变文档形状的编辑）：确定性即时渲染，复用既有 RenderPlan，**不**调用 AI。
   - **结构编辑**（加段、加标题、删段、改 heading 级等改变文档形状的编辑）：先以"原文顺序"逻辑即时渲染 fallback，750ms debounce 后异步触发 AI 重排 RenderPlan。
   - "形状"定义见 `CONTEXT.md` / `docs/adr/0002-shape-change-driven-recompile.md`。

5. **信息重组优先于皮肤美化**  
   主题不是只改颜色和字体。渲染模式应该改变信息结构、阅读路径、组件形态和视觉层级。

6. **本地优先，导出优先**  
   第一版默认在浏览器本地运行，支持单文件 HTML 下载。发布、评论、云端协作后置。

7. **Agent 边界：可以产中间结构，不能直接产 HTML**  
   - AI 允许参与 compiler 主链路的 **buildRenderPlan** 这一步：把 Markdown 源块按选定逻辑重排进骨架的"区"里、生成区的标题文字。
   - AI 输出必须是结构化 RenderPlan，不允许引入原文外的新内容。违反 → 非法响应 → 回落"原文顺序"逻辑。
   - AI 不能产 HTML 字符串作为 projection；HTML 始终由确定性 renderer 产出。
   - 未来 AI 辅助编辑必须优先落回 MarkdownPatch（改源文档），不允许 HTML diff-edit 成为主路径。
   - 详见 `docs/adr/0001-llm-in-build-render-plan.md`。

## 5. MVP 范围

### 5.1 输入

MVP 必须支持：

- 粘贴 Markdown 原文。
- 上传 `.md`、`.markdown`、`.txt` 文件。
- 示例内容一键载入，用于空状态体验和测试。示例内容随 UI 语言切换（中文 UI → 中文示例；英文 UI → 英文示例），素材应能展示三轴差异（足够长、有 heading、有列表、有引用，便于看出逻辑切换的效果）。

MVP 暂不支持：

- 多文件工作区。
- PDF/DOCX/网页 URL 输入。
- 图片资源工作区管理。
- 云端账号或同步。
- 本地 agent CLI 调用。
- LLM 直接生成完整 HTML。

### 5.2 编辑区

左侧为 Markdown 源编辑区：

- 支持直接输入和粘贴。
- 支持上传文件后自动填充。
- 支持基本 Markdown 语法高亮。
- 支持本地自动保存最近一次内容：localStorage 单槽位，下次打开自动恢复。MVP 不做多版本历史。
- 支持显示行号。
- 支持从右侧区块定位回左侧源块的基础能力；第一版可先做内部能力和最小 UI。

### 5.3 预览区

右侧为 HTML 投影区：

- 使用 sandboxed iframe 渲染，仅开放"允许脚本执行"一项权限；其余权限（同源、表单、弹窗、跳页、下载等）全部关闭。详见 `docs/ARCHITECTURE.md` §2.4。
- Markdown 修改后按形状判定自动刷新：文本编辑即时；结构编辑先以原文顺序逻辑即时刷新，AI 重排异步覆盖。
- 可独立切换三轴（逻辑 / 密度 / 主题），也可通过命名预设一键切换。
- 每个 RenderNode 渲染出的最外层 HTML 元素挂 `data-render-node` 和 `data-source-blocks`；其余子元素不挂（详见 `docs/adr/0003-source-map-granularity.md`）。
- 用户悬停或点击右侧主要区块时，系统通过 DOM 向上找最近的 `[data-render-node]` 祖先，定位对应源块。

### 5.4 顶部工具栏

MVP 顶部工具栏包含：

- 文件上传。
- 命名预设选择（Faithful / Reader / Brief / Deck，本质是三轴的别名）。
- 逻辑选择（原文顺序 / 结果先行 / 时序展开）。
- 密度选择（宽松 / 紧凑 / 一屏一页）。
- 主题选择。
- **重新生成布局按钮**（强制触发一次 AI 重排，无视形状判定，详见 `docs/adr/0002-shape-change-driven-recompile.md`）。
- UI 语言切换（中 / 英）。
- 内容语言下拉（自动检测 / zh / en，详见 `docs/adr/0004-ui-language-vs-content-language.md`）。
- 下载 HTML。
- 复制 HTML。
- 是否保留 source map metadata 的导出开关（默认关闭）。

### 5.5 输出的三个独立轴 + 命名预设

MVP 把 HTML 输出能力拆成三个**正交**的轴，每个轴有自己的取值。术语定义见 `CONTEXT.md`。

#### 5.5.1 逻辑（Logic）：控制内容骨架

回答"先说什么、再说什么、什么聚到一起"。MVP 三个取值：

- **原文顺序**：不重排，按 Markdown 原结构铺。Faithful 预设使用此逻辑，也是所有 AI 重排失败时的兜底。
- **结果先行**：AI 把结论或主张抽到顶部，证据/方法/背景放后段。
- **时序展开**：AI 还原"背景 → 问题 → 调查 → 方案 → 结果"的论证流。

#### 5.5.2 密度（Density）：控制空间分布

回答"一屏装多少、分几栏、是滚动还是分页"。MVP 三个取值：

- **宽松**：长滚动页，留白宽，单栏。
- **紧凑**：长滚动页，多栏分区。
- **一屏一页**：分页，一屏一个核心观点（替代旧 Deck 模式的能力）。

#### 5.5.3 主题（Theme）：控制视觉风格

回答"看起来是什么风格"。详见 §5.6。

#### 5.5.4 命名预设：工具栏一键切换

每个预设是 (逻辑, 密度, 主题) 三元组的别名：

| 预设 | 逻辑 | 密度 | 主题 | 适合场景 |
|---|---|---|---|---|
| Faithful | 原文顺序 | 宽松 | Editorial Light | 验证解析、对照、兜底 |
| Reader | 时序展开 | 宽松 | Editorial Light | 文章、研究笔记、访谈稿 |
| Brief | 结果先行 | 紧凑 | Dense Brief | AI 长回答、决策备忘 |
| Deck | 结果先行 | 一屏一页 | Dark Studio | 简报、传播卡片、教学序列 |

用户拨任一独立下拉，预设名切换到"自定义"。

#### 5.5.5 骨架模板

每个 (逻辑, 密度) 组合对应一份骨架模板（共 9 份），声明页面应有哪些"区"、哪些必有哪些可选、可选区在何种条件下出现。骨架由产品团队预写，**用户不参与**。AI 拿到骨架后只做三件事：

1. 把每个 Markdown 源块标注角色（结论 / 证据 / 背景 / 问题 / 方法 / 结果 / 其他）。
2. 按骨架声明把源块塞进对应的区。
3. 给每个区起标题（用内容语言）。

AI 不能改变骨架的区数量、顺序，也不能创造新的区。详见 `docs/adr/0005-skeleton-templates.md`。

### 5.6 主题

MVP 主题不追求数量，优先证明扩展机制。建议内置三套：

1. **Editorial Light**：适合长文与研究笔记。
2. **Dense Brief**：适合信息压缩与决策页。
3. **Dark Studio**：适合演示、AI artifact、技术内容。

每个主题通过 token 控制：

- 字体族。
- 背景色。
- 文本色。
- 强调色。
- 卡片边框。
- 圆角。
- 阴影。

> 主题不控制空间分布——"分几栏、留白多大、是否分页"由密度轴负责。三轴正交。

### 5.7 Source Map 能力

MVP 内部必须生成 source map：

- Markdown 被切分为 `SourceBlock[]`，每个 block 有 id、类型、起止行、原文。MVP id 采用 `block-${index}`（详见 `docs/adr/0002-shape-change-driven-recompile.md`，跨编辑稳定 id 留给 v0.3+）。
- 渲染计划生成 `RenderNode[]`，每个 node 声明 `sourceBlockIds`。
- **粒度规则**：每个 RenderNode 渲染出的最外层 HTML 元素挂 `data-render-node` + `data-source-blocks`，其余子元素不挂。详见 `docs/adr/0003-source-map-granularity.md`。
- **原子节点保证**：quote / table / code 三种节点对应单个 SourceBlock，`sourceBlockIds` 长度恒为 1，任何重排逻辑下都不允许打散。

MVP UI 至少支持一种可见能力：

- 点击右侧主要区块，左侧高亮对应 Markdown block。

如果实现成本过高，可降级为：

- 悬停右侧主要区块时，在右侧显示"来自第 X-Y 行"。

但数据结构必须完整保留。

### 5.8 下载与复制

MVP 必须支持：

- 下载单文件 `.html`。
- HTML 内联 CSS。
- HTML 内联必要 JS（只包含右侧消费所需，不打包编辑器代码）。
- 导出时可选择是否保留 `data-source-*` metadata。**默认关闭**（最终读者不需要，保留只会让文件变大、HTML 看起来"脏"；用户下载前可手动打开开关）。
- 导出 HTML 的 `<html lang="...">` 来自**内容语言**（自动检测或用户覆盖），不来自 UI 语言。详见 `docs/adr/0004-ui-language-vs-content-language.md`。
- 导出文件不依赖本地开发服务器、不依赖外部 CDN。

MVP 可暂不支持：

- 导出 PDF。
- 发布到云端。
- 导出图片。

## 6. 非目标

第一版明确不做：

- 多人协同编辑。
- 云端发布和账号系统。
- 所见即所得富文本编辑器。
- 直接编辑右侧 HTML。
- 复杂图表库集成。
- 让 LLM 每次键入都重新生成整页。
- 依赖 agent 直接生成右侧 HTML。
- 把 HTML diff-edit 作为主编辑模型。
- 完整插件市场。
- 把所有输入格式都纳入 MVP。

## 7. 用户流程

### 7.1 首次打开

1. 用户访问本地启动后的页面。
2. 页面显示左右双栏。
3. 左侧有示例 Markdown。
4. 右侧自动显示 HTML 投影。
5. 顶部工具栏显示当前模式、主题、密度、下载按钮。

### 7.2 粘贴 Markdown

1. 用户在左侧粘贴 AI 输出或研究笔记。
2. 系统解析 Markdown，生成 source blocks。
3. 系统检测内容语言。
4. 系统根据当前 (逻辑, 密度) 加载骨架模板。
5. 若逻辑 = 原文顺序 → 确定性产 RenderPlan；否则 → AI 按骨架重排 RenderPlan。
6. 右侧渲染 HTML。
7. 用户切换三轴或预设，系统重新走第 4-6 步（切逻辑触发 AI；切密度/主题不触发 AI）。

### 7.3 修改 Markdown

1. 用户修改左侧某一段。
2. 系统重新解析 → 比对新旧 source blocks 的"形状"。
3. **文本编辑**（形状不变）：复用既有 RenderPlan，仅替换 block 文本，立即重渲染。不调 AI。
4. **结构编辑**（形状变了）：立即用原文顺序逻辑渲染兜底；750ms debounce 后 AI 按当前逻辑重排，完成后覆盖。
5. 用户也可主动点"重新生成布局"按钮，无视形状判定强制触发 AI 重排。
6. 用户点击右侧相关区块，左侧对应源块高亮。

### 7.4 上传文件

1. 用户点击上传。
2. 选择 `.md/.markdown/.txt`。
3. 系统读取文件内容。
4. 左侧显示文件内容。
5. 右侧生成 HTML 投影。

### 7.5 下载 HTML

1. 用户点击下载。
2. 系统基于当前 Markdown、模式、主题、密度生成完整 HTML。
3. 用户选择是否保留 source map metadata。
4. 浏览器下载 `.html` 文件。
5. 下载文件可直接双击打开。

## 8. 成功标准

### 8.1 产品成功标准

MVP 完成后，应满足：

- 用户可以在 30 秒内理解产品核心：左边改 Markdown，右边变成更好的 HTML。
- 用户可以上传或粘贴 Markdown。
- 用户可以连续修改 Markdown，右侧不需要点击“生成”或等待 agent，就能快速更新。
- 用户可以切换至少 4 种渲染模式。
- 用户可以下载单文件 HTML。
- 用户可以感知“右侧不是普通 Markdown 预览”，而是信息被重新组织。
- 用户可以看到 source map 带来的基础追溯能力。

### 8.2 技术成功标准

- Markdown 解析、source block 生成、render plan 生成、HTML 输出是分层模块。
- 新增一个 render mode 不需要改编辑器。
- 新增一个 theme 不需要改 parser。
- 主要 HTML 节点都携带 source block 映射。
- 导出的 HTML 在无本地服务情况下可打开。
- 核心预览链路不依赖 `/api/convert`、agent CLI 或网络请求。
- 测试覆盖 source block、render plan、HTML metadata、导出开关。

## 9. 风险

### 9.1 信息重组过度导致失真

风险：HTML 页面看起来更可信，但可能压缩或重组出原文没有的意思。

缓解：

- Faithful 模式保留原始对照。
- Brief/Reader/Deck 只使用 source blocks 里的内容。
- 重要 render nodes 保留来源行号。
- 后续 AI 模式必须区分“抽取”“改写”“推断”。

### 9.2 实时 AI 成本不可控

风险：如果每次输入都调用 LLM，会慢且贵；LLM 输出还有天然抖动，可能让用户改个错别字整页布局都变。

缓解：

- **形状变化驱动重编译**：文本编辑（不改变文档形状）不触发 AI；只有结构编辑（加段、加标题、删段等）才触发。详见 `docs/adr/0002-shape-change-driven-recompile.md`。
- AI 调用有 750ms debounce + 缓存键命中跳过。
- 缓存键包含 (shape, logicId, densityId, blockTextDigests, contentLang)；撤销结构变化命中缓存，不再调用 AI。
- AI 输出违反 schema → 回落原文顺序逻辑。
- source map 允许局部刷新（未来增量更新支持）。

### 9.3 变成普通主题编辑器

风险：产品只做成 Markdown 换皮肤，没有信息结构创新。

缓解：

- render mode 必须改变页面结构，不只是 CSS。
- PRD 将 Faithful 作为对照，而不是主模式。
- Brief/Reader/Deck 必须有不同 render node 类型。

### 9.4 Source map 复杂度膨胀

风险：追求完美映射导致第一版拖慢。

缓解：

- 第一版 block-level source map，不做 token-level/source-column mapping。
- 优先支持标题、段落、列表、表格、引用、代码块。
- 一个 render node 可以对应多个 source blocks。

## 10. 验收清单

### 10.1 基础功能

- [ ] 页面有左右双栏：左 Markdown，右 HTML。
- [ ] 可以粘贴 Markdown，右侧立即（文本编辑路径）或 debounce 内（结构编辑路径）更新。
- [ ] 可以上传 `.md / .markdown / .txt`。
- [ ] 支持下载单文件 HTML，可脱离开发服务器打开。

### 10.2 三轴

- [ ] 工具栏暴露三个独立下拉：逻辑 / 密度 / 主题。
- [ ] 逻辑下拉提供：原文顺序、结果先行、时序展开。
- [ ] 密度下拉提供：宽松、紧凑、一屏一页。
- [ ] 主题下拉至少 3 种。
- [ ] 任一独立下拉切换时，输出 HTML 结构正确响应（如切到一屏一页 → 分页效果生效）。

### 10.3 命名预设

- [ ] 工具栏提供 Faithful / Reader / Brief / Deck 四个一键预设。
- [ ] 点预设后，三个独立下拉同步切换到对应取值。
- [ ] 拨任一独立下拉后，预设名切换到"自定义"。

### 10.4 形状驱动的重编译

- [ ] 文本编辑（错别字、改词等）：右侧 HTML 立即更新，**不**调用 AI。
- [ ] 结构编辑（加段、改 heading 级等）：右侧先以原文顺序兜底，750ms 后 AI 重排覆盖。
- [ ] 工具栏有"重新生成布局"按钮，点击强制触发一次 AI 重排。

### 10.5 Source Map

- [ ] 每个 RenderNode 的最外层 HTML 元素挂 `data-render-node` 和 `data-source-blocks`。
- [ ] 子元素不挂这两个属性。
- [ ] 点击或悬停右侧主要节点能显示或定位来源。
- [ ] 导出 HTML 时可选保留 / 剥离 `data-source-*` metadata；**默认剥离**。

### 10.6 多语言

- [ ] UI 语言可手动切换中 / 英；持久化到 localStorage。
- [ ] 内容语言可手动覆盖（自动检测 / zh / en）。
- [ ] 切换 UI 语言**不**触发 AI 重算。
- [ ] 切换内容语言**触发** AI 重算（缓存键变化）。
- [ ] 导出 HTML 的 `<html lang>` 来自内容语言。

### 10.7 AI 边界

- [ ] AI 只在 buildRenderPlan 步骤参与；HTML 由确定性 renderer 产出。
- [ ] AI 失败 / 超时 / 配额耗尽 → 自动回落原文顺序逻辑。
- [ ] AI 输出引入 SourceBlock 之外的内容 → 视为非法响应，回落原文顺序。

### 10.8 测试覆盖

- [ ] Markdown → SourceBlock[] 测试（解析 + 位置 + 形状签名）。
- [ ] 9 份骨架模板 × 各路径的 RenderPlan 测试。
- [ ] RenderNode.length === HTML 内 `[data-render-node]` 数量的不变量测试。
- [ ] 原子节点 sourceBlockIds 长度恒为 1 的不变量测试。
- [ ] 导出 metadata 开关测试。
- [ ] UI 语言切换不触发重编译的回归测试。
- [ ] 内容语言切换触发 AI 重算的回归测试。
