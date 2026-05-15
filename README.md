# md2html

Source-first Markdown projection editor. Keep Markdown as the editable source, render a human-optimized HTML projection, and preserve a source map from major HTML blocks back to Markdown blocks.

## What works now

- Vite + React + TypeScript app shell.
- CodeMirror Markdown source editor with live sandboxed iframe HTML preview.
- Deterministic SourceBlock extraction with line/offset spans.
- Faithful, result-first, and narrative planning modes constrained by 9 logic-density skeletons.
- Three density modes and three themes.
- UI language and content language controls are separate.
- Source metadata can be preserved or stripped from exported HTML.
- Preview block click maps back to source lines.
- Unit and browser acceptance tests run locally.
- README visual audit captures system-vs-golden screenshots for manual review.

## Quick start

```bash
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open the printed local URL.

## Model integration

The browser cannot spawn local model CLIs directly, so md2html uses a local Vite bridge endpoint:

```text
Browser editor -> POST /api/render-plan -> local provider -> RenderPlan JSON -> deterministic HTML renderer
```

The model never returns HTML. It only returns a `RenderPlan`, and the server validates that every node references existing SourceBlocks and matches the selected skeleton.

Run with a provider:

```bash
pnpm dev:mock --host 127.0.0.1 --port 5173     # deterministic test provider
pnpm dev:claude --host 127.0.0.1 --port 5173   # uses local Claude Code login
pnpm dev:codex --host 127.0.0.1 --port 5173    # uses local Codex CLI login
```

Other possible provider paths, besides direct hosted API keys:

- Local CLI bridge: Claude Code, Codex CLI, Gemini CLI, Cursor Agent.
- Local model runtime: Ollama or LM Studio behind a localhost endpoint.
- Native desktop wrapper: Electron/Tauri app spawns local commands safely.
- Browser extension/native messaging: extension mediates between browser and local tool.
- Manual import/export: user pastes a RenderPlan JSON returned by any model.

Direct OpenAI/Anthropic/Gemini API keys remain possible later, but they are not the default MVP path because they create key storage, CORS, and billing concerns.

## Verification

```bash
pnpm build
pnpm test:unit
pnpm test:visual
pnpm test:e2e
pnpm test:all
```

## Project thesis

Markdown is naturally editable. HTML is naturally consumable. md2html treats Markdown as the canonical source and HTML as a regenerated projection. AI may help produce a structured render plan in future integrations, but HTML is always emitted by deterministic renderer code.

Read the planning docs:

- `CONTEXT.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ACCEPTANCE.md`
- `docs/adr/`

## Repository status

This repository is an MVP implementation scaffold plus verified compiler/browser baseline. See `work.log` for the chronological development archive.

## License

MIT. See `LICENSE`.
