/**
 * Голая обвязка над sql.js без знания о воркерах и React. Использует и браузерный
 * воркер, и CLI-валидатор, и тесты — три места, где иначе пришлось бы держать
 * одну и ту же пару функций в синхронизации руками.
 */
import type { Database, SqlJsStatic } from 'sql.js'

export type SqlValue = number | string | Uint8Array | null

export type SqlResult = {
  columns: string[]
  rows: SqlValue[][]
}

export type RunOutcome = { ok: true; result: SqlResult } | { ok: false; error: string }

/** Собирает базу из `schema` + `seed`. */
export function openDb(SQL: SqlJsStatic, schema: string, seed: string): Database {
  const db = new SQL.Database()
  db.run(schema)
  if (seed.trim() !== '') db.run(seed)
  return db
}

/** Запрос может состоять из нескольких инструкций — возвращает результат последней. */
export function execLast(db: Database, sql: string): SqlResult {
  const results = db.exec(sql)
  const last = results.at(-1)
  return last ? { columns: last.columns, rows: last.values } : { columns: [], rows: [] }
}
