import { useState } from 'react'
import type { SchemaInfo } from './schemaInfo.ts'

/**
 * «Схема должна быть доступна всегда и в один клик — это не помощь, а нормальный
 * рабочий инструмент» (дизайн-документ, §7). Поэтому не подсказка со счётчиком,
 * а обычный тумблер.
 */
export function SchemaPanel({ schema }: { schema: SchemaInfo }) {
  const [open, setOpen] = useState(false)
  const tables = Object.entries(schema)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="self-start rounded border border-folder/60 px-2 py-1 font-sans text-sm text-folder"
        aria-expanded={open}
      >
        Схема базы
      </button>
      {open && (
        <div className="flex flex-col gap-2 rounded border border-glow/30 bg-screen p-2 font-mono text-xs text-glow">
          {tables.length === 0 && <p>Схема ещё загружается…</p>}
          {tables.map(([table, columns]) => (
            <div key={table}>
              <span className="font-bold">{table}</span>
              <span>({columns.join(', ')})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
