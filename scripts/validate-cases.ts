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
import { openDb } from '../src/core/sqlite.ts'
import type { Case } from '../src/core/types.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const casesDir = join(root, 'public', 'cases')

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

const MANIFEST_FILE = 'index.json'

/**
 * index.json перечисляет id для списка дел — статический хостинг не отдаёт
 * листинг директории, так что список нельзя получить иначе. Он должен точно
 * совпадать с тем, что реально лежит в public/cases: иначе список дел либо
 * покажет несуществующее дело, либо молча спрячет существующее.
 */
function validateManifest(caseFiles: string[]): string[] {
  const path = join(casesDir, MANIFEST_FILE)

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return [`не является корректным JSON — ${(error as Error).message}`]
  }
  if (!Array.isArray(raw) || !raw.every((id) => typeof id === 'string')) {
    return ['ожидался массив строк']
  }

  const listed = new Set(raw)
  const onDisk = new Set(caseFiles.map((f) => f.replace(/\.json$/, '')))
  const missing = [...onDisk].filter((id) => !listed.has(id))
  const dangling = [...listed].filter((id) => !onDisk.has(id))

  const problems: string[] = []
  if (missing.length > 0) problems.push(`дела есть на диске, но не в манифесте: ${missing.join(', ')}`)
  if (dangling.length > 0) problems.push(`манифест ссылается на несуществующие дела: ${dangling.join(', ')}`)
  return problems
}

const SQL = await initSqlJs({
  locateFile: (file: string) => join(root, 'node_modules', 'sql.js', 'dist', file),
})

const files = readdirSync(casesDir)
  .filter((f) => f.endsWith('.json') && f !== MANIFEST_FILE)
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

const manifestProblems = validateManifest(files)
if (manifestProblems.length === 0) {
  console.log(`  ok  ${MANIFEST_FILE}`)
} else {
  failed += 1
  console.error(`FAIL  ${MANIFEST_FILE}`)
  for (const problem of manifestProblems) console.error(`      ${problem}`)
}

const total = files.length + 1 // + index.json
console.log(`\n${total - failed} из ${total} дел/файлов прошли проверку`)
process.exit(failed === 0 ? 0 : 1)
