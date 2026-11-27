import { CheatSheet } from './CheatSheet.tsx'
import { ResultTable } from './ResultTable.tsx'
import { SchemaPanel } from './SchemaPanel.tsx'
import { Terminal } from './Terminal.tsx'
import type { SqlEffect } from '../core/sqlite.ts'
import type { useCaseEngine } from './useCaseEngine.ts'

function describeEffect(effect: SqlEffect): string {
  switch (effect.kind) {
    case 'changed': return `Затронуто строк: ${effect.rows}.`
    case 'begin': return 'Транзакция открыта.'
    case 'commit': return 'Изменения сохранены в учебной базе.'
    case 'rollback': return 'Изменения в транзакции отменены.'
  }
}

/** Правая колонка — машина: ввод запроса и результат, ничего третьего. */
export function Monitor({ engine, learned }: { engine: ReturnType<typeof useCaseEngine>; learned: string[] }) {
  const { sql, setSql, run, submit, busy, rejected, accepted, outcome, schema, resetDatabase, step } = engine

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto bg-ink p-6">
      <div className="rounded border border-folder/40 bg-screen/40 p-3">
        <Terminal
          value={sql}
          onChange={setSql}
          onRun={() => void run()}
          onSubmit={() => void submit()}
          canSubmit={!accepted && sql.trim() !== ''}
          schema={schema}
          disabled={busy || rejected || !step}
        />
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <SchemaPanel schema={schema} />
        <CheatSheet learned={learned} />
        <button
          type="button"
          onClick={() => void resetDatabase()}
          disabled={busy}
          className="self-start rounded border border-folder/60 px-2 py-1 font-sans text-sm text-folder disabled:opacity-50"
        >
          Вернуть данные как были
        </button>
      </div>

      {outcome?.kind === 'error' && (
        <p className="rounded border border-glow/30 bg-screen p-3 font-mono text-sm text-glow">{outcome.message}</p>
      )}
      {outcome?.kind === 'empty' && (
        <p className="rounded border border-glow/30 bg-screen p-3 font-mono text-sm text-glow">
          {/* Там, где пустота и есть ответ, догадка про лишнее условие сбивала бы с толку. */}
          {step?.check.expect_empty
            ? 'Запрос отработал, подходящих строк в базе нет.'
            : 'Запрос отработал, база ничего не нашла. Скорее всего, лишнее условие.'}
        </p>
      )}
      {outcome?.kind === 'result' && (
        <>
          {outcome.result.effect && (
            <p role="status" className="rounded border border-glow/30 bg-screen p-3 font-mono text-sm text-glow">
              {describeEffect(outcome.result.effect)}
            </p>
          )}
          {outcome.result.rows.length > 0 && <ResultTable result={outcome.result} />}
        </>
      )}
    </div>
  )
}
