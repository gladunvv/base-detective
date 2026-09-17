import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { checkAnswer, type FreshExecutor } from './checker.ts'
import { execLast, openDb } from './sqlite.ts'
import { parseCase } from './caseLoader.ts'
import type { Case, Check, Step } from './types.ts'

let SQL: SqlJsStatic

beforeAll(async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  SQL = await initSqlJs({ locateFile: (file) => join(root, 'node_modules', 'sql.js', 'dist', file) })
})

/** Executor «как в проде»: свежая база на каждый вызов, никакого общего состояния между ними. */
function executorFor(schema: string, seed: string): FreshExecutor {
  return (sql) =>
    Promise.resolve().then(() => {
      const db = openDb(SQL, schema, seed)
      try {
        return { ok: true as const, result: execLast(db, sql) }
      } catch (error) {
        return { ok: false as const, error: (error as Error).message }
      } finally {
        db.close()
      }
    })
}

const suspectsSchema = `
  CREATE TABLE suspects (id INTEGER PRIMARY KEY, name TEXT NOT NULL, job TEXT NOT NULL);
`
const suspectsSeed = `
  INSERT INTO suspects (id, name, job) VALUES
    (1, 'Анна Верес', 'садовник'),
    (2, 'Борис Клем', 'повар');
`
const shadowSeed = `
  INSERT INTO suspects (id, name, job) VALUES
    (10, 'Илья Сотов', 'кучер'),
    (11, 'Ким Раух', 'повар');
`

function makeStep(overrides: { solution: string; check: Partial<Check> }): Step {
  return {
    id: 's1',
    brief: '',
    theory: '',
    solution: overrides.solution,
    hints: [],
    errors: [],
    outro: '',
    check: {
      mode: 'resultset',
      ordered: false,
      shadow: false,
      require: [],
      forbid: [],
      table: null,
      ...overrides.check,
    },
  }
}

describe('resultset', () => {
  const runOnMain = () => executorFor(suspectsSchema, suspectsSeed)

  it('засчитывает правильный ответ', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: {} })
    const verdict = await checkAnswer({ step, playerSql: 'SELECT name FROM suspects', runOnMain: runOnMain() })
    expect(verdict).toEqual({ verdict: 'accepted' })
  })

  it('не важен порядок строк при ordered: false', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects ORDER BY id', check: { ordered: false } })
    const verdict = await checkAnswer({
      step,
      playerSql: 'SELECT name FROM suspects ORDER BY id DESC',
      runOnMain: runOnMain(),
    })
    expect(verdict.verdict).toBe('accepted')
  })

  it('важен порядок строк при ordered: true', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects ORDER BY id', check: { ordered: true } })
    const verdict = await checkAnswer({
      step,
      playerSql: 'SELECT name FROM suspects ORDER BY id DESC',
      runOnMain: runOnMain(),
    })
    expect(verdict.verdict).toBe('rejected')
  })

  it('не важен регистр имени колонки', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: {} })
    const verdict = await checkAnswer({
      step,
      playerSql: 'SELECT name AS "NAME" FROM suspects',
      runOnMain: runOnMain(),
    })
    expect(verdict.verdict).toBe('accepted')
  })

  it('NULL и пустая строка считаются одним значением', async () => {
    const step = makeStep({ solution: "SELECT NULL AS job", check: {} })
    const verdict = await checkAnswer({ step, playerSql: "SELECT '' AS job", runOnMain: runOnMain() })
    expect(verdict.verdict).toBe('accepted')
  })

  it('отклоняет неверный результат', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: {} })
    const verdict = await checkAnswer({
      step,
      playerSql: "SELECT name FROM suspects WHERE job = 'повар'",
      runOnMain: runOnMain(),
    })
    expect(verdict).toEqual({ verdict: 'rejected', reason: 'результат запроса не совпадает с эталоном' })
  })

  it('возвращает ошибку игрока как есть', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: {} })
    const verdict = await checkAnswer({ step, playerSql: 'SELECT nam FROM suspects', runOnMain: runOnMain() })
    expect(verdict).toEqual({ verdict: 'error', error: 'no such column: nam' })
  })
})

