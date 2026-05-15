import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view'
import { useEffect, useRef } from 'react'

export type SourceSelection = {
  from: number
  to: number
}

export type MarkdownEditorProps = {
  value: string
  onChange(value: string): void
  selection?: SourceSelection
  onReady?(view: EditorView): void
}

export function MarkdownEditor({ value, onChange, selection, onReady }: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          markdown(),
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Markdown source' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '14px' },
            '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
            '.cm-content': { padding: '16px 0', minHeight: '100%' },
            '.cm-line': { padding: '0 16px' },
            '.cm-gutters': { background: '#f9fafb', color: '#98a2b3', borderRight: '1px solid #eaecf0' },
            '.cm-activeLine': { background: '#f2f4f7' },
            '.cm-activeLineGutter': { background: '#eef4ff', color: '#3538cd' },
            '.cm-selectionBackground': { background: '#d1e9ff !important' },
          }),
        ],
      }),
    })

    viewRef.current = view
    onReady?.(view)
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !selection) return
    const from = Math.max(0, Math.min(selection.from, view.state.doc.length))
    const to = Math.max(from, Math.min(selection.to, view.state.doc.length))
    view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true })
    view.focus()
  }, [selection?.from, selection?.to])

  return <div ref={hostRef} className="markdown-editor" />
}
