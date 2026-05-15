# Handoff — md2html 项目进入实施阶段

- 日期:2026-05-15
- 上一会话焦点:用 grill-with-docs 把 PRD/ARCHITECTURE 打磨成实施级规划 + 写 ACCEPTANCE.md
- 当前会话焦点:**开始实施**(把规划落地成可跑代码)

## 项目所在地

`/Users/doing/Desktop/code/github/md2html/`

不是 git 仓库(`git rev-parse` 不工作,但目录有 `docs/` 和 fixture 等内容)。

## 上下文(只读不重复)

按重要性顺序读完这些再开干:

1. `CONTEXT.md` —— 12 条领域术语词典(逻辑/密度/主题/形状/SourceBlock/RenderPlan/骨架等)
2. `docs/PRD.md` v0.2 —— 产品需求 + 8 小节验收清单
3. `docs/ARCHITECTURE.md` v0.2 —— 主链路 / 模块边界 / 数据结构 / 测试策略
4. `docs/adr/0001-llm-in-build-render-plan.md`
5. `docs/adr/0002-shape-change-driven-recompile.md`
6. `docs/adr/0003-source-map-granularity.md`
7. `docs/adr/0004-ui-language-vs-content-language.md`
8. `docs/adr/0005-skeleton-templates.md`
9. **`docs/ACCEPTANCE.md`** —— 三层验收方法 + 12 条 L2 不变量 + 10 条 E2E + 7 个里程碑

## 已经在仓库里的实物

```
md2html/
├── CONTEXT.md                              # 术语词典
├── CLAUDE.md / AGENTS.md                   # agent 引导
├── karpathy-x-...thread.md                 # 灵感源原文(可摘做 fixture)
├── docs/
│   ├── PRD.md / ARCHITECTURE.md
│   ├── ACCEPTANCE.md                       # 验收方法
│   ├── adr/0001-...md ~ 0005-...md         # 5 个决策记录
│   ├── research-2026-05-14.md              # 立项调研
│   ├── thread-tools-research-2026-05-14.md # 竞品调研
│   └── agents/                             # issue-tracker/triage-labels/domain
└── fixtures/
    ├── inputs/readme.md                    # 48 source block 的测试输入
    └── golden/
        ├── readme-reader.html              # Reader 形态 golden(带主题切换)
        └── readme-brief.html               # Brief 形态 golden(带主题切换)
```

## 实施前**必须先解决**的两个阻塞缺口

详细分析见**上一会话最后一条 review 报告**(已经在用户 ACCEPTANCE.md §9 留了开放问题,但未落 ADR)。

### 阻塞 #1:无项目骨架

仓库没有 `package.json` / `tsconfig.json` / `vite.config.ts` / 任何 src 文件。`pnpm install` 直接报错。

**建议动作**:建最小骨架,~5 个文件。技术栈见 `docs/ARCHITECTURE.md` §2:

- Vite + React + TypeScript
- CodeMirror 6(左侧编辑器)
- unified / remark(Markdown 解析 + 位置)
- Vitest(单测)
- Playwright(E2E + 视觉)

### 阻塞 #2:LLM 集成模型未定

ADR 0001 锁了"LLM 在 buildRenderPlan 参与",**但怎么调没说**:浏览器输入 API key?探测本地 CLI?走中转 server?

PRD §5.4 承诺"0 个 API key 必须支持"。这把选择推向**仿 html-anything 的本地 CLI 探测路径**——但还没正式落 ADR。

**建议动作**:写 ADR 0006,锁路径 B(CLI 探测,扫 `PATH` 找 `claude`/`cursor-agent`/`codex`/`gemini` 等,JSON-line 协议交互)。

但 **#2 可推迟到 M5 前**——M1-M4 全部跑 `logic: none` 走 faithful 路径,不需要 LLM。所以如果时间紧,只解决 #1 就够开干。

## 实施路径(来自 `docs/ACCEPTANCE.md` §7)

| M | 目标 | 应过的 L2 断言 | 应过的 E2E |
|---|---|---|---|
| M1 | 骨架 + parser + SourceBlock 切分 | §3.1 | — |
| M2 | Faithful 主链路 + renderer + iframe 预览 | §3.1-3.3、§3.11 | E2E-1, E2E-2 |
| M3 | 三主题 + 工具栏 + UI 语言切换 | §3.10、§3.12 | E2E-1, E2E-10 |
| M4 | 骨架配置 + result-first/narrative(确定性版,**不接 LLM**) | §3.4 | E2E-4 |
| M5 | 接 LLM + 形状判定 + 缓存 | §3.5-3.9 | E2E-5, E2E-6, E2E-7 |
| M6 | Source map 双向交互 + 下载 + 内容语言 | §3.11 | E2E-3, E2E-8, E2E-9 |
| M7 | 视觉对位 + 补 7 份 input/golden | L1 视觉审 | — |

M1-M4 完全不依赖 LLM。M5 前再解决阻塞 #2 也来得及。

## 实施时的关键约束(从 grill 过程中沉淀)

这些约束已经写进 PRD / ARCHITECTURE / ADR,但**最容易在写代码时忘**:

