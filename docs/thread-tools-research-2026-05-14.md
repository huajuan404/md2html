# Karpathy HTML 输出线程：工具线索复核与竞品调研

日期：2026-05-14  
输入文件：`karpathy-x-2053872850101285137-thread.md`  
目标：重新 review 全部 397 条清洗回复，提取所有明确或半明确提到的工具/平台/项目/工作流，并判断是否已有产品完整覆盖“可编辑 Markdown 源 → source-map-backed rich HTML 投影”的能力。

## 0. 重要限制

本地线程文件里大量 URL 已被清洗为 `[link]`，因此无法仅凭文件恢复每个短链。处理方式：

1. 对本地 397 条回复逐行扫描，提取显式工具名、项目名、平台名、skill 名、工作流名。
2. 对能从摘录直接识别的工具做公开网页/GitHub 调研。
3. 对上一轮短链已解析过的同线程工具继续纳入，例如 `html-anything`、`artifact.land`、`html-docs.com`、`canvakit.sh`。
4. 对只剩 `[link]` 且无唯一名称的线索标记为“未能唯一识别”。

## 1. 结论先行

### 1.1 是否已有产品完整实现我们的核心能力？

**没有发现完全等价产品。**

但发现了几个非常接近或强相关的方向：

1. **nexu-io/html-anything**：最接近。它已经是一个 agentic HTML editor，左侧输入，右侧 iframe preview，模板/skill picker，一键导出，支持 Markdown/CSV/JSON/SQL 等输入，并通过本地 agent 生成 HTML。它的口号甚至是“Markdown is the draft. HTML is what humans read.”  
   **差异**：它更偏“agent 生成/编辑 HTML artifact”，而不是“Markdown 是 canonical editable source，HTML 是可持续再生成的 source-map-backed projection”。公开代码/README 未见 block-level source map、`data-source-blocks`、右侧节点回定位 Markdown 源块这类机制。

2. **Nimbalyst**：非常接近“人和 agent 共享可视编辑 workspace”。它有 WYSIWYG Markdown、Mockup HTML editor、Mermaid/Excalidraw、agent red/green diffs。  
   **差异**：它是 agent-native workspace，不是 Markdown → information-designed HTML compiler。它支持编辑 Markdown、编辑 mockup HTML，但没有把二者通过 source map 作为同一内容的 source/projection 两层模型。

3. **HtmlDrag / Camille**：解决“AI 生成 HTML 后非开发者怎么改”的痛点。  
   **差异**：它们走的是直接视觉编辑 HTML，而我们的判断是应该让修改落回 Markdown 源，不让 HTML 成为主编辑对象。

4. **AgentDocs / HedgeDoc / StackEdit / Dillinger / MarkdownLab / WeMD**：解决 Markdown 编辑、发布、样式化或协作。  
   **差异**：大多是 faithful render / styled render，不做信息重组，不做 source-map-backed rich projection。

5. **visual-explainer / html-artifacts / clockless html-anything**：agent skill 层面很强，能生成漂亮 HTML artifact。  
   **差异**：它们通常是一次性 artifact 生成技能，而不是实时双栏 source-first 编辑产品。

### 1.2 我们应该充分吸收的优点

- 从 **nexu-io/html-anything** 吸收：agent CLI 复用、本地零 API key、sandbox iframe、模板/skill 可插拔、一键导出、多 surface 体系、diff-edit 节省 token。
- 从 **visual-explainer/html-artifacts** 吸收：何时不该输出 HTML 的识别规则、按场景加载 reference、单文件自包含 HTML、视觉解释/差异 review/plan review 模式。
- 从 **Nimbalyst** 吸收：AI 修改必须 human approval、red/green diff、Markdown/diagram/mockup 多编辑器、视觉 workspace 思路。
- 从 **HtmlDrag/Camille** 吸收：右侧 HTML 后期微调的 UX，但不要让它替代 Markdown 源。
- 从 **AgentDocs** 吸收：同一文档同时给人 clean web URL、给 agent raw `.md` endpoint。
- 从 **htmlbin/Handoff/ArtiShare/ZenBin/artifact.land/HTML Docs** 吸收：artifact 发布、持久 URL、评论/分享、版本/权限。
- 从 **HyperFrames/Remotion/Manim** 吸收：HTML/代码作为视频或动态解释的中间层，未来可成为 Deck/Video surface。
- 从 **Mermaid/draw.io/Excalidraw/Xmind** 吸收：复杂结构不一定全部靠 HTML/CSS，图和关系可以有专门 DSL/editor。

