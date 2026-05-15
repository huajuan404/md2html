# ADR 0003: Source map 粒度 = RenderNode 边界

- 日期：2026-05-15
- 状态：Accepted
- 相关：`docs/PRD.md` §5.3、§5.7、§10；`docs/ARCHITECTURE.md` §4.3、§7

## Context

PRD 反复要求"主要 HTML 视觉节点"携带 `data-render-node` 和 `data-source-blocks`，但从未定义"主要"边界。这决定：

- HTML 里到底有多少元素带 source-map 标签。
- 点击 / 悬停的命中粒度。
- 导出时 metadata stripping 的成本。
- 测试覆盖的形状。

候选粒度：

1. RenderNode 外层粒度（粗）。
2. 升格细节为独立 RenderNode（细）。
3. 双属性分工（render-node 在外层，source-blocks 可下沉到子元素）。

## Decision

**采用 RenderNode 外层粒度**：

> 每个 RenderNode 渲染出的最外层 HTML 元素**必须**同时挂 `data-render-node` 和 `data-source-blocks`。**其余 HTML 元素一律不挂这两个属性。**

派生规则：

- 点击事件靠 DOM 向上找最近的 `[data-render-node]` 祖先（已在 `ARCHITECTURE.md` §7.2 描述）。
- 导出时 metadata stripping 只需扫这两个属性，零字符串解析复杂度。
- `RenderPlan.nodes` 数量 === HTML 里带 `data-render-node` 的元素数量。可作为测试不变量。

### 原子 RenderNode 必须保留 source map

`quote / table / code` 三种 kind 本质是对单个 SourceBlock 的"原子搬运"，它们的 `sourceBlockIds` 长度恒为 1：

- 即使在 Brief / Deck 等重排模式下，也不允许把表格/代码/引用打散重组。
- LLM 输出 RenderPlan 时如果出现 `quote/table/code` 的 sourceBlockIds 为空或多于 1，视为非法响应，回落 Faithful。

## Consequences

### MVP 体感的合理退化

- 点 TOC 整块 → 跳到第一个 heading 的 source（因为 TOC 整体对应所有 heading）。
- 点 Reader 的"关键引用"卡 → 跳到那一条 quote 的 source（quote 是原子）。

第一条是轻度退化，PRD §10 验收清单仍可达成（"点击或悬停右侧节点能显示或定位来源"）。

### 未来升级路径不破坏 ADR

若日后用户反馈"我要点 TOC 第 3 条直接跳过去"，可通过**新增 `toc-entry` 这种 RenderNode kind**升级，仍然符合本 ADR 的规则（每个 `toc-entry` 是独立 RenderNode，独立挂标签）。不需要修改源 map 注入规则。

### 测试不变量（可直接落地）

- `RenderPlan.nodes.length` === querySelectorAll(`[data-render-node]`).length。
- 每个 `[data-source-blocks]` 元素都同时有 `[data-render-node]`，反之亦然。
- 任何 `quote/table/code` RenderNode 的 `sourceBlockIds.length === 1`。

## Alternatives Considered

### 路 2：细到每个可点击元素是独立 RenderNode

`list-item / toc-entry / card-bullet` 都升格为独立 RenderNode。

**否决理由**：RenderPlan 节点数从几十爆到几百，LLM 要为每个 `<li>` 分配 sourceBlockIds，又贵又抖。MVP 不该承担。

### 路 3：双属性分工

`data-render-node` 在外层，`data-source-blocks` 可下沉到任意 1:1 单 block 对应的子元素。

**否决理由**：两套属性两套语义，文档/实现/测试负担翻倍，MVP 用户感知不到差别。