describe('shadow', () => {
  it('ловит захардкоженный ответ', async () => {
    const step = makeStep({
      solution: 'SELECT name FROM suspects',
      check: { shadow: true },
    })
    const verdict = await checkAnswer({
      step,
      // Совпадает с эталоном на основном seed, но не имеет отношения к shadow_seed.
      playerSql: "SELECT 'Анна Верес' AS name UNION ALL SELECT 'Борис Клем'",
      runOnMain: executorFor(suspectsSchema, suspectsSeed),
      runOnShadow: executorFor(suspectsSchema, shadowSeed),
    })
    expect(verdict.verdict).toBe('rejected')
  })

  it('пропускает честный ответ', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: { shadow: true } })
    const verdict = await checkAnswer({
      step,
      playerSql: 'SELECT name FROM suspects',
      runOnMain: executorFor(suspectsSchema, suspectsSeed),
      runOnShadow: executorFor(suspectsSchema, shadowSeed),
    })
    expect(verdict).toEqual({ verdict: 'accepted' })
  })

  it('падает, если runOnShadow не передан, а check.shadow включён', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: { shadow: true } })
    await expect(
      checkAnswer({ step, playerSql: 'SELECT name FROM suspects', runOnMain: executorFor(suspectsSchema, suspectsSeed) }),
    ).rejects.toThrow('runOnShadow')
  })
})

describe('require / forbid', () => {
  const runOnMain = () => executorFor(suspectsSchema, suspectsSeed)

  it('принимает решение и добавляет мягкое замечание при отсутствии require', () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: { require: ['WHERE'] } })
    return checkAnswer({ step, playerSql: 'SELECT name FROM suspects', runOnMain: runOnMain() }).then((verdict) => {
      expect(verdict.verdict).toBe('accepted')
      expect((verdict as { note?: string }).note).toMatch(/WHERE/)
    })
  })

  it('принимает решение и добавляет замечание при использовании forbid', () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: { forbid: ['UNION'] } })
    return checkAnswer({
      step,
      playerSql: "SELECT name FROM suspects UNION SELECT name FROM suspects",
      runOnMain: runOnMain(),
    }).then((verdict) => {
      expect(verdict.verdict).toBe('accepted')
      expect((verdict as { note?: string }).note).toMatch(/UNION/)
    })
  })

  it('не добавляет замечание, когда всё совпало', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects WHERE id = 1', check: { require: ['WHERE'] } })
    const verdict = await checkAnswer({
      step,
      playerSql: 'SELECT name FROM suspects WHERE id = 1',
      runOnMain: runOnMain(),
    })
    expect(verdict).toEqual({ verdict: 'accepted' })
  })
})

describe('schema', () => {
  const ddlSchema = 'CREATE TABLE placeholder (x INTEGER);'
  const emptySeed = ''

  it('засчитывает совпадающую схему независимо от порядка столбцов', async () => {
    const step = makeStep({
      solution: 'CREATE TABLE clues (id INTEGER PRIMARY KEY, label TEXT NOT NULL)',
      check: { mode: 'schema', table: 'clues' },
    })
    const verdict = await checkAnswer({
      step,
      playerSql: 'CREATE TABLE clues (label TEXT NOT NULL, id INTEGER PRIMARY KEY)',
      runOnMain: executorFor(ddlSchema, emptySeed),
    })
    expect(verdict).toEqual({ verdict: 'accepted' })
  })

  it('не важен регистр типа', async () => {
    const step = makeStep({
      solution: 'CREATE TABLE clues (id INTEGER PRIMARY KEY, label TEXT NOT NULL)',
      check: { mode: 'schema', table: 'clues' },
    })
    const verdict = await checkAnswer({
      step,
      playerSql: 'CREATE TABLE clues (id integer PRIMARY KEY, label text NOT NULL)',
      runOnMain: executorFor(ddlSchema, emptySeed),
    })
    expect(verdict).toEqual({ verdict: 'accepted' })
  })

  it('отклоняет несовпадающий NOT NULL', async () => {
    const step = makeStep({
      solution: 'CREATE TABLE clues (id INTEGER PRIMARY KEY, label TEXT NOT NULL)',
      check: { mode: 'schema', table: 'clues' },
    })
    const verdict = await checkAnswer({
      step,
      playerSql: 'CREATE TABLE clues (id INTEGER PRIMARY KEY, label TEXT)',
      runOnMain: executorFor(ddlSchema, emptySeed),
    })
    expect(verdict.verdict).toBe('rejected')
  })

  it('отклоняет недостающую колонку', async () => {
    const step = makeStep({
      solution: 'CREATE TABLE clues (id INTEGER PRIMARY KEY, label TEXT NOT NULL)',
      check: { mode: 'schema', table: 'clues' },
    })
    const verdict = await checkAnswer({
      step,
      playerSql: 'CREATE TABLE clues (id INTEGER PRIMARY KEY)',
      runOnMain: executorFor(ddlSchema, emptySeed),
    })
    expect(verdict.verdict).toBe('rejected')
  })
})

