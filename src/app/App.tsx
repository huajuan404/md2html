import { useMemo, useState } from 'react'
import { compileMarkdownToHtml } from '../compiler/compileMarkdown'
import readme from '../../fixtures/inputs/readme.md?raw'

export function App() {
  const [markdown, setMarkdown] = useState(readme)
  const result = useMemo(
    () => compileMarkdownToHtml(markdown, {
      logic: 'none',
      density: 'comfortable',
      theme: 'editorial-light',
      contentLanguage: 'auto',
      includeSourceMetadata: true,
    }),
    [markdown],
  )

  return (
    <main style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #ddd', padding: '10px 16px' }}>
        <strong>md2html</strong> <span style={{ color: '#667085' }}>Faithful preview baseline</span>
      </header>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
        <textarea
          aria-label="Markdown source"
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          style={{ border: 0, borderRight: '1px solid #ddd', font: '14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace', padding: 16, resize: 'none' }}
        />
        <iframe
          title="HTML projection preview"
          sandbox="allow-scripts"
          srcDoc={result.html}
          style={{ border: 0, width: '100%', height: '100%' }}
        />
      </section>
    </main>
  )
}
