import { useState } from 'react'
import type { SqlResult, SqlValue } from '../core/sqlite.ts'

const ROW_HEIGHT = 28
// Совпадает с CSS max-h-80 ниже — контейнер этой высоты и не резинится.
const VIEWPORT_HEIGHT = 320
// Ниже тысячи строк можно рендерить всё разом без заметной просадки — виртуализация
// нужна ровно там, где без неё вкладка начинает тормозить на отрисовке.
const VIRTUALIZE_FROM = 1000
const OVERSCAN = 10

function formatValue(value: SqlValue): string {
  if (value === null) return 'NULL'
  if (value instanceof Uint8Array) return `<${value.length} байт>`
  return String(value)
}

export function ResultTable({ result }: { result: SqlResult }) {
  const [scrollTop, setScrollTop] = useState(0)

  const rowCount = result.rows.length
  const virtualize = rowCount >= VIRTUALIZE_FROM

  const firstVisible = virtualize ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0
  const visibleCount = virtualize ? Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2 : rowCount
  const lastVisible = virtualize ? Math.min(rowCount, firstVisible + visibleCount) : rowCount

  const rows = result.rows.slice(firstVisible, lastVisible)
  const topPad = firstVisible * ROW_HEIGHT
  const bottomPad = (rowCount - lastVisible) * ROW_HEIGHT

  return (
    <div
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="max-h-80 overflow-auto rounded border border-glow/30"
    >
      <table className="w-full border-collapse font-mono text-sm text-glow">
        <thead className="sticky top-0 bg-screen">
          <tr>
            {result.columns.map((column, i) => (
              <th key={i} className="border-b border-glow/30 px-2 py-1 text-left font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topPad > 0 && (
            <tr style={{ height: topPad }} aria-hidden="true">
              <td colSpan={result.columns.length} />
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={firstVisible + i} style={{ height: ROW_HEIGHT }}>
              {row.map((value, j) => (
                <td key={j} className="px-2 py-1 whitespace-nowrap">
                  {formatValue(value)}
                </td>
              ))}
            </tr>
          ))}
          {bottomPad > 0 && (
            <tr style={{ height: bottomPad }} aria-hidden="true">
              <td colSpan={result.columns.length} />
            </tr>
          )}
        </tbody>
      </table>
      <p className="border-t border-glow/30 px-2 py-1 font-mono text-xs text-glow/70">
        {rowCount} {rowCount === 1 ? 'строка' : 'строк'}
      </p>
    </div>
  )
}
