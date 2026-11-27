/**
 * Голая обвязка над sql.js без знания о воркерах и React. Использует и браузерный
 * воркер, и CLI-валидатор, и тесты — три места, где иначе пришлось бы держать
 * одну и ту же пару функций в синхронизации руками.
 */
import type { Database, SqlJsStatic } from 'sql.js'

export type SqlValue = number | string | Uint8Array | null

export type SqlEffect = { kind: 'changed'; rows: number } | { kind: 'begin' | 'commit' | 'rollback' }

export type SqlResult = {
  columns: string[]
  rows: SqlValue[][]
  effect?: SqlEffect
}

export type RunOutcome = { ok: true; result: SqlResult } | { ok: false; error: string }

export type SqlPolicy = 'read' | 'write'

export const READ_ONLY_QUERY_ERROR = 'В этом шаге можно выполнить один запрос SELECT, в том числе с WITH.'
export const WRITE_QUERY_ERROR = 'Выполните одну команду: SELECT, INSERT, UPDATE, DELETE, BEGIN, COMMIT или ROLLBACK.'

// SQLite пропускает разделители, пробелы и комментарии по краям инструкции.
const LEADING_SQL_TRIVIA = /^(?:[ \t\n\v\f\r;\uFEFF]|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))*/

export function execReadOnly(db: Database, sql: string): SqlResult {
  const query = sql.replace(LEADING_SQL_TRIVIA, '')
  if (!/^(?:SELECT|WITH)\b/i.test(query)) throw new Error(READ_ONLY_QUERY_ERROR)

  const wasReadOnly = db.exec('PRAGMA query_only')[0]?.values[0]?.[0] === 1
  if (!wasReadOnly) db.run('PRAGMA query_only = ON')
  try {
    return execSingle(db, query, READ_ONLY_QUERY_ERROR)
  } finally {
    if (!wasReadOnly) db.run('PRAGMA query_only = OFF')
  }
}

export function execSql(db: Database, sql: string, policy: SqlPolicy): SqlResult {
  if (policy === 'read') return execReadOnly(db, sql)

  const query = sql.replace(LEADING_SQL_TRIVIA, '')
  const command = query.match(/^[A-Za-z]+/)?.[0].toLowerCase()
  if (command === 'select' || command === 'with') return execReadOnly(db, query)

  switch (command) {
    case 'insert':
    case 'update':
    case 'delete': {
      const result = execSingle(db, query, WRITE_QUERY_ERROR)
      return { ...result, effect: { kind: 'changed', rows: db.getRowsModified() } }
    }
    case 'begin':
    case 'commit':
    case 'rollback':
      return { ...execSingle(db, query, WRITE_QUERY_ERROR), effect: { kind: command } }
    default:
      throw new Error(WRITE_QUERY_ERROR)
  }
}

function execSingle(db: Database, query: string, multipleStatementsError: string): SqlResult {
  const statement = db.prepare(query)
  try {
    const tail = query.slice(statement.getSQL().length)
    if (tail.replace(LEADING_SQL_TRIVIA, '') !== '') throw new Error(multipleStatementsError)

    const rows: SqlValue[][] = []
    while (statement.step()) rows.push(statement.get())
    return { columns: rows.length ? statement.getColumnNames() : [], rows }
  } finally {
    statement.free()
  }
}

/** Собирает базу из `schema` + `seed`. */
export function openDb(SQL: SqlJsStatic, schema: string, seed: string): Database {
  const db = new SQL.Database()
  try {
    db.run(schema)
    if (seed.trim() !== '') db.run(seed)
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
