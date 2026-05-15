# ADR 0002: 形状变化驱动的重编译触发

- 日期：2026-05-15
- 状态：Accepted
- 相关：ADR 0001、`docs/PRD.md` §4 原则 4、§5.4、§9.1、§9.2；`docs/ARCHITECTURE.md` §4.1、§5、§7.4

## Context

ADR 0001 把 LLM 限定在 compiler 的 `buildRenderPlan` 步骤，并通过 debounce（典型 750ms）控制触发频率。但 "debounce after edit" 这条规则过粗：

- 用户改一个错别字 → 750ms 后停顿 → 触发 LLM → 重生成一份 RenderPlan。
- LLM 输出存在天然抖动；同一篇文章两次调用，可能得到结构略有不同的 RenderPlan。
- 副作用：**用户改了个错别字，整张卡片布局/分栏/排序可能变了**。Token 浪费叠加视觉不稳定，与 PRD §9.1（信息重组失真）的精神冲突。

实际上，绝大多数编辑动作（typo、字词调整、句子改写）**不会改变文档的论证结构**，因此不应让 LLM 重新评估论证结构。

## Decision

**只有改变文档"形状"的编辑才触发 LLM 重排。** 同时**强制提供手动重新生成布局按钮**作为兜底。

### 形状（Shape）定义

`shape(SourceBlock[])` 是一个确定性、O(n) 可计算的签名：

```
shape = (block.type 序列, 每个 heading block 的 depth)
```

具体来说：

- block 数量。
- 每个 block 的 `type`（heading / paragraph / list / table / code / quote / thematicBreak / html）按序列。
- 每个 heading block 的 `depth`。

### 重编译触发规则

每次 Markdown 变化后：

```
new = parse(markdown)
if shape(new) == shape(lastCommittedSourceBlocks)
  → text-only edit
  → 复用 lastRenderPlan，仅替换 block 的 text 字段
  → 立即重渲染 HTML，不触发 LLM
else
  → structural edit
  → 立即用 Faithful 重渲染 HTML（保证实时反馈）
  → 取消任何 pending LLM 调用
  → 750ms debounce 后启动 LLM 重算 RenderPlan
  → LLM 返回 → 替换 lastRenderPlan、重渲染 HTML
```

`lastCommittedSourceBlocks` 是最近一次 LLM 成功产出 RenderPlan 时对应的 SourceBlock 快照。

### 手动重排按钮（强制）

工具栏必须有一个手动 "重新生成布局" 按钮。

触发条件：用户主动点击。

行为：

- 无视形状判定，强制触发一次 LLM 重算。
- 取消任何 pending LLM 调用（避免重复）。
- 用于覆盖三类场景：
  1. 形状没变但内容质变（重写整段文字、引入新论点）。
  2. 用户对当前自动 RenderPlan 不满意，想要"换一种排"。
  3. 上次 LLM 失败回落 Faithful 后，用户想重试。

按钮始终可见，不依赖任何状态判定。

### LLM 缓存键

```
cacheKey = hash(shape, logicId, densityId, blockTextDigests)
```

- `shape` 决定主结构。
- `blockTextDigests` 是每个 block 文本的轻量哈希数组——主要为了让"用户做了一次结构变化，又撤销回原状"能命中缓存。
- 命中即跳过 LLM。

## Consequences

### Q5 同步收口：SourceBlock id 用 `block-${index}` 即可

因为本 ADR 保证：

- 形状不变时不重排，`block-${index}` 在 RenderPlan 里的引用天然对齐。
- 形状变了就走全量 LLM 重算，旧 id 全部作废，无所谓"跨编辑稳定"。

`ARCHITECTURE.md` §4.1 现有 id 方案不动。AI Patch（v0.3+）届时若需要跨编辑稳定 id，再升级到 content-hash + position 策略，不属于本 ADR 范围。

### 必须更新的文档

- `PRD.md` §5.4 工具栏：补充"重新生成布局"按钮项。
- `PRD.md` §4 原则 4（实时编辑）：补充说明实时分两档——
  - text-only 编辑：确定性即时渲染。
  - structural 编辑：先 Faithful 即时反馈，LLM 异步升级。
- `ARCHITECTURE.md` §5 编译主链路：在 `buildRenderPlan` 步骤前插入 "shape diff 判定" 子步骤。
- `ARCHITECTURE.md` §7.4 增量更新策略：现在已是显式的分类策略，可直接落地。

### 用户体感

| 用户动作 | 用户感知 |
|---|---|
| 改错别字 / 修标点 | 渲染完全稳定，无延迟 |
| 在段落里改几个词 | 渲染完全稳定，无延迟 |
| 回车拆段 / 加标题 / 插表格 | 看到 Faithful 即时刷新；~1 秒后切换到 logic 形态 |
| 撤销刚才的结构变化 | 命中缓存，直接恢复原 RenderPlan，无 LLM 调用 |
| 主动点 "重新生成布局" | 出现 loading；LLM 完成后切换 |

### Token 成本

- 上限大致 = 用户做出结构变化的次数 + 手动按钮点击次数。
- 不再随键盘事件线性增长。

## Alternatives Considered

### γ-loose：形状 + 文本编辑距离阈值

形状不变 + 任一 block 字符变化 > 50% → 也判定为 structural。

**否决理由**：

- 50% 是魔法阈值，未来一定会反复 tweak，是技术债。
- 用户体感差："我刚才只是改了段措辞，怎么 AI 又跑了"。
- 视觉溢出问题应由 CSS（max-height + overflow / line-clamp）兜底，不该让 LLM 来收拾。
- 手动按钮已经覆盖"内容质变但形状没变"的情况，用户主动权更清晰。

### 永远 debounce 全量重排（即原 ADR 0001 文字直读）

**否决理由**：见本 ADR Context 段。
