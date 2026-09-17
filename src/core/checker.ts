/**
 * Проверка ответа игрока. Ноль React, ноль знания о воркерах — только SQL-текст
 * и функция, которая умеет выполнить запрос на свежей базе и вернуть результат.
 * Игрок и эталон всегда прогоняются на СВОЕЙ копии базы: делить одно соединение
 * между ними нельзя — для rowcount и schema это дало бы неверную картину
 * (второй запрос видел бы изменения первого), а для shadow смысл в том, чтобы
 * прогнать обоих ровно на одинаковых стартовых данных.
 */
import type { RunOutcome, SqlResult, SqlValue } from './sqlite.ts'
import type { Check, Step } from './types.ts'

export type CheckVerdict =
  | { verdict: 'accepted'; note?: string }
  | { verdict: 'rejected'; reason: string }
  | { verdict: 'error'; error: string }

/** Выполняет `sql` на свежей базе (schema + seed) и возвращает результат или ошибку. */
export type FreshExecutor = (sql: string) => Promise<RunOutcome>

export type CheckParams = {
  step: Step
  /** Запрос, который написал игрок. */
  playerSql: string
  runOnMain: FreshExecutor
  /** Обязателен, если `step.check.shadow`. */
  runOnShadow?: FreshExecutor
}

export async function checkAnswer(params: CheckParams): Promise<CheckVerdict> {
  const { step, playerSql, runOnMain, runOnShadow } = params
  const { check } = step

  const main = await runBoth(check, playerSql, step.solution, runOnMain)
  if (main.verdict !== 'accepted') return main

  if (check.shadow) {
    if (!runOnShadow) {
      throw new TypeError('check.shadow требует runOnShadow')
    }
    const shadow = await runBoth(check, playerSql, step.solution, runOnShadow)
    if (shadow.verdict === 'error') return shadow
    if (shadow.verdict === 'rejected') {
      return {
        verdict: 'rejected',
        reason: 'на контрольных данных результат другой — похоже на ответ, подогнанный под пример',
      }
    }
  }

  const note = checkKeywordHints(playerSql, check.require, check.forbid)
  return note ? { verdict: 'accepted', note } : { verdict: 'accepted' }
}

/** Прогоняет игрока и эталон на одной и той же (по составу) свежей базе и сравнивает. */
async function runBoth(
  check: Check,
  playerSql: string,
  solutionSql: string,
  run: FreshExecutor,
): Promise<CheckVerdict> {
  const player = await run(buildQuery(check, playerSql))
  if (!player.ok) return { verdict: 'error', error: player.error }

  const solution = await run(buildQuery(check, solutionSql))
  if (!solution.ok) {
    return { verdict: 'error', error: `внутренняя ошибка дела: эталон не выполнился (${solution.error})` }
  }

  const comparison = compareByMode(check, solution.result, player.result)
  return comparison.ok ? { verdict: 'accepted' } : { verdict: 'rejected', reason: comparison.reason }
}

/** Достраивает запрос так, чтобы результат содержал то, что нужно сравнить для данного режима. */
function buildQuery(check: Check, sql: string): string {
  switch (check.mode) {
    case 'resultset':
      return sql
    case 'rowcount':
      return `${sql};\nSELECT changes() AS n`
    case 'schema': {
      if (check.table === null) {
        throw new TypeError('check.table обязателен при mode "schema"')
      }
      return `${sql};\nPRAGMA table_info(${check.table})`
    }
  }
}

type Comparison = { ok: true } | { ok: false; reason: string }

function compareByMode(check: Check, expected: SqlResult, actual: SqlResult): Comparison {
  switch (check.mode) {
    case 'resultset':
      return compareResultSets(expected, actual, check.ordered)
        ? { ok: true }
        : { ok: false, reason: 'результат запроса не совпадает с эталоном' }
    case 'rowcount':
      return compareRowCounts(expected, actual)
    case 'schema':
      return compareSchemas(expected, actual)
  }
}

// --- resultset ------------------------------------------------------------

/**
 * Сравнение результата с нормализацией: пробелы и регистр в именах колонок роли
 * не играют, `NULL` и пустая строка считаются одним и тем же значением. Порядок
 * строк учитывается только при `ordered: true`; порядок колонок — всегда,
 * колонки в SQL — позиционные, а не именованные.
 */
export function compareResultSets(expected: SqlResult, actual: SqlResult, ordered: boolean): boolean {
  if (!columnsEqual(expected.columns, actual.columns)) return false
  if (expected.rows.length !== actual.rows.length) return false

  if (ordered) {
    return expected.rows.every((row, i) => rowEquals(row, actual.rows[i]))
  }
  return multisetEquals(expected.rows, actual.rows)
}

function columnsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((name, i) => normalizeColumnName(name) === normalizeColumnName(b[i]))
}

function normalizeColumnName(name: string): string {
  return name.trim().toLowerCase()
}

