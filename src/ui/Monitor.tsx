import { ResultTable } from './ResultTable.tsx'
import { SchemaPanel } from './SchemaPanel.tsx'
import { Terminal } from './Terminal.tsx'
import type { useCaseEngine } from './useCaseEngine.ts'

/** Правая колонка — машина: ввод запроса и результат, ничего третьего. */
export function Monitor({ engine }: { engine: ReturnType<typeof useCaseEngine> }) {
  const { sql, setSql, run, busy, outcome, schema, resetDatabase, step } = engine

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-ink p-6">
      <div className="rounded border border-folder/40 bg-screen/40 p-3">
        <Terminal value={sql} onChange={setSql} onRun={() => void run()} schema={schema} disabled={busy || !step} />
      </div>

      <div className="flex gap-2">
        <SchemaPanel schema={schema} />
        <button
          type="button"
          onClick={() => void resetDatabase()}
          className="self-start rounded border border-folder/60 px-2 py-1 font-sans text-sm text-folder"
        >
          Сбросить базу
        </button>
      </div>

      {outcome?.kind === 'error' && (
        <p className="rounded border border-glow/30 bg-screen p-3 font-mono text-sm text-glow">{outcome.message}</p>
      )}
      {outcome?.kind === 'empty' && (
        <p className="rounded border border-glow/30 bg-screen p-3 font-mono text-sm text-glow">
          Запрос отработал, база ничего не нашла. Скорее всего, лишнее условие.
        </p>
      )}
      {outcome?.kind === 'result' && <ResultTable result={outcome.result} />}
    </div>
  )
}
