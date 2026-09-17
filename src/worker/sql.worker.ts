import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { SqlResult, WorkerRequest, WorkerResponse } from '../core/sqlRunner.ts'

const sqlJs = initSqlJs({ locateFile: () => wasmUrl })

let db: Database | null = null

function open(schema: string, seed: string, SQL: Awaited<typeof sqlJs>): Database {
  const fresh = new SQL.Database()
  fresh.run(schema)
  if (seed.trim() !== '') fresh.run(seed)
  return fresh
}

/** Запрос игрока может содержать несколько инструкций: показываем результат последней. */
function lastResult(sql: string, database: Database): SqlResult {
  const results = database.exec(sql)
  const last = results.at(-1)
  return last ? { columns: last.columns, rows: last.values } : { columns: [], rows: [] }
}

async function handle(request: WorkerRequest): Promise<SqlResult> {
  const SQL = await sqlJs

  if (request.type === 'init') {
    db?.close()
    db = open(request.schema, request.seed, SQL)
    return { columns: [], rows: [] }
  }

  if (!db) throw new Error('База не инициализирована')
  return lastResult(request.sql, db)
}

/**
 * В tsconfig приложения подключён lib DOM, а он типизирует `self` как Window и не объявляет
 * DedicatedWorkerGlobalScope. Подключить рядом lib WebWorker нельзя — объявления конфликтуют,
 * поэтому описываем ровно те два члена scope, которыми пользуемся.
 */
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse) => void
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    const result = await handle(request)
    ctx.postMessage({ id: request.id, ok: true, result })
  } catch (error) {
    ctx.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
