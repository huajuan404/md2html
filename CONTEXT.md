# Domain Glossary

本文件是 md2html 项目的领域语言词典。**仅记录术语定义，不放实现细节**。
架构决策见 `docs/adr/`，产品需求见 `docs/PRD.md`，技术方案见 `docs/ARCHITECTURE.md`。

---

## 输出的三轴

HTML 投影（projection）由三个**正交**轴共同决定：

### 逻辑（Logic）

控制 HTML 输出的**骨架**——内容顺序、内容聚合关系、阅读引导路径。
回答的是"先说什么、再说什么、什么放在一起"。

例：

- 总分总
- 结果先行 + 证据其后
- 背景 → 调查 → 方案 → 实现 → 结果

**不**控制：视觉、空间分布、配色。

### 密度（Density）

控制 HTML 输出的**表达**——一屏装多少内容、分几栏、分区策略。
回答的是"怎么把这些内容铺进屏幕"。

例：

- 极简发布页：低密度，大量留白，单栏
- 数据 Dashboard：高密度，多栏分区，信息高度并置

**不**控制：内容顺序、配色。

### 主题（Theme）

控制 HTML 输出的**视觉**——配色色系、字体、圆角、阴影等纯样式 token。
回答的是"看起来是什么风格"。

**不**控制：结构、内容顺序、分区方式。

---

## 正交性约束

三轴必须保持互相正交：

- 换主题 → 骨架不变、密度不变。
- 换密度 → 阅读顺序不变、配色不变。
- 换逻辑 → 配色不变、可以触发密度允许的不同分区策略，但不强制。

任何把 logic 的事写到 theme 里，或把 theme 的事写到 density 里的实现，都是违反正交性。

---

## Source-First

本项目定义的 source-first **不是**"主链路绝对没有 AI"，而是两条**不可让步的不变量**：

1. **可追溯性**：任何 HTML 节点都能追溯到至少一个 SourceBlock；纯装饰节点除外，但装饰节点不得承载原文外的新事实。
2. **HTML 由确定性 renderer 产出**：不允许 agent 直接写 HTML 字符串作为 projection。

LLM **可以**参与 compiler 的中间步骤（如 `buildRenderPlan`），前提是它的输出是结构化数据（RenderPlan、SemanticDocument 标注等），且不引入 SourceBlock 之外的新内容。

详见 `docs/adr/0001-llm-in-build-render-plan.md`。

---

## SourceBlock

Markdown 源被切分后的最小映射单位。第一版做 block-level 映射，不做 token-level。
每个 SourceBlock 是 source map 的端点——HTML 节点通过 `data-source-blocks` 指向它。

详细字段见 `docs/ARCHITECTURE.md` §4.1。

## RenderPlan

Compiler 的核心中间产物。回答"HTML 应该长什么骨架"。
由 logic + density 联合决定，**不**包含视觉信息（视觉信息住在 Theme）。
是 LLM 唯一被允许参与生产的环节（见 Source-First 条目）。

详细字段见 `docs/ARCHITECTURE.md` §4.3。

---

## Shape（文档形状）

SourceBlock[] 的结构签名：`(block.type 序列, 每个 heading 的 depth)`。

用于判定一次编辑是否改动了文档骨架：

- Shape 不变 → text-only edit → 复用既有 RenderPlan，仅替换 block 文本，**不**走 LLM。
- Shape 变化 → structural edit → Faithful 即时重渲染 + debounce 后走 LLM。

详见 `docs/adr/0002-shape-change-driven-recompile.md`。

## 重新生成布局（Manual Re-layout）

工具栏强制提供的手动按钮，用于覆盖以下场景：

- 形状没变但内容质变（重写整段、引入新论点）。
- 用户对当前自动 RenderPlan 不满意。
- 上一次 LLM 失败回落 Faithful 后想重试。

点击后无视形状判定，强制触发一次 LLM 重算。是用户掌控 AI 行为的主要抓手。

---

## Source Map 粒度

**RenderNode 外层粒度**：每个 RenderNode 渲染出的最外层 HTML 元素挂 `data-render-node` + `data-source-blocks`，其余元素不挂。

派生不变量：`RenderPlan.nodes.length === HTML 里带 data-render-node 的元素数量`。

详见 `docs/adr/0003-source-map-granularity.md`。

## 原子 RenderNode

`quote / table / code` 三种 kind 是对单个 SourceBlock 的"原子搬运"：

- `sourceBlockIds` 长度恒为 1。
- 任何重排模式（Brief / Deck 等）下都不允许把它们打散。
- LLM 输出违反此约束 → 非法响应 → 回落 Faithful。

---

## MVP 三轴的取值

### Logic（逻辑）

| id | 中文名 | 含义 |
|---|---|---|
| `none` | 原文顺序 | 不重排，按 Markdown 原结构铺；Faithful 模式与所有 LLM 失败的回落 |
| `result-first` | 结果先行 | LLM 把结论/主张抽到顶部，证据/方法/背景放后段 |
| `narrative` | 时序展开 | LLM 还原"背景 → 问题 → 调查 → 方案 → 结果"的论证流 |

### Density（密度）

| id | 含义 | 视觉副产物 |
|---|---|---|
| `comfortable` | 长滚动页，留白宽 | 长文阅读形态 |
| `compact` | 长滚动页，多栏分区 | Dashboard / 简报形态 |
| `per-screen` | 分页，一屏一个核心观点 | 卡片流 / Deck 形态 |

### Theme（主题）

`editorial-light` / `dense-brief` / `dark-studio`（见 `docs/ARCHITECTURE.md` §4.4）。

### 命名预设（toolbar 一键切换）

| 预设 | logic | density | theme |
|---|---|---|---|
| Faithful | `none` | `comfortable` | `editorial-light` |
| Reader | `narrative` | `comfortable` | `editorial-light` |
| Brief | `result-first` | `compact` | `dense-brief` |
| Deck | `result-first` | `per-screen` | `dark-studio` |

用户拨任一独立下拉，预设名称切换到"自定义"。

---

## UI 语言（UI Language）

编辑器/工具自身的展示语言。

- 影响：UI chrome（按钮/菜单/tooltip）+ 示例 Markdown 默认语言。
- 用户手动切换，持久化到 localStorage。
- 默认 = `navigator.language`，未命中回落 `en`。

## 内容语言（Content Language）

文档本身的语言属性，**与 UI 语言独立**。

- 影响：输出 HTML 自动标签（TOC/Summary/Evidence）+ LLM prompt + LLM 产出 + 导出 `<html lang>`。
- 默认 = 从 Markdown 自动检测（CJK 占比启发式）。
- 用户可手动覆盖（"自动检测 / zh / en"）。

> 设计原则：UI 是给编辑者的，内容是给读者的——两者读的是不同语言时，必须解耦。

详见 `docs/adr/0004-ui-language-vs-content-language.md`。

---

## 骨架模板（Skeleton Template）

由产品团队预写的"页面应该有哪几个区、按什么顺序"的配置。

- 每个 (逻辑, 密度) 组合对应一份骨架模板。MVP 共 9 份。
- 区可以标记为**必有**或**可选**；可选区可声明出现条件（如"章节数 >= 4"）。
- AI 不能改变骨架的区数量、顺序，也不能创造新区。
- AI 的工作被限定为三件事：把源块归类 → 按骨架分配进对应区 → 给每个区起标题。
- AI 找不到对应内容时**跳过可选区**，不硬塞。
- 骨架是配置文件，不是写死的代码，预留 v0.2+ 模板市场扩展空间。

详见 `docs/adr/0005-skeleton-templates.md`。