describe('rowcount', () => {
  const schema = 'CREATE TABLE suspects (id INTEGER PRIMARY KEY, name TEXT, job TEXT);'
  const seed = suspectsSeed

  it('засчитывает совпадающее число затронутых строк', async () => {
    const step = makeStep({
      solution: "UPDATE suspects SET job = 'уволен' WHERE job = 'повар'",
      check: { mode: 'rowcount' },
    })
    const verdict = await checkAnswer({
      step,
      playerSql: "UPDATE suspects SET job = 'бывший повар' WHERE job = 'повар'",
      runOnMain: executorFor(schema, seed),
    })
    expect(verdict).toEqual({ verdict: 'accepted' })
  })

  it('отклоняет несовпадающее число затронутых строк', async () => {
    const step = makeStep({
      solution: "UPDATE suspects SET job = 'уволен' WHERE job = 'повар'",
      check: { mode: 'rowcount' },
    })
    const verdict = await checkAnswer({
      step,
      playerSql: "UPDATE suspects SET job = 'уволен'",
      runOnMain: executorFor(schema, seed),
    })
    expect(verdict.verdict).toBe('rejected')
  })
})

describe('дело 00.json целиком', () => {
  let kase: Case

  beforeAll(() => {
    const root = fileURLToPath(new URL('../..', import.meta.url))
    const raw = JSON.parse(readFileSync(join(root, 'public', 'cases', '00.json'), 'utf8'))
    kase = parseCase(raw, '00.json')
  })

  it('решение каждого шага засчитывается', async () => {
    for (const step of kase.steps) {
      const verdict = await checkAnswer({
        step,
        playerSql: step.solution,
        runOnMain: executorFor(kase.db.schema, kase.db.seed),
        runOnShadow: kase.db.shadow_seed
          ? executorFor(kase.db.schema, kase.db.shadow_seed)
          : undefined,
      })
      expect(verdict.verdict, `шаг ${step.id}`).toBe('accepted')
    }
  })
})

describe('дело 00.json: попытка обмана хардкодом ловится', () => {
  it('ответ, верный на seed, но захардкоженный — отклоняется на shadow_seed', async () => {
    const root = fileURLToPath(new URL('../..', import.meta.url))
    const raw = JSON.parse(readFileSync(join(root, 'public', 'cases', '00.json'), 'utf8'))
    const kase = parseCase(raw, '00.json')
    const step = kase.steps[0] // требует shadow: true
    expect(step.check.shadow).toBe(true)

    const verdict = await checkAnswer({
      step,
      // Совпадает построчно с реальным ответом на основной seed, но это не запрос, а список значений.
      playerSql:
        "SELECT 'Анна Верес' AS name UNION ALL SELECT 'Борис Клем' UNION ALL SELECT 'Вера Долина' UNION ALL SELECT 'Глеб Марин'",
      runOnMain: executorFor(kase.db.schema, kase.db.seed),
      runOnShadow: executorFor(kase.db.schema, kase.db.shadow_seed!),
    })

    expect(verdict.verdict).toBe('rejected')
  })
})
