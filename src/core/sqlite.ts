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

export type SqlPolicy = 'read' | 'write'

export const READ_ONLY_QUERY_ERROR = 'В этом шаге можно выполнить один запрос SELECT, в том числе с WITH.'

// SQLite пропускает разделители, пробелы и комментарии по краям инструкции.
const LEADING_SQL_TRIVIA = /^(?:[ \t\n\v\f\r;\uFEFF]|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))*/

export function execReadOnly(db: Database, sql: string): SqlResult {
  const query = sql.replace(LEADING_SQL_TRIVIA, '')
  if (!/^(?:SELECT|WITH)\b/i.test(query)) throw new Error(READ_ONLY_QUERY_ERROR)

  const wasReadOnly = db.exec('PRAGMA query_only')[0]?.values[0]?.[0] === 1
  if (!wasReadOnly) db.run('PRAGMA query_only = ON')
  try {
    const statement = db.prepare(query)
    try {
      const tail = query.slice(statement.getSQL().length)
      if (tail.replace(LEADING_SQL_TRIVIA, '') !== '') throw new Error(READ_ONLY_QUERY_ERROR)

      const rows: SqlValue[][] = []
      while (statement.step()) rows.push(statement.get())
      return { columns: rows.length ? statement.getColumnNames() : [], rows }
    } finally {
      statement.free()
    }
  } finally {
    if (!wasReadOnly) db.run('PRAGMA query_only = OFF')
  }
}

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