function rowEquals(a: SqlValue[], b: SqlValue[]): boolean {
  return a.length === b.length && a.every((value, i) => valuesEqual(value, b[i]))
}

function valuesEqual(a: SqlValue, b: SqlValue): boolean {
  // NULL и пустая строка — частая путаница новичков между "нет значения" и "пустая строка".
  const normalize = (v: SqlValue): SqlValue => (v === null ? '' : v)
  const na = normalize(a)
  const nb = normalize(b)
  if (na instanceof Uint8Array || nb instanceof Uint8Array) {
    return na instanceof Uint8Array && nb instanceof Uint8Array && bytesEqual(na, nb)
  }
  return na === nb
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}

function multisetEquals(expected: SqlValue[][], actual: SqlValue[][]): boolean {
  const key = (row: SqlValue[]): string =>
    JSON.stringify(row.map((v) => (v === null ? '' : v instanceof Uint8Array ? Array.from(v) : v)))

  const counts = new Map<string, number>()
  for (const row of expected) {
    const k = key(row)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  for (const row of actual) {
    const k = key(row)
    const left = counts.get(k)
    if (!left) return false
    counts.set(k, left - 1)
  }
  return Array.from(counts.values()).every((n) => n === 0)
}

// --- rowcount ---------------------------------------------------------------

function compareRowCounts(expected: SqlResult, actual: SqlResult): Comparison {
  const expectedN = Number(expected.rows[0]?.[0] ?? 0)
  const actualN = Number(actual.rows[0]?.[0] ?? 0)
  return expectedN === actualN
    ? { ok: true }
    : { ok: false, reason: `затронуто строк: ожидалось ${expectedN}, получено ${actualN}` }
}

// --- schema -------------------------------------------------------------

type ColumnInfo = {
  name: string
  type: string
  notnull: boolean
  pk: number
}

/** Разбирает вывод `PRAGMA table_info(...)` — колонки идут в фиксированном порядке. */
function parseTableInfo(result: SqlResult): ColumnInfo[] {
  const idx = (name: string): number => result.columns.indexOf(name)
  const nameIdx = idx('name')
  const typeIdx = idx('type')
  const notnullIdx = idx('notnull')
  const pkIdx = idx('pk')

  return result.rows.map((row) => ({
    name: String(row[nameIdx]),
    type: String(row[typeIdx]),
    notnull: Number(row[notnullIdx]) !== 0,
    pk: Number(row[pkIdx]),
  }))
}

/** Сверка имён, типов, `pk`, `notnull`. Порядок столбцов и регистр типов роли не играют. */
function compareSchemas(expected: SqlResult, actual: SqlResult): Comparison {
  const expectedColumns = parseTableInfo(expected)
  const actualByName = new Map(parseTableInfo(actual).map((c) => [c.name, c]))

  if (actualByName.size !== expectedColumns.length) {
    return { ok: false, reason: `ожидалось колонок: ${expectedColumns.length}, получено: ${actualByName.size}` }
  }

  for (const expectedColumn of expectedColumns) {
    const actualColumn = actualByName.get(expectedColumn.name)
    if (!actualColumn) {
      return { ok: false, reason: `нет колонки "${expectedColumn.name}"` }
    }
    if (actualColumn.type.toLowerCase() !== expectedColumn.type.toLowerCase()) {
      return {
        ok: false,
        reason: `у колонки "${expectedColumn.name}" тип "${actualColumn.type}", ожидался "${expectedColumn.type}"`,
      }
    }
    if (actualColumn.notnull !== expectedColumn.notnull) {
      return { ok: false, reason: `у колонки "${expectedColumn.name}" не совпадает NOT NULL` }
    }
    if (actualColumn.pk !== expectedColumn.pk) {
      return { ok: false, reason: `у колонки "${expectedColumn.name}" не совпадает PRIMARY KEY` }
    }
  }

  return { ok: true }
}

// --- require / forbid -------------------------------------------------------

/**
 * Мягкая подсказка по формулировке, а не блокирующая ошибка: решение уже принято
 * выше, задача этой функции — заметить, что оно написано не той конструкцией,
 * под которую задуман шаг.
 */
function checkKeywordHints(sql: string, require: string[], forbid: string[]): string | undefined {
  const normalized = sql.toUpperCase()
  const missing = require.filter((kw) => !normalized.includes(kw.toUpperCase()))
  const used = forbid.filter((kw) => normalized.includes(kw.toUpperCase()))

  if (missing.length === 0 && used.length === 0) return undefined

  const parts: string[] = []
  if (missing.length > 0) parts.push(`не найдено: ${missing.join(', ')}`)
  if (used.length > 0) parts.push(`использовано лишнее: ${used.join(', ')}`)
  return `Решение засчитано, но задумано под другую конструкцию (${parts.join('; ')}).`
}
