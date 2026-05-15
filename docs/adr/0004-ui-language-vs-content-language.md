# ADR 0004: UI 语言与内容语言彻底解耦

- 日期：2026-05-15
- 状态：Accepted
- 相关：`docs/PRD.md` §5（i18n 此前未涉及）；`docs/ARCHITECTURE.md` §3（render-modes / themes）、§5

## Context

原 PRD 没有提多语言。本次 grill 加入需求："工具支持中英双语，一键切换"。

"多语言" 不是单一面，实际涵盖 6 个独立的面：

1. UI chrome（按钮、菜单、tooltip）。
2. 输出 HTML 自动标签（TOC、Summary、Evidence 等的本地化文字）。
3. LLM prompt 语言（用什么语言指挥 LLM 重排）。
4. LLM 产出语言（LLM 抽取/重写的标题、摘要等的语言）。
5. 示例 Markdown 默认语言。
6. 导出 HTML 的 `<html lang="...">`。

如果把所有 6 个面绑定到一个"全局语言"开关上，会产生 UX bug：用户用英文 UI 编辑中文 Markdown 时，输出 HTML 的 TOC 写 "Table of Contents"——给中文读者看的导出物里出现英文标签，是 i18n 的反模式。

## Decision

**引入两个独立概念**：

### UI 语言（UI Language）

- 编辑器/工具自身的展示语言。
- 影响：面 1（UI chrome）+ 面 5（示例 Markdown 默认语言）。
- 用户手动切换；持久化到 localStorage。
- 默认值：`navigator.language`，匹配不到时回落 `en`。

### 内容语言（Content Language）

- 文档本身的语言属性。
- 影响：面 2（输出标签）+ 面 3（LLM prompt）+ 面 4（LLM 产出）+ 面 6（导出 lang 属性）。
- 默认 = 从当前 Markdown 自动检测（字符集启发式：CJK 字符占比 > 30% → `zh`，否则 `en`，未来可扩展）。
- 工具栏暴露独立小下拉，可手动覆盖（"自动检测 / zh / en"）。

两者**互不影响**。用户在英文 UI 下编辑中文 Markdown，导出的 HTML 仍然是中文标签 + `<html lang="zh">`。

## Consequences

### 架构变化（PRD/ARCHITECTURE 需要补充）

- `compiler/` 新增 `detectContentLanguage(markdown): LangId` 函数。
- `render-modes/*` 模板里所有自动文字必须走 `t(key, contentLang)` 字典查询，不允许字面写中文/英文。
- `themes/` 不参与 i18n——主题是视觉 token，与语言无关。
- LLM prompt 按 `contentLang` 选择对应模板（中文 prompt 跑中文素材、英文 prompt 跑英文素材）。
- ADR 0002 的 LLM 缓存键追加 `contentLang` 维度：`hash(shape, logicId, densityId, blockTextDigests, contentLang)`。
- 导出 HTML 的 `<html lang="...">` 来自 contentLang，不来自 UI lang。
- `CompileOptions` 新增 `contentLanguage: LangId` 字段。

### 字典结构（架构抽象，预留扩展）

```
src/i18n/
  types.ts            // LangId, Dictionary, t()
  ui/
    zh.ts             // UI chrome 字典
    en.ts
  output/
    zh.ts             // 输出标签字典（TOC / Summary / Evidence ...）
    en.ts
  prompts/
    zh.ts             // LLM prompt 模板
    en.ts
  samples/
    zh.ts             // 示例 Markdown
    en.ts
```

新增语言 = 在每个目录加一个文件 + 注册到 LangId enum，**不改任何调用点**。

### MVP 范围

- 实际填充：`zh` + `en` 两套字典。
- 架构能力：任意数量语言，按上述目录添加即可。

### 测试不变量

- 不允许任何 render-mode 模板里出现字面中文/英文标签字符串——必须走 `t(key)`。lint rule 兜底。
- 切换 UI 语言不应触发 LLM 重算（不影响 cacheKey）。
- 切换内容语言**应**触发 LLM 重算（cacheKey 变了）。

## Alternatives Considered

### Scope A：只切 UI chrome

输出标签永远跟着内容走 / 写死英文 / 写死中文。

**否决理由**：用户切英文 UI 但写中文 Markdown 时，输出 HTML 里 TOC 写 "Table of Contents" 给中文读者看很违和。等同于 Scope C 但用户失去了"我用英文 UI 但导出中文文档"的合法场景。

### Scope B：UI 切，输出标签跟 UI 切

把 1 + 2 绑同一个语言。

**否决理由**：用户在英文 UI 下编辑中文 Markdown，TOC 标签变英文，但 LLM 抽出的卡片标题还是中文——中英混搭。比 A 更差。