1. **HTML 由确定性 renderer 产出**——AI 不允许直接写 HTML 字符串。LLM 只产 RenderPlan(结构化中间数据)。
2. **粒度规则**:`data-render-node` + `data-source-blocks` **只挂 RenderNode 最外层元素**,内部 `<h3>`/`<p>`/`<li>` 一律不挂。
3. **原子节点不打散**:quote/table/code 的 `sourceBlockIds.length === 1`,任何重排逻辑下都成立。
4. **形状判定驱动 LLM 调用**:改错别字(shape 不变)不调 LLM,只复用上次 RenderPlan;加段(shape 变)才调 LLM(750ms debounce)。
5. **UI 语言 ≠ 内容语言**:切 UI 不重编译;切内容才重编译;导出 `<html lang>` 来自内容语言。
6. **骨架配置预写**:9 份 (logic, density) 对应的 SkeletonConfig 由产品团队/这个会话写,AI 只做"分类填空"。
7. **AI 找不到内容时跳过可选区**,不硬塞。
8. **测试不变量**:`RenderPlan.nodes.length === HTML 内 [data-render-node] 元素数`。
9. **iframe sandbox 只开 allow-scripts**,其余权限关掉。
10. **导出 HTML 默认剥离 source metadata**,用户可手动打开。

## 与上一会话对齐的"用户偏好"

用户已经在 memory 里留了一条 feedback(`feedback_plain_chinese_in_design.md`):**讨论决策时不要混英文代码术语**。

具体执行:
- 用"块"/"区"代替 "RenderNode"
- 用"分类填空"代替 "schema 封闭"
- 用"形状"代替 "shape signature"
- 代码实施阶段写 .ts 文件时可恢复英文术语,**讨论决策时不能**

下一会话如果继续讨论产品/决策,继续守这条;真正开始 `pnpm install` 写代码时可以用英文术语。

## 待写但**不**阻塞 M1-M2 的东西

清单(按优先级,实施到对应 M 再写):

- M4 前:9 份 SkeletonConfig TypeScript 对象(`src/skeletons/*.ts`)
- M3 前:i18n 字典内容(`src/i18n/{ui,output,prompts,samples}/{zh,en}.ts`)
- M5 前:LLM 集成 ADR + LLMClient 接口契约
- M7 前:7 份额外 input + 7 份 golden HTML
- 顶层 `README.md`(目前只有 fixture readme.md;可以参考它写真的项目 README)

## 推荐的开局动作(给下一会话的具体起手式)

**最小开干路径**:

1. 跟用户确认是否要建骨架(用户上一会话最后一条还在问"要不要现在就把项目骨架建起来"——**等用户答复**,不要擅自开始)
2. 如果用户说"开始",建 5 个文件:
   - `package.json`(声明 vite/react/ts/codemirror/unified/vitest/playwright 依赖)
   - `tsconfig.json`
   - `vite.config.ts`
   - `index.html`
   - `src/main.tsx`(占位入口)
3. `pnpm install && pnpm dev` 能开浏览器看到空白页面就算 M0 完成
4. 进入 M1:实现 `compiler/extractSourceBlocks.ts`,验证能从 `fixtures/inputs/readme.md` 切出 48 个 block(参考 `docs/ACCEPTANCE.md` §3.1 详细类型/depth 期望)

## 建议下一会话使用的 skills

- **`tdd`** —— 实施严格按 TDD 跑:先写 ACCEPTANCE.md §3.1 那条形状断言,再写 parser 实现,跑通后再写下一条。
- **`diagnose`** —— M2 / M5 撞 bug 时用,系统化定位。
- **`verification-before-completion`** —— 每个 milestone 完成时强制核验:跑测试、确认所有 L2 断言通过,再宣布 milestone done。
- **`find-docs`** —— unified/remark / CodeMirror 6 / Vite 这些库的 API 用法时,通过 ctx7 拿最新文档。
- **`subagent-driven-development`** —— M3-M6 可以拆成并行子任务(三个主题/三个骨架/三个 logic 实现互相独立),用 subagent 并行推。

**不要用**:`brainstorming`(规划已经定完,不需要再 brainstorm)、`grill-me`(grill 已结束,不要再 grill 已经写好的决策)。

## 对话风格提示

- 用户中文母语,讨论决策时**严格用大白话中文**(见 memory `feedback_plain_chinese_in_design.md`)
- 回复要短,重点突出,砍掉不改变决策的信息(见 `~/.claude/CLAUDE.md`)
- 每次回复结尾列本次编辑的文件(用户的全局规则)
- 第一性原理:从需求和问题本质出发,不照搬模板;遇到问题追根因不打补丁
- Git 操作纪律:只精准操作 session 内实际改动过的文件,**禁止 `git add -A` / `git add .`**

## 当前对话状态摘要

上一会话最后一条 assistant 消息是 review 报告,问了用户三个问题:

1. 要不要现在建项目骨架?
2. ADR 0006 现在写还是 M5 前?
3. 三个"重要缺口"先补哪个?

用户**没回这三个问题**,直接发了 `/handoff 实施`。所以下一会话应该:

- 不要假设用户已经回答,**继续等用户答复或重新询问**这三个问题
- 不要擅自开始建骨架(用户没确认)
- 如果用户在新会话里直接说"开始实施",再次确认走 M1 + 建骨架的路径