## 2. 线程内明确或可识别工具清单

### 2.1 直接 HTML artifact / HTML 生成技能

| 工具/项目 | 线程线索 | 当前能力 | 和我们关系 | 是否覆盖我们的核心 |
|---|---:|---|---|---|
| `nexu-io/html-anything` | #19/#163/#339 及同线程短链 | Agentic HTML editor；75 skill templates；9 surfaces；Markdown/CSV/JSON/SQL/plain text；sandbox preview；WeChat/X/Zhihu/HTML/PNG export；本地 agent CLI 复用 | 最接近竞品；必须重点研究 | **部分覆盖，但缺 source-first source map projection** |
| `clockless-org/html-anything` | #19/#163 旧短链解析 | Codex/Claude Code skill；任意文件/URL/数据源 → polished live HTML；17 style systems | 设计系统和 route 参考 | 否，skill 形态，不是双栏实时编辑器 |
| `dogum/html-artifacts` | #18/#222/#224 类 html-artifact skill 线索 | Claude skill；识别适合 HTML 的任务；输出 self-contained HTML artifacts；含 reports/decks/custom editors references | “何时使用 HTML”规则很有价值 | 否，一次性 artifact skill |
| `nicobailon/visual-explainer` | #215/#223/#353/#369 | Agent skill；生成 rich HTML pages/slide decks for diagrams, diff reviews, plans, data tables, recaps | 视觉解释、diff review、slide deck 很强 | 否，非 source-first editor |
| Claude Artifacts | #27/#229 等 | 对话中生成、查看、迭代、分享 HTML/React/SVG 等 artifacts | artifact 心智模型 | 否，平台 artifact，不是 Markdown source compiler |
| `htmlbin` | #225/#232 | Agent-first HTML hosting；API 发布 HTML；第一次需人类点击，之后 agent 拥有发布 | 发布层参考 | 否，hosting，不是编辑器/编译器 |

### 2.2 HTML 编辑/可视微调工具

| 工具/项目 | 线程线索 | 当前能力 | 和我们关系 | 是否覆盖我们的核心 |
|---|---:|---|---|---|
| Nimbalyst | #117 | Agent-native visual workspace；WYSIWYG Markdown；Mermaid/Excalidraw；HTML mockup editor；agent diffs | 最重要相邻产品之一 | 否，它是 workspace，不是 Markdown→rich HTML projection compiler |
| HtmlDrag | 外部补充竞品，解决同一痛点 | AI/URL/HTML/file → 可视编辑 HTML；像 Word 一样改 HTML | 直接解决 HTML 难编辑，但方向相反 | 否，HTML 成为编辑对象 |
| Camille | 外部补充竞品 | 浏览器 WYSIWYG HTML editor；编辑 AI 生成 HTML 文件 | 右侧微调 UX 参考 | 否，HTML 成为编辑对象 |
| HTML Docs | #27 同线程短链解析 | AI HTML 文档可编辑、评论、发布 | 协作评论/发布参考 | 否，不是 Markdown source-first |

### 2.3 Markdown / 文档发布 / 协作

