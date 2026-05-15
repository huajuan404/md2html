# ADR 0006: Local CLI LLM client path

- Date: 2026-05-15
- Status: Accepted for MVP implementation

## Context

The product promises that the core editor works with zero API keys. The LLM is allowed to participate only in the RenderPlan step, and M1-M4 already run without any LLM by using deterministic planning.

M5 needs a concrete contract for tests, fallback behavior, and future real model integration.

## Decision

Use a local CLI adapter as the default real LLM path after the deterministic MVP path is stable.

The app/compiler boundary is:

```ts
type LlmClient = {
  invoke(request: LlmRenderPlanRequest): RenderPlan
}
```

The MVP implementation keeps this as an injected interface so tests can pass a stub. The future desktop/local-server wrapper may discover CLIs on `PATH` in this order:

1. `claude`
2. `codex`
3. `gemini`
4. `cursor-agent`

The browser-only app must not require any of these CLIs to load, edit, preview, or export faithful deterministic HTML.

## Consequences

- CI and unit tests use a stub `LlmClient`.
- If the CLI is absent, errors, times out, or returns an invalid plan, the compiler falls back to faithful rendering.
- The LLM never returns HTML. It returns only a `RenderPlan` that must pass skeleton and source-block validation before rendering.
- API-key entry in the browser is not part of MVP.

## Rejected

- Browser directly calls OpenAI/Anthropic APIs: this creates CORS, key storage, and billing concerns.
- Server-only SaaS proxy: this violates local-first expectations for the open-source MVP.
- LLM-generated HTML: this violates the source-first renderer boundary.
