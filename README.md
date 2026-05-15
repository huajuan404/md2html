# md2html

Source-first Markdown projection editor. Keep Markdown as the editable source, render a human-optimized HTML projection, and preserve a source map from major HTML blocks back to Markdown blocks.

## What works now

- Vite + React + TypeScript app shell.
- Markdown source textarea with live iframe HTML preview.
- Deterministic SourceBlock extraction with line/offset spans.
- Faithful, result-first, and narrative planning modes constrained by 9 logic-density skeletons.
- Three density modes and three themes.
- UI language and content language controls are separate.
- Source metadata can be preserved or stripped from exported HTML.
- Preview block click maps back to source lines.
- Unit and browser acceptance tests run locally.

## Quick start

```bash
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open the printed local URL.

## Verification

```bash
pnpm build
pnpm test:unit
pnpm test:e2e
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
