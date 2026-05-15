import { useEffect, useMemo, useRef, useState } from 'react'
import { compileMarkdownToHtml } from '../compiler/compileMarkdown'
import { detectShape } from '../compiler/detectShape'
import { extractSourceBlocks } from '../compiler/extractSourceBlocks'
import type { CompileOptions, ContentLanguage, DensityId, LogicId, RenderPlan, ThemeId } from '../compiler/types'
import { MarkdownEditor } from '../editor/MarkdownEditor'
import { detectDefaultUiLanguage, getUiDict } from '../i18n'
import { sampleEn } from '../i18n/samples/en'
import { sampleZh } from '../i18n/samples/zh'
import type { UiLanguage } from '../i18n/types'
import readme from '../../fixtures/inputs/readme.md?raw'

type PresetId = 'faithful' | 'reader' | 'brief' | 'deck' | 'custom'
type ModelStatus =
  | { state: 'deterministic'; provider?: string; error?: string }
  | { state: 'waiting'; provider?: string; error?: string }
  | { state: 'running'; provider?: string; error?: string }
  | { state: 'applied'; provider: string; error?: string }
  | { state: 'fallback'; provider: string; error?: string }
  | { state: 'reused'; provider?: string; error?: string }

type Axes = {
  logic: LogicId
  density: DensityId
  theme: ThemeId
}

const LOCAL_STORAGE_MARKDOWN_KEY = 'md2html:last-markdown'
const LOCAL_STORAGE_UI_LANGUAGE_KEY = 'md2html:ui-language'

const presets: Record<Exclude<PresetId, 'custom'>, Axes> = {
  faithful: { logic: 'none', density: 'comfortable', theme: 'editorial-light' },
  reader: { logic: 'narrative', density: 'comfortable', theme: 'editorial-light' },
  brief: { logic: 'result-first', density: 'compact', theme: 'dense-brief' },
  deck: { logic: 'result-first', density: 'per-screen', theme: 'dark-studio' },
}