| 工具/项目 | 线程线索 | 当前能力 | 和我们关系 | 是否覆盖核心 |
|---|---:|---|---|---|
| AgentDocs | 外部补充强相关 | Collaborative Markdown for agents and humans；clean webpage + raw `.md` endpoint；MCP connector；版本历史 | “人看网页，agent 读 md”非常接近理念 | 部分理念接近，但不做信息重组/source map |
| StackEdit | 传统竞品 | 双栏 Markdown editor、scroll sync、发布 | 编辑器 baseline | 否，faithful render |
| Dillinger | 传统竞品 | Markdown editor、实时 preview、HTML/PDF export | 编辑器/导出 baseline | 否，faithful/styled render |
| MarkdownLab | 传统竞品 | 左右预览、Mermaid/KaTeX、自包含 HTML/PDF | MVP baseline | 否，faithful render |
| WeMD / md-beautify | 传统/公众号竞品 | Markdown 公众号排版、本地优先、主题、自定义 CSS、一键复制 | 中文排版/export 参考 | 否，样式化为主 |
| MDX + npm/bun docs tools | #128 | 用 MDX 管理 docs | source format 扩展参考 | 否，开发者文档生态 |
| HedgeDoc | 外部补充 | 开源协作 Markdown editor | 协作参考 | 否 |

### 2.4 Artifact hosting / sharing / distribution

| 工具/项目 | 线程线索 | 当前能力 | 和我们关系 | 是否覆盖核心 |
|---|---:|---|---|---|
| artifact.land | #29 同线程短链解析 | HTML artifacts 分享/社交/发现 | 发布/社区层参考 | 否 |
| Handoff | 外部补充 | Share HTML, Markdown, images with URLs；Claude Code skill | artifact publishing 参考 | 否 |
| ArtiShare | 外部补充 | Controlled artifact sharing；static bundles；权限 | 权限/快照参考 | 否 |
| ZenBin | 外部补充 | 存 HTML/Markdown/binary，同页有 rendered/source/media URL | source + projection 发布理念很相关 | 只做发布，不做编辑/编译 |
| gist / surge | #256/#264 | 静态分享 HTML | 简单发布选项 | 否 |
| tokenrip | #104 | 让 Claude/harness 发布 artifact 并给链接，未进一步确认 | 发布层线索 | 未确认 |

### 2.5 工作流/自动化/agent 集成

| 工具/项目 | 线程线索 | 当前能力 | 吸收点 |
|---|---:|---|---|
| Claude Code hooks | #34 | 生命周期 hook，可在任务前后自动注入/检查/发布 | 自动转换、自动验证、自动发布可用 hook 接入 |
| n8n | #60 | workflow automation | 把转换器作为自动化节点/HTTP API |
| Rowboat | #198 | AI coworker + knowledge graph + local Markdown vault | 知识图谱/Markdown vault 集成 |
| agentmail | #149 | agent inbox/workflow 线索 | 邮件输入 adapter 参考 |
| FileMaker | #147 | 商业系统使用 HTML reviewable 输出 | 企业报告场景 |
| cmux | #291/#296 | browser tab 中查看 HTML | agent runtime preview 参考 |
| local server + live reload | #86 | HTML 输出到本地服务器实时 reload | 开发时 preview 体验参考 |
| Wiis MCP | #331/#333 | MCP 输出 HTML 示例，未唯一确认 | MCP input/output adapter 线索 |

### 2.6 图表、视觉解释、视频/多模态

| 工具/项目 | 线程线索 | 当前能力 | 吸收点 |
|---|---:|---|---|
| Mermaid | #85/#221/#277/#313/#335/#341/#343 | 文本 DSL 生成图 | Markdown 源里可保留 Mermaid，HTML 投影渲染图 |
| draw.io | #85 | 图表工具 | 复杂图编辑器参考 |
| Excalidraw | Nimbalyst 外部页面 | 可视化白板/图 | 未来 diagram block editor |
| Remotion | #78 | React/video generation | HTML/React to video surface 参考 |
| HyperFrames | #246/#397 | HTML + data attributes → deterministic video/MP4 | 未来 video surface 候选 |
| Manim | #146 | 数学/动画解释视频 | 教学/数学内容扩展 |
| SVG animations | #98/#101 | SVG 动画 | HTML projection 动效 primitive |
| Xmind | #328 | Markdown → mind map / 节省 token | information compression alternative |
| Afterwords | #44/#45 | 本地 voice-cloning TTS；Claude Code Stop hook 朗读 | HTML + audio 输出可访问性参考 |
| 45d.ai | #116/#120 | physics engine + voice，未深入确认 | 交互模拟/语音方向 |
| reMarkable Paper | #216 | 手写/截图输入给 Claude Code | 输入侧 reference |
| Perplexity | #175 | 报告消费默认 HTML 的体验线索 | 用户习惯验证 |

