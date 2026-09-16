/**
 * Прогоняет каждое дело из public/cases через Zod и через SQLite:
 * схема и seed должны выполняться, эталон каждого шага — возвращать результат.
 * Запуск: npm run validate:cases
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { parseCase } from '../src/core/caseLoader.ts'
import type { Case } from '../src/core/types.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const casesDir = join(root, 'public', 'cases')

function openDb(SQL: SqlJsStatic, schema: string, seed: string): Database {
  const db = new SQL.Database()
  db.run(schema)
  if (seed.trim() !== '') db.run(seed)
  return db
}

/** Возвращает список проблем; пустой список — дело в порядке. */
function checkSolutions(db: Database, kase: Case, label: string): string[] {
  const problems: string[] = []
  for (const step of kase.steps) {
    try {
      const result = db.exec(step.solution)
      const rows = result[0]?.values.length ?? 0
      if (step.check.mode === 'resultset' && rows === 0) {
        problems.push(`шаг ${step.id}: эталон на ${label} вернул пустой результат`)
      }
    } catch (error) {
      problems.push(`шаг ${step.id}: эталон на ${label} упал — ${(error as Error).message}`)
    }
  }
  return problems
}

function validate(SQL: SqlJsStatic, file: string): string[] {
  const path = join(casesDir, file)

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return [`не является корректным JSON — ${(error as Error).message}`]
  }

  let kase: Case
  try {
    kase = parseCase(raw, file)
  } catch (error) {
    return [(error as Error).message]
  }

  let db: Database
  try {
    db = openDb(SQL, kase.db.schema, kase.db.seed)
  } catch (error) {
    return [`schema или seed не выполняются — ${(error as Error).message}`]
  }

  const problems = checkSolutions(db, kase, 'seed')
  db.close()

  if (kase.db.shadow_seed !== undefined) {
    let shadowDb: Database
    try {
      shadowDb = openDb(SQL, kase.db.schema, kase.db.shadow_seed)
    } catch (error) {
      problems.push(`shadow_seed не выполняется — ${(error as Error).message}`)
      return problems
    }
    problems.push(...checkSolutions(shadowDb, kase, 'shadow_seed'))
    shadowDb.close()
  }

  return problems
}

const SQL = await initSqlJs({
  locateFile: (file: string) => join(root, 'node_modules', 'sql.js', 'dist', file),
})

const files = readdirSync(casesDir)
  .filter((f) => f.endsWith('.json'))
  .sort()

if (files.length === 0) {
  console.error(`Нет ни одного дела в ${casesDir}`)
  process.exit(1)
}

let failed = 0
for (const file of files) {
  const problems = validate(SQL, file)
  if (problems.length === 0) {
    console.log(`  ok  ${file}`)
  } else {
    failed += 1
    console.error(`FAIL  ${file}`)
    for (const problem of problems) console.error(`      ${problem}`)
  }
}

console.log(`\n${files.length - failed} из ${files.length} дел прошли проверку`)
process.exit(failed === 0 ? 0 : 1)
