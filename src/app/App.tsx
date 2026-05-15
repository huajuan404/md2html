import { useMemo, useState } from 'react'
import { compileMarkdownToHtml } from '../compiler/compileMarkdown'
import type { ContentLanguage, DensityId, LogicId, ThemeId } from '../compiler/types'
import { detectDefaultUiLanguage, getUiDict } from '../i18n'
import type { UiLanguage } from '../i18n/types'
import readme from '../../fixtures/inputs/readme.md?raw'

type PresetId = 'faithful' | 'reader' | 'brief' | 'deck' | 'custom'

type Axes = {
  logic: LogicId
  density: DensityId
  theme: ThemeId
}

const presets: Record<Exclude<PresetId, 'custom'>, Axes> = {
  faithful: { logic: 'none', density: 'comfortable', theme: 'editorial-light' },
  reader: { logic: 'narrative', density: 'comfortable', theme: 'editorial-light' },
  brief: { logic: 'result-first', density: 'compact', theme: 'dense-brief' },
  deck: { logic: 'result-first', density: 'per-screen', theme: 'dark-studio' },
}

export function App() {
  const [markdown, setMarkdown] = useState(readme)
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => detectDefaultUiLanguage())
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>('auto')
  const [includeSourceMetadata, setIncludeSourceMetadata] = useState(true)
  const [preset, setPreset] = useState<PresetId>('faithful')
  const [axes, setAxes] = useState<Axes>(presets.faithful)
  const t = getUiDict(uiLanguage)

  const result = useMemo(
    () => compileMarkdownToHtml(markdown, {
      ...axes,
      contentLanguage,
      includeSourceMetadata,
    }),
    [axes, contentLanguage, includeSourceMetadata, markdown],
  )

  function applyPreset(nextPreset: Exclude<PresetId, 'custom'>) {
    setPreset(nextPreset)
    setAxes(presets[nextPreset])
  }

  function updateAxis<K extends keyof Axes>(key: K, value: Axes[K]) {
    setPreset('custom')
    setAxes((current) => ({ ...current, [key]: value }))
  }

  async function copyHtml() {
    await navigator.clipboard?.writeText(result.html)
  }

  function downloadHtml() {
    const url = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'md2html.html'
    anchor.click()
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
        <button type="button" onClick={() => setAxes((current) => ({ ...current }))}>{t.relayout}</button>
        <label>{t.uiLanguage}<select aria-label={t.uiLanguage} value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UiLanguage)}>
          <option value="zh">中</option><option value="en">EN</option>
        </select></label>
        <label>{t.contentLanguage}<select aria-label={t.contentLanguage} value={contentLanguage} onChange={(event) => setContentLanguage(event.target.value as ContentLanguage)}>
          <option value="auto">{t.auto}</option><option value="zh">{t.zh}</option><option value="en">{t.en}</option>
        </select></label>
        <label className="checkbox"><input type="checkbox" checked={includeSourceMetadata} onChange={(event) => setIncludeSourceMetadata(event.target.checked)} />{t.metadata}</label>
        <button type="button" onClick={() => void copyHtml()}>{t.copy}</button>
        <button type="button" onClick={downloadHtml}>{t.download}</button>
      </header>
      <section className="workspace">
        <textarea aria-label="Markdown source" value={markdown} onChange={(event) => setMarkdown(event.target.value)} />
        <iframe title="HTML projection preview" sandbox="allow-scripts" srcDoc={result.html} />
      </section>
    </main>
  )
}

const appCss = `
html,body,#root{height:100%;margin:0}.app-shell{display:grid;grid-template-rows:auto 1fr;height:100vh;font-family:system-ui,sans-serif}.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #ddd;padding:10px 12px;background:#fff}.toolbar label{display:flex;gap:4px;align-items:center;font-size:12px;color:#344054}.toolbar input[type=file]{max-width:120px}.toolbar select,.toolbar button{font:inherit}.checkbox{white-space:nowrap}.workspace{display:grid;grid-template-columns:1fr 1fr;min-height:0}.workspace textarea{border:0;border-right:1px solid #ddd;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:16px;resize:none}.workspace iframe{border:0;width:100%;height:100%}
`