### 2.7 其他一次性/未能唯一识别线索

| 线索 | 行号 | 状态 |
|---|---:|---|
| Browser Cockpit | #99/#102 | 未能唯一识别具体产品；保留为工作流：Memory → MD → HTML → browser cockpit |
| CodeCart | #319 | 搜索未能唯一确认；保留概念：portable HTML memory cartridge |
| decksmith skill | #208 | 未能唯一确认；可用 Deckset/AgentPreso/Slidev 类工具作为同类参考 |
| karpathy-html skill | #254/#263 | 玩笑/预测，不是具体产品 |
| Biomedical-Agent-DB-Karpathy | #134/#140 | 与 HTML 输出产品无直接关系，是 biomedical KB repo |
| Lean4 output | #184 | 不是 HTML 工具，是形式化/essay 检查思路 |

## 3. 最接近竞品深挖

### 3.1 nexu-io/html-anything

公开 README 显示它已经具备：

- “Markdown is the draft. HTML is what humans read.” 的定位。
- 左侧 editor、中间 template/design-system picker、右侧 live iframe preview。
- 75 skill templates，覆盖 magazine、deck、poster、XHS/tweet、prototype、data report、Hyperframes 等 9 surfaces。
- 支持 Markdown/CSV/TSV/JSON/SQL/plain text 输入。
- sandboxed iframe preview。
- WeChat/X/Zhihu/HTML/PNG export。
- SSE 调本地 agent CLI；复用 Claude Code/Codex/Gemini/Cursor 等登录态。
- diff-edit mode：如果已有 baseHtml/baseContent，下一次内容改变时把原 HTML 和原内容一起给 agent，让 agent 做 minimal edit，节省 tokens 并保持设计系统。

代码快速检查：

- `src/components/editor-pane.tsx` 使用 textarea 作为输入。
- `src/components/preview-pane.tsx` 使用 iframe / deck viewer / code/log tabs。
- `src/lib/use-convert.ts` 是 agent generation + diff-edit 主链路。
- 搜索未发现 `sourceMap`、`SourceBlock`、`data-source-blocks`、`source block` 等 block-level source map 机制。

判断：

- 它已经非常接近“AI/agentic HTML editor”。
- 但它的核心似乎是 **agent 生成 HTML artifact，并在下一轮通过 diff-edit 修改 HTML**。
- 我们的核心应明确区分：**Markdown 是 canonical source，HTML projection 永远由 source + IR + renderer 再生成；AI 修改也优先落回 Markdown patch / IR patch。**

这使我们的差异点更清晰：不是“agentic HTML editor”，而是 **source-first information compiler**。

### 3.2 Nimbalyst

公开页面显示：

- 本地/开源 agent-native visual workspace。
- Markdown Editor：WYSIWYG + native markdown，agent 可以修改，用户审批 red/green diffs。
- Diagrams：Mermaid live render、Excalidraw。
- Mockups：AI 生成 HTML/CSS/JS mockup；可直接编辑 HTML、选 div 让 AI 修改、画注释让 AI 修改；`.mockup.html` 文件。

判断：

- 它在“AI + 人共同编辑可视文件”上非常强。
- 但它是多文件/多编辑器 workspace，不是同一个 Markdown 文档到 rich HTML projection 的 compiler。
- 我们应吸收它的 red/green diff 和 visual editor integration，但保持更窄、更深的主链路。

### 3.3 HtmlDrag / Camille

它们直接瞄准了我们指出的痛点：AI 生成 HTML 后普通人不好改。

- HtmlDrag：URL/HTML/file/paste code → visual editor，drag/drop、double-click edit，导出 HTML。
- Camille：浏览器内打开 AI 生成 HTML，视觉修改文本、图片、颜色、layout。

判断：

- 它们证明“HTML 难编辑”是市场真实痛点。
- 但它们的解法是把 HTML 变成 WYSIWYG 编辑对象。
- 我们的解法是避免 HTML 成为 canonical source，让 Markdown 保持主编辑层。

### 3.4 AgentDocs / ZenBin

