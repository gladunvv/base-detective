/**
 * Прогоняет каждое дело из public/cases через Zod и через SQLite:
 * схема и seed должны выполняться, эталон каждого шага — возвращать результат.
 * Запуск: npm run validate:cases
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { parseCase } from '../src/core/caseLoader.ts'
import { openDb } from '../src/core/sqlite.ts'
import type { Case } from '../src/core/types.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const casesDir = join(root, 'public', 'cases')
const publicDir = join(root, 'public')

/** Ссылка на картинку — путь под public/; нерабочий путь был бы виден только вручную в браузере. */
function checkImages(kase: Case): string[] {
  const problems: string[] = []
  const paths = [kase.cover_image, kase.epilogue_image, ...kase.steps.map((s) => s.image)].filter(
    (p): p is string => p !== undefined,
  )
  for (const p of paths) {
    if (!existsSync(join(publicDir, p))) problems.push(`картинка не найдена: ${p}`)
  }
  return problems
}

const CHEATSHEET_FILE = join(root, 'public', 'cheatsheet.json')

/** Справочник конструкций: id → название. Шаги ссылаются на него через `teaches`. */
function readCheatsheet(): Map<string, string> {
  const raw: unknown = JSON.parse(readFileSync(CHEATSHEET_FILE, 'utf8'))
  if (!Array.isArray(raw)) throw new Error('cheatsheet.json: ожидался массив записей')
  const byId = new Map<string, string>()
  for (const entry of raw as { id?: unknown; title?: unknown }[]) {
    if (typeof entry.id !== 'string' || typeof entry.title !== 'string') {
      throw new Error('cheatsheet.json: у записи должны быть строковые id и title')
    }
    if (byId.has(entry.id)) throw new Error(`cheatsheet.json: id "${entry.id}" встречается дважды`)
    byId.set(entry.id, entry.title)
  }
  return byId
}

/**
 * Шаг ссылается на конструкцию по имени, а не по номеру дела, — перенумерация
 * такую связь не ломает. Но опечатку в id иначе не поймать: шпаргалка молча
 * не откроет тему, и узнаем мы об этом от игрока.
 */
function checkTeaches(kase: Case, known: Map<string, string>): string[] {
  const problems: string[] = []
  for (const step of kase.steps) {
    for (const id of step.teaches) {
      if (!known.has(id)) problems.push(`шаг ${step.id}: в шпаргалке нет конструкции "${id}"`)
    }
  }
  return problems
}

const cheatsheet = readCheatsheet()

/** Возвращает список проблем; пустой список — дело в порядке. */
function checkSolutions(db: Database, kase: Case, label: string): string[] {
  const problems: string[] = []
  for (const step of kase.steps) {
    try {
      const result = db.exec(step.solution)
      const rows = result[0]?.values.length ?? 0
      if (step.check.mode === 'resultset' && rows === 0 && !step.check.expect_empty) {
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
  problems.push(...checkImages(kase))
  problems.push(...checkTeaches(kase, cheatsheet))
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

// Обратная сторона: тема, которую никто не преподаёт, — дыра в курсе,
// и заметить её иначе можно только вручную по карте.
const taught = new Set<string>()
for (const file of files) {
  try {
    const kase = parseCase(JSON.parse(readFileSync(join(casesDir, file), 'utf8')), file)
    for (const step of kase.steps) for (const id of step.teaches) taught.add(id)
  } catch {
    // дело уже отчиталось о своей поломке выше
  }
}
const orphans = [...cheatsheet.keys()].filter((id) => !taught.has(id))
if (orphans.length > 0) {
  console.log(`  ·   в шпаргалке есть, но пока нигде не преподаётся: ${orphans.join(', ')}`)
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
