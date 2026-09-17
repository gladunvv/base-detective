import { sql, SQLite } from '@codemirror/lang-sql'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef } from 'react'
import type { SchemaInfo } from './schemaInfo.ts'

type TerminalProps = {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  schema: SchemaInfo
  disabled: boolean
}

/**
 * Тонкая обёртка над CodeMirror 6: react-биндинги в задаче не просили,
 * а сам компонент — держатель `EditorView`, не более полусотни строк.
 */
export function Terminal({ value, onChange, onRun, schema, disabled }: TerminalProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Замыкания в extensions ставятся один раз при монтировании — держим свежие
  // колбэки в ref (обновляется эффектом после каждого рендера, не во время него),
  // чтобы не пересоздавать редактор из-за смены пропсов.
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  useEffect(() => {
    onChangeRef.current = onChange
    onRunRef.current = onRun
  })

  useEffect(() => {
    if (!hostRef.current) return

    const view = new EditorView({
      doc: value,
      parent: hostRef.current,
      extensions: [
        basicSetup,
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onRunRef.current()
              return true
            },
          },
        ]),
        sql({ dialect: SQLite, schema }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        EditorView.theme({
          '&': { fontSize: '14px', height: '100%' },
          '.cm-content': { fontFamily: 'var(--font-mono)' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    })
    viewRef.current = view
    return () => view.destroy()
    // Схема меняется только при смене дела — целого компонента, так что
    // пересоздавать редактор из-за неё не нужно.
  }, [])

  // Внешнее изменение value (переход к новому шагу) синхронизируется в редактор.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={hostRef}
        aria-disabled={disabled}
        className="h-40 rounded border border-glow/30 bg-screen text-glow aria-disabled:opacity-50"
      />
      <button
        type="button"
        onClick={onRun}
        disabled={disabled}
        className="self-start rounded bg-glow px-3 py-1 font-sans text-sm font-semibold text-ink disabled:opacity-50"
      >
        Выполнить (Ctrl+Enter)
      </button>
    </div>
  )
}