export function App() {
  const [markdown, setMarkdown] = useState(() => loadInitialMarkdown())
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => loadInitialUiLanguage())
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>('auto')
  const [includeSourceMetadata, setIncludeSourceMetadata] = useState(false)
  const [preset, setPreset] = useState<PresetId>('faithful')
  const [axes, setAxes] = useState<Axes>(presets.faithful)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [modelPlan, setModelPlan] = useState<RenderPlan | undefined>()
  const [modelStatus, setModelStatus] = useState<ModelStatus>({ state: 'deterministic' })
  const [relayoutNonce, setRelayoutNonce] = useState(0)

  const lastModelShapeRef = useRef<string | undefined>(undefined)
  const lastModelPlanRef = useRef<RenderPlan | undefined>(undefined)
  const t = getUiDict(uiLanguage)

  const sourceBlocks = useMemo(() => extractSourceBlocks(markdown), [markdown])
  const shape = useMemo(() => detectShape(sourceBlocks), [sourceBlocks])
  const compileOptions = useMemo<CompileOptions>(() => ({
    ...axes,
    contentLanguage,
    includeSourceMetadata,
  }), [axes, contentLanguage, includeSourceMetadata])

  const result = useMemo(
    () => compileMarkdownToHtml(markdown, { ...compileOptions, includeSourceMetadata: true }, { renderPlanOverride: modelPlan }),
    [compileOptions, markdown, modelPlan],
  )

  const exportResult = useMemo(
    () => compileMarkdownToHtml(markdown, compileOptions, { renderPlanOverride: modelPlan }),
    [compileOptions, markdown, modelPlan],
  )

  const selectedBlocks = selectedSourceIds
    .map((id) => result.sourceBlocks.find((block) => block.id === id))
    .filter((block): block is NonNullable<typeof block> => Boolean(block))

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== 'md2html:select-source') return
      setSelectedSourceIds(String(event.data.sourceBlockIds || '').split(' ').filter(Boolean))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const sourceSelection = selectedBlocks.length
    ? {
        from: selectedBlocks[0].startOffset,
        to: selectedBlocks[selectedBlocks.length - 1].endOffset,
      }
    : undefined

  useEffect(() => {
    window.localStorage.setItem(LOCAL_STORAGE_MARKDOWN_KEY, markdown)
  }, [markdown])

  useEffect(() => {
    window.localStorage.setItem(LOCAL_STORAGE_UI_LANGUAGE_KEY, uiLanguage)
  }, [uiLanguage])

  useEffect(() => {
    let cancelled = false
    if (axes.logic === 'none') {
      setModelPlan(undefined)
      setModelStatus({ state: 'deterministic' })
      return
    }

    if (relayoutNonce === 0 && lastModelShapeRef.current === shape && lastModelPlanRef.current) {
      setModelPlan(lastModelPlanRef.current)
      setModelStatus({ state: 'reused' })
      return
    }

    setModelPlan(undefined)
    setModelStatus({ state: 'waiting' })
    const timeout = window.setTimeout(async () => {
      setModelStatus({ state: 'running' })
      try {
        const response = await fetch('/api/render-plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ markdown, options: compileOptions }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json() as { plan: RenderPlan; provider: string; usedModel: boolean; fellBack: boolean; error?: string }
        if (cancelled) return
        setModelPlan(payload.plan)
        lastModelShapeRef.current = shape
        lastModelPlanRef.current = payload.plan
        setModelStatus(payload.usedModel
          ? { state: 'applied', provider: payload.provider }
          : { state: 'fallback', provider: payload.provider, error: payload.error })
      } catch (error) {
        if (cancelled) return
        setModelStatus({ state: 'fallback', provider: 'local-api', error: error instanceof Error ? error.message : String(error) })
      }
    }, 750)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [axes.logic, axes.density, compileOptions, markdown, relayoutNonce, shape])

  function applyPreset(nextPreset: Exclude<PresetId, 'custom'>) {
    setPreset(nextPreset)
    setAxes(presets[nextPreset])
  }

  function loadSample() {
    setMarkdown(uiLanguage === 'zh' ? sampleZh : sampleEn)
  }

  function updateAxis<K extends keyof Axes>(key: K, value: Axes[K]) {
    setPreset('custom')
    setAxes((current) => ({ ...current, [key]: value }))
  }

  async function copyHtml() {
    await navigator.clipboard?.writeText(exportResult.html)
  }

  function downloadHtml() {
    const url = URL.createObjectURL(new Blob([exportResult.html], { type: 'text/html;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'md2html.html'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return
    setMarkdown(await file.text())
  }

  return (
    <main className="app-shell">
      <style>{appCss}</style>
      <header className="toolbar" aria-label="Toolbar">
        <strong>{t.appName}</strong>
        <label>{t.upload}<input aria-label={t.upload} type="file" accept=".md,.markdown,.txt" onChange={(event) => void uploadFile(event.target.files?.[0])} /></label>
        <label>{t.preset}<select aria-label={t.preset} value={preset} onChange={(event) => {
          const value = event.target.value as PresetId
          if (value !== 'custom') applyPreset(value)
        }}>
          <option value="custom">{t.custom}</option>
          <option value="faithful">{t.faithful}</option>
          <option value="reader">{t.reader}</option>
          <option value="brief">{t.brief}</option>
          <option value="deck">{t.deck}</option>
        </select></label>
        <label>{t.logic}<select aria-label={t.logic} value={axes.logic} onChange={(event) => updateAxis('logic', event.target.value as LogicId)}>
          <option value="none">{t.none}</option><option value="result-first">{t.resultFirst}</option><option value="narrative">{t.narrative}</option>
        </select></label>
        <label>{t.density}<select aria-label={t.density} value={axes.density} onChange={(event) => updateAxis('density', event.target.value as DensityId)}>
          <option value="comfortable">{t.comfortable}</option><option value="compact">{t.compact}</option><option value="per-screen">{t.perScreen}</option>
        </select></label>
        <label>{t.theme}<select aria-label={t.theme} value={axes.theme} onChange={(event) => updateAxis('theme', event.target.value as ThemeId)}>
          <option value="editorial-light">{t.editorialLight}</option><option value="dense-brief">{t.denseBrief}</option><option value="dark-studio">{t.darkStudio}</option>
        </select></label>
        <button type="button" onClick={loadSample}>{t.loadSample}</button>
        <button type="button" onClick={() => setRelayoutNonce((value) => value + 1)}>{t.relayout}</button>
        <label>{t.uiLanguage}<select aria-label={t.uiLanguage} value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UiLanguage)}>
          <option value="zh">中</option><option value="en">EN</option>
        </select></label>
        <label>{t.contentLanguage}<select aria-label={t.contentLanguage} value={contentLanguage} onChange={(event) => setContentLanguage(event.target.value as ContentLanguage)}>
          <option value="auto">{t.auto}</option><option value="zh">{t.zh}</option><option value="en">{t.en}</option>
        </select></label>
        <label className="checkbox"><input type="checkbox" checked={includeSourceMetadata} onChange={(event) => setIncludeSourceMetadata(event.target.checked)} />{t.metadata}</label>
        <button type="button" onClick={() => void copyHtml()}>{t.copy}</button>
        <button type="button" onClick={downloadHtml}>{t.download}</button>
        <span data-testid="model-status" className={`model-status ${modelStatus.state}`} title={modelStatus.error}>{t.modelStatus}: {modelStatusText(modelStatus, t)}</span>
      </header>
      <section className="workspace">
        <div className="editor-pane"><MarkdownEditor value={markdown} onChange={setMarkdown} selection={sourceSelection} /><div data-testid="source-selection-status" className="selection-status">{selectedBlocks.length ? `Lines ${selectedBlocks[0].startLine}-${selectedBlocks[selectedBlocks.length - 1].endLine}` : 'No source block selected'}</div></div>
        <iframe title="HTML projection preview" sandbox="allow-scripts" srcDoc={result.html} />
      </section>
    </main>
  )
}



function loadInitialUiLanguage(): UiLanguage {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(LOCAL_STORAGE_UI_LANGUAGE_KEY)
  return stored === 'zh' || stored === 'en' ? stored : detectDefaultUiLanguage()
}

function loadInitialMarkdown(): string {
  if (typeof window === 'undefined') return readme
  return window.localStorage.getItem(LOCAL_STORAGE_MARKDOWN_KEY) || (loadInitialUiLanguage() === 'zh' ? sampleZh : sampleEn)
}

function modelStatusText(modelStatus: ModelStatus, t: ReturnType<typeof getUiDict>): string {
  if (modelStatus.state === 'deterministic') return t.deterministic
  if (modelStatus.state === 'waiting') return t.modelWaiting
  if (modelStatus.state === 'running') return t.modelRunning
  if (modelStatus.state === 'applied') return `${t.modelApplied}(${modelStatus.provider})`
  if (modelStatus.state === 'fallback') return `${t.modelFallback}(${modelStatus.provider})`
  return t.modelReused
}

const appCss = `
html,body,#root{height:100%;margin:0}.app-shell{display:grid;grid-template-rows:auto 1fr;height:100vh;font-family:system-ui,sans-serif}.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #ddd;padding:10px 12px;background:#fff}.toolbar label{display:flex;gap:4px;align-items:center;font-size:12px;color:#344054}.toolbar input[type=file]{max-width:120px}.toolbar select,.toolbar button{font:inherit}.checkbox{white-space:nowrap}.model-status{font-size:12px;color:#475467;background:#f2f4f7;border:1px solid #d0d5dd;border-radius:999px;padding:3px 8px}.model-status.applied{background:#ecfdf3;color:#027a48}.model-status.fallback{background:#fff6ed;color:#b54708}.model-status.running,.model-status.waiting{background:#eff8ff;color:#175cd3}.workspace{display:grid;grid-template-columns:1fr 1fr;min-height:0}.editor-pane{display:grid;grid-template-rows:1fr auto;min-height:0;border-right:1px solid #ddd}.markdown-editor{min-height:0;height:100%;overflow:hidden}.selection-status{border-top:1px solid #ddd;padding:8px 12px;font-size:12px;color:#475467;background:#f9fafb}.workspace iframe{border:0;width:100%;height:100%}
`