AgentDocs 的理念很接近：一个 clean webpage 给人，一个 raw `.md` endpoint 给 agent。
ZenBin 也支持同一发布对象包含 html + markdown + media，并提供 rendered/source URL。

判断：

- 发布层非常值得借鉴。
- 但它们不解决“Markdown 源实时编辑 → 信息重组 HTML 投影 → source map 追溯”。

## 4. 重新校准我们的产品定位

原定位：Markdown → Human-Optimized HTML。  
经过竞品复核后，建议更锋利地改成：

> **Source-mapped Markdown projection editor**：人类持续编辑 Markdown；系统把它编译成可读、可分享、可下载的 rich HTML；每个主要视觉节点都能追溯到 Markdown 源块。

不要把自己描述成：

- “HTML Anything 竞品”
- “AI 生成 HTML 编辑器”
- “Markdown 美化器”
- “WYSIWYG HTML editor”

应该描述成：

- “source-first”
- “Markdown remains editable truth”
- “HTML is a generated projection”
- “source map makes projection controllable”
- “AI patches source, not projection”

## 5. 对 PRD/架构的追加建议

### 5.1 必须新增竞品防线

在 PRD 中明确：

- 即使未来引入 agent 生成 HTML，也不能让 agent 直接成为唯一渲染器。
- Agent 可以生成 RenderPlan、Theme、MarkdownPatch、IRPatch。
- HTML 应由 renderer 生成，至少主内容节点应保留 source map。

### 5.2 第一版不要和 nexu-io/html-anything 正面对抗所有 surface

它已经覆盖很多 export surface 和 skill templates。我们第一版应只做更窄的杀伤点：

- AI/研究 Markdown 长文。
- Reader / Brief / Deck 三个 projection。
- source map click-back。
- 单文件 HTML export。

### 5.3 可吸收的实现策略

- 采用 sandbox iframe preview。
- 支持 template/mode folder 插件化。
- 保留 diff-edit 思想，但 diff 的目标应是 Markdown/IR，不是 HTML。
- 后续可以加 agent CLI adapter，但 MVP 不必先做。
- 发布层可先抽象 `ExportTarget`，未来接 htmlbin/Handoff/AgentDocs/ZenBin。

## 6. 最终判断

市场已经开始快速往 “HTML as AI output / artifact” 方向移动，甚至已经有非常接近的产品。**但我没有发现已有工具把核心技术钉在 source map 上：Markdown canonical source + source-block mapping + HTML projection + click-back/patch-back。**

这正是我们的差异化护城河。

如果继续开发，建议把第一版验收标准升级为：

1. 右侧 HTML 不是简单 Markdown preview。
2. 右侧主要节点都有 `data-source-blocks`。
3. 点击右侧能定位左侧 Markdown。
4. 导出可选保留/剥离 source metadata。
5. 未来 AI 修改必须设计为 MarkdownPatch / IRPatch，而不是 HTML patch。

## 7. 参考来源

- Thread source: `karpathy-x-2053872850101285137-thread.md`
- nexu-io/html-anything: https://github.com/nexu-io/html-anything
- clockless-org/html-anything: https://github.com/clockless-org/html-anything
- dogum/html-artifacts: https://github.com/dogum/html-artifacts
- visual-explainer: https://github.com/nicobailon/visual-explainer
- htmlbin: https://htmlbin.dev/
- Nimbalyst: https://nimbalyst.com/features
- Nimbalyst mockups: https://docs.nimbalyst.com/visual-editors-powered-by-ai/mockups
- HyperFrames docs: https://hyperframes.app/docs/1-startup/1-introduction
- Rowboat docs: https://docs.rowboatlabs.com/docs/getting-started/introduction
- Afterwords: https://adrianwedd.github.io/afterwords/
- AgentDocs: https://www.agentdoc.com/
- HtmlDrag: https://htmldrag.com/
- Camille: https://camillehtml.com/
- ArtiShare: https://artishare.app/
- Handoff: https://handoff.host/
- ZenBin: https://zenbin.org/
- Claude Code hooks: https://docs.claude.com/en/docs/claude-code/hooks
