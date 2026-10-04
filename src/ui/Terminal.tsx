import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { sql, SQLite } from '@codemirror/lang-sql'
import { Compartment, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { basicSetup } from 'codemirror'
import { useEffect, useRef, useState } from 'react'
import type { SchemaInfo } from './schemaInfo.ts'

/** На macOS сочетание пишется через ⌘, на остальных — Ctrl: подпись должна не врать. */
const RUN_SHORTCUT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '\u2318\u21a9'
    : 'Ctrl+Enter'

/**
 * Стандартная светлая подсветка CodeMirror (фиолетовые ключевые слова) на тёмном
 * мониторе не читается — цвета берём из палитры: ключевые слова светлее и жирнее
 * основного янтарного текста, строки и числа — «папочный» беж, комментарии тише.
 */
const sqlHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.typeName, tags.bool, tags.null], color: 'var(--color-paper)', fontWeight: 'bold' },
  { tag: [tags.string, tags.number], color: 'var(--color-folder)' },
  { tag: tags.comment, color: 'var(--color-folder)', opacity: '0.85', fontStyle: 'italic' },
])

type TerminalProps = {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  onSubmit: () => void
  canSubmit: boolean
  schema: SchemaInfo
  disabled: boolean
}

/**
 * Тонкая обёртка над CodeMirror 6: react-биндинги в задаче не просили,
 * а сам компонент — держатель `EditorView`, не более полусотни строк.
 */
export function Terminal({ value, onChange, onRun, onSubmit, canSubmit, schema, disabled }: TerminalProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Замыкания в extensions ставятся один раз при монтировании — держим свежие
  // колбэки в ref (обновляется эффектом после каждого рендера, не во время него),
  // чтобы не пересоздавать редактор из-за смены пропсов.
  const [editable] = useState(() => new Compartment())
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
        EditorView.lineWrapping,
        syntaxHighlighting(sqlHighlight),
        editable.of(EditorView.editable.of(!disabled)),
        // Prec.highest обязателен: defaultKeymap внутри basicSetup сам держит
        // Mod-Enter (вставка пустой строки) и без повышения приоритета
        // перехватывает выполнение запроса.
        // Два биндинга, потому что Mod — это Cmd на macOS и Ctrl на остальных,
        // а Ctrl+Enter должен работать везде: игрок приходит с чужой шпаргалкой.
        Prec.highest(
          keymap.of(
            (['Mod-Enter', 'Ctrl-Enter'] as const).map((key) => ({
              key,
              run: () => {
                onRunRef.current()
                return true
              },
            })),
          ),
        ),
        sql({ dialect: SQLite, schema, upperCaseKeywords: true }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        // Без имени скринридер объявляет поле просто «текстовое поле» (axe:
        // aria-input-field-name). CodeMirror ставит role=textbox сам, имя — за нами.
        EditorView.contentAttributes.of({ 'aria-label': 'Поле ввода SQL-запроса' }),
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

  // Заблокированный редактор реально не принимает ввод, а не только выглядит серым.
  useEffect(() => {
    viewRef.current?.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!disabled)) })
  }, [disabled, editable])

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
        className="h-64 min-h-32 resize-y overflow-hidden rounded border border-glow/30 bg-screen text-glow aria-disabled:opacity-50"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={disabled}
          className="rounded border border-glow px-3 py-1 font-sans text-sm font-semibold text-glow disabled:opacity-50"
        >
          Выполнить ({RUN_SHORTCUT})
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !canSubmit}
          className="rounded bg-glow px-3 py-1 font-sans text-sm font-semibold text-ink disabled:opacity-50"
        >
          Отправить ответ
        </button>
      </div>
    </div>
  )
}
