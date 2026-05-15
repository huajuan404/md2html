# ADR 0001: 允许 LLM 参与 compiler 的 `buildRenderPlan` 步骤

- 日期：2026-05-15
- 状态：Accepted
- 相关：`docs/PRD.md` §4 原则 7、§9.1、§9.2；`docs/ARCHITECTURE.md` §1、§1.1、§5

## Context

PRD §4 原则 7 写明 "Agent 可增强，但不能替代主链路"，ARCHITECTURE §1.1 进一步把主链路定义为 "确定性的 source-first compiler"。这两条共同把 `nexu-io/html-anything` 那种 "agent 直接生成 HTML artifact" 的产品挡在边界外。

但在 grill 过程中，PRD 的"逻辑（Logic）"轴被明确为：控制 HTML 输出的骨架——内容顺序、内容聚合、阅读引导路径（如：总分总 / 结果先行 / 背景→方案→结果）。

要做到这一点，compiler 必须能识别每个 SourceBlock 在文章里扮演的角色（主张 / 证据 / 背景 / 方法 / 反例 / 结论 ...）。

确定性规则代码能做到的上限是：

- 解析 heading 层级、列表、表格、代码块。
- 字符串匹配 "TLDR / 总结 / Summary / 因此 / 综上" 等显式信号词。
- 抽第一段、抽最后一段。
- 按 heading 顺序铺 RenderNode。

这恰好等于 Faithful 模式的能力。在没有显式信号词的真实 Markdown（AI 长输出、研究笔记、推文整理）里，规则代码无法可靠区分 "结论段 vs 证据段"，因此无法兑现 PRD 的"信息重组优先于皮肤美化"承诺（§4 原则 5）。

如果坚持 v0.1 不引入 LLM，逻辑轴在 MVP 阶段就只能是 Faithful 一档，产品对外只剩"密度 + 主题"两轴，差异化退化到与"漂亮的 Markdown 预览器"难以区分。

## Decision

**允许 LLM 参与 compiler 的 `buildRenderPlan` 步骤，且仅限这一步。**

主链路重述如下：

```text
Markdown
  -> SourceBlock[]            (确定性)
  -> SemanticDocument         (确定性)
  -> RenderPlan               (LLM 可参与 ← 仅此一步)
  -> HTML                     (确定性)
```

`buildRenderPlan` 的 LLM 接口必须是封闭契约：

- **输入**：`(SourceBlock[], LogicId, DensityId)`。
- **输出**：`RenderPlan`——`RenderNode[]` 引用既有 SourceBlock id，不允许新文本。
- **不变量**：每个 RenderNode 的 `sourceBlockIds` 必须是输入 SourceBlock 集合的子集；如果 LLM 输出引入新 id、新事实或新引用，视为非法响应，回落 Faithful 重新编译。
- **缓存键**：`(markdown_hash, logic_id, density_id)`。命中缓存即跳过 LLM 调用。
- **失败处理**：超时 / 网络错误 / 配额耗尽 → 回落 Faithful。

## Consequences

### 必须更新的文档

- `PRD.md` §4 原则 7：从"Agent 可增强，但不能替代主链路"细化为"Agent 不能直接产出 HTML projection；可以产出 compiler 中间结构（RenderPlan、SemanticDocument 标注等）"。
- `ARCHITECTURE.md` §1.1：将"主链路必须是确定性的 source-first compiler"改为"主链路必须保证 source map 完整 + HTML 由确定性 renderer 产出；LLM 仅在 `buildRenderPlan` 步骤参与"。
- `ARCHITECTURE.md` §5：在 `buildRenderPlan` 步骤注明可选 LLM 路径与回落策略。

### "实时"承诺的兑现方式重新切分

| 用户动作 | 是否触发 LLM | 用户感知 |
|---|---|---|
| 敲字（Markdown 内容增删改） | 否 | 立即更新 HTML，复用上一份 RenderPlan 做局部 reflow |
| 切换密度 | 否 | 立即（CSS + RenderPlan 后处理） |
| 切换主题 | 否 | 立即（CSS only） |
| 切换逻辑 | **是** | debounce / 显式触发 / 显示 loading |

PRD §9.2 已为此预留口子（"AI 重组后置为手动按钮或 debounce 后任务"）。

### Source-First 含义被精确化

原来项目内部隐含的 "source-first = 主链路无 AI"，被替换为两条不可让步的不变量（见 `CONTEXT.md` "Source-First" 条目）：

1. 任何 HTML 节点都能追溯到至少一个 SourceBlock。
2. HTML 由确定性 renderer 产出，不允许 agent 直接写 HTML。

LLM 参与 `buildRenderPlan` 不违反这两条。

### 与 html-anything 边界仍清晰

`html-anything` 的主链路是 `Input → Agent → HTML`，agent 输出是 HTML 字符串。本项目的主链路是 `Input → ... → RenderPlan（agent 可参与）→ 确定性 Renderer → HTML`，agent 输出是结构化中间产物。差异化没有被削弱。

## Alternatives Considered

### A. 砍掉逻辑轴

v0.1 工具栏只暴露密度 + 主题两轴。逻辑推到 v0.2。

**否决理由**：产品差异化在 v0.1 体现不出来——用户切来切去只是换皮肤换间距，回到 "Markdown 预览器" 的认知。"信息重组优先于皮肤美化"（PRD §4 原则 5）变成空头支票。

### C. 用户显式打标签

约定 Markdown 内注释（如 `<!-- role: 结论 -->`）声明段落角色，规则代码据此重排。

**否决理由**：把负担转嫁给用户。与 PRD §3 第一优先用户（"把 ChatGPT/Claude/Codex/Gemini 长输出转成更好阅读的页面"）冲突——这类用户复制粘贴一份 AI 输出过来，恰恰是不想再做任何额外标注。

## Status Notes

本 ADR 决定了 MVP 在"主链路 + AI 边界"上的姿态。具体 LLM provider 选型、prompt 工程、缓存层实现，留给后续 ADR / 任务。
