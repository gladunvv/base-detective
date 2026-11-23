import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { checkAnswer, type FreshExecutor } from './checker.ts'
import { execLast, execReadOnly, openDb, READ_ONLY_QUERY_ERROR } from './sqlite.ts'
import { parseCase } from './caseLoader.ts'
import type { Case, Check, Step } from './types.ts'

let SQL: SqlJsStatic

beforeAll(async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  SQL = await initSqlJs({ locateFile: (file) => join(root, 'node_modules', 'sql.js', 'dist', file) })
})

/** Executor «как в проде»: свежая база на каждый вызов, никакого общего состояния между ними. */
function executorFor(schema: string, seed: string): FreshExecutor {
  return (sql, policy) =>
    Promise.resolve().then(() => {
      const db = openDb(SQL, schema, seed)
      try {
        const execute = policy === 'read' ? execReadOnly : execLast
        return { ok: true as const, result: execute(db, sql) }
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
    teaches: [],
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
      expect_empty: false,
      ...overrides.check,
    },
  }
}

function loadCaseFixture(id: string): Case {
  const filename = `${id}.json`
  const path = new URL(`../../public/cases/${filename}`, import.meta.url)
  return parseCase(JSON.parse(readFileSync(path, 'utf8')), filename)
}

describe('resultset', () => {
  const runOnMain = () => executorFor(suspectsSchema, suspectsSeed)

  it.each([
    'WITH names AS (SELECT name FROM suspects) SELECT name FROM names;',
    '; -- комментарий\n /* SELECT ; */ select name FROM suspects; /* конец */ ;',
  ])('принимает один читающий запрос: %s', async (playerSql) => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: {} })
    const verdict = await checkAnswer({ step, playerSql, runOnMain: runOnMain() })
    expect(verdict).toEqual({ verdict: 'accepted' })
  })

  it.each([
    'SELECT name FROM suspects; SELECT name FROM suspects',
    "UPDATE suspects SET name = 'Анна' WHERE id = 1",
    "WITH target AS (SELECT 1) UPDATE suspects SET name = 'Анна' WHERE id IN (SELECT * FROM target)",
  ])('отклоняет запрос вне политики чтения: %s', async (playerSql) => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: {} })
    const verdict = await checkAnswer({ step, playerSql, runOnMain: runOnMain() })
    expect(verdict).toEqual({ verdict: 'error', error: READ_ONLY_QUERY_ERROR })
  })

  it('сохраняет точки с запятой внутри значений и поддерживает просмотр схемы', () => {
    const db = openDb(SQL, suspectsSchema, suspectsSeed)
    try {
      expect(execReadOnly(db, "SELECT 'улика;фото' AS note;").rows).toEqual([['улика;фото']])
      expect(execReadOnly(db, "SELECT name FROM pragma_table_info('suspects')").rows)
        .toEqual([['id'], ['name'], ['job']])
    } finally {
      db.close()
    }
  })

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

  it('псевдоним колонки не влияет на вердикт', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: {} })
    const verdict = await checkAnswer({
      step,
      playerSql: 'SELECT name AS кто FROM suspects',
      runOnMain: runOnMain(),
    })
    expect(verdict.verdict).toBe('accepted')
  })

  // Ради этого случая сверка имён и убрана: SQLite назовёт колонку по тексту
  // выражения, и `COUNT(*)` против `n` разошлись бы при одинаковом числе.
  it('агрегат принимается и с псевдонимом, и без него', async () => {
    const step = makeStep({ solution: 'SELECT COUNT(*) FROM suspects', check: {} })

    const сПсевдонимом = await checkAnswer({
      step,
      playerSql: 'SELECT COUNT(*) AS n FROM suspects',
      runOnMain: runOnMain(),
    })
    expect(сПсевдонимом.verdict).toBe('accepted')

    const безПсевдонима = await checkAnswer({
      step,
      playerSql: 'SELECT COUNT(*) FROM suspects',
      runOnMain: runOnMain(),
    })
    expect(безПсевдонима.verdict).toBe('accepted')
  })

  it('но неверный агрегат по-прежнему отклоняется', async () => {
    const step = makeStep({ solution: 'SELECT COUNT(*) FROM suspects', check: {} })
    const verdict = await checkAnswer({
      step,
      playerSql: "SELECT COUNT(*) AS n FROM suspects WHERE job = 'садовник'",
      runOnMain: runOnMain(),
    })
    expect(verdict.verdict).toBe('rejected')
  })

  it('перепутанный порядок колонок ловится значениями, а не именами', async () => {
    const step = makeStep({ solution: 'SELECT name, job FROM suspects', check: {} })
    const verdict = await checkAnswer({
      step,
      playerSql: 'SELECT job, name FROM suspects',
      runOnMain: runOnMain(),
    })
    expect(verdict.verdict).toBe('rejected')
  })

  describe.each([false, true])('сравнение значений при ordered: %s', (ordered) => {
    it.each([
      ['совпадающие числа и строки', "SELECT 1, 'повар'", "SELECT 1 AS n, 'повар' AS job", 'accepted'],
      ['число и его текстовое представление', 'SELECT 1', "SELECT '1'", 'rejected'],
      ['одинаковые BLOB', "SELECT X'00FF'", "SELECT X'00FF' AS payload", 'accepted'],
      ['BLOB с разными байтами', "SELECT X'00FF'", "SELECT X'00FE'", 'rejected'],
      ['BLOB и текст', "SELECT X'41'", "SELECT 'A'", 'rejected'],
      [
        'другая кратность при равном числе строк',
        'SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 2',
        'SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 2',
        'rejected',
      ],
      ['лишняя колонка с тем же значением', 'SELECT 1', 'SELECT 1, 1', 'rejected'],
      ['NULL и пустая строка', 'SELECT NULL', "SELECT ''", 'rejected'],
      ['пустая строка и NULL', "SELECT ''", 'SELECT NULL', 'rejected'],
      ['два NULL', 'SELECT NULL', 'SELECT NULL AS value', 'accepted'],
      ['две пустые строки', "SELECT ''", "SELECT '' AS value", 'accepted'],
      ['NULL и бесконечность SQLite', 'SELECT NULL', 'SELECT 1e999', 'rejected'],
    ] as const)('%s', async (_name, solution, playerSql, expected) => {
      const step = makeStep({ solution, check: { ordered } })
      const verdict = await checkAnswer({ step, playerSql, runOnMain: runOnMain() })
      expect(verdict.verdict).toBe(expected)
    })
  })

  it.each([
    ['совпавшие дубликаты в другом порядке', 'SELECT 2 UNION ALL SELECT 1 UNION ALL SELECT 1', 'accepted'],
    ['дубликат потерян', 'SELECT 1 UNION SELECT 2', 'rejected'],
  ] as const)('%s', async (_name, playerSql, expected) => {
    const step = makeStep({ solution: 'SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 2', check: {} })
    const verdict = await checkAnswer({ step, playerSql, runOnMain: runOnMain() })
    expect(verdict.verdict).toBe(expected)
  })

  it.each([
    ['пустой результат для отсутствующей записи', 'SELECT name FROM suspects WHERE id IN (99)', true, 'accepted'],
    ['лишняя строка при пустом эталоне', 'SELECT name FROM suspects WHERE id = 1', true, 'rejected'],
    ['пустой результат при непустом эталоне', 'SELECT name FROM suspects WHERE id = 99', false, 'rejected'],
  ] as const)('%s', async (_name, playerSql, expectEmpty, expected) => {
    const id = expectEmpty ? 99 : 1
    const step = makeStep({
      solution: `SELECT name FROM suspects WHERE id = ${id}`,
      check: { expect_empty: expectEmpty },
    })
    const verdict = await checkAnswer({ step, playerSql, runOnMain: runOnMain() })
    expect(verdict.verdict).toBe(expected)
  })

  it('сообщает о поломке эталона отдельно от ошибки игрока', async () => {
    const step = makeStep({ solution: 'SELECT missing_column FROM suspects', check: {} })
    const verdict = await checkAnswer({ step, playerSql: 'SELECT name FROM suspects', runOnMain: runOnMain() })
    expect(verdict).toEqual({
      verdict: 'error',
      error: 'внутренняя ошибка дела: эталон не выполнился (no such column: missing_column)',
    })
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

  it('переводит ошибку игрока на человеческий язык (фаза 6, errorDict)', async () => {
    const step = makeStep({ solution: 'SELECT name FROM suspects', check: {} })
    const verdict = await checkAnswer({ step, playerSql: 'SELECT nam FROM suspects', runOnMain: runOnMain() })
    expect(verdict.verdict).toBe('error')
    expect((verdict as { error: string }).error).not.toBe('no such column: nam')
    expect((verdict as { error: string }).error).toContain('nam')
  })

  it('правило errors конкретного шага перекрывает общий словарь и здесь', async () => {
    const step = makeStep({
      solution: 'SELECT name FROM suspects',
      check: {},
    })
    step.errors.push({ match: 'no such column', say: 'Проверьте название колонки в задании.' })
    const verdict = await checkAnswer({ step, playerSql: 'SELECT nam FROM suspects', runOnMain: runOnMain() })
    expect(verdict).toEqual({ verdict: 'error', error: 'Проверьте название колонки в задании.' })
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

describe('rowcount', () => {
  it.each([
    ['правильное изменение', "UPDATE suspects SET job = 'уволен' WHERE id = 2", 'accepted'],
    // Текущая проверка сравнивает только число строк. Проверка состояния запланирована в BD-14.
    ['неверное значение при том же числе строк', "UPDATE suspects SET job = 'бывший повар' WHERE id = 2", 'accepted'],
    ['ни одна строка не изменена', "UPDATE suspects SET job = 'уволен' WHERE id = 99", 'rejected'],
    ['изменены обе строки', "UPDATE suspects SET job = 'уволен'", 'rejected'],
  ] as const)('%s', async (_name, playerSql, expected) => {
    const step = makeStep({
      solution: "UPDATE suspects SET job = 'уволен' WHERE job = 'повар'",
      check: { mode: 'rowcount' },
    })
    const verdict = await checkAnswer({
      step,
      playerSql,
      runOnMain: executorFor(suspectsSchema, suspectsSeed),
    })
    expect(verdict.verdict).toBe(expected)
  })
})

describe.each(['00', '01', '02', '03'])('дело %s.json целиком', (caseId) => {
  let kase: Case

  beforeAll(() => {
    kase = loadCaseFixture(caseId)
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

describe('дело 01.json: поиск слова в описании без совпадений на основном seed', () => {
  it.each([
    ['поиск через INSTR', "SELECT category, route, description FROM finds WHERE INSTR(description, 'хомяк') > 0", 'accepted'],
    ['запрос с условием, которое всегда ложно', 'SELECT category, route, description FROM finds WHERE 1=0', 'rejected'],
  ] as const)('%s', async (_name, playerSql, expected) => {
    const { db, steps } = loadCaseFixture('01')
    const step = steps.find(({ id }) => id === 's9')!
    const verdict = await checkAnswer({
      step,
      playerSql,
      runOnMain: executorFor(db.schema, db.seed),
      runOnShadow: executorFor(db.schema, db.shadow_seed!),
    })
    expect(verdict.verdict).toBe(expected)
    if (verdict.verdict === 'rejected') expect(verdict.reason).toContain('на контрольных данных')
  })

  it('схема требует контрольную проверку для ожидаемо пустого результата', () => {
    const kase = loadCaseFixture('01')
    kase.steps.find(({ id }) => id === 's9')!.check.shadow = false
    expect(() => parseCase(kase, '01.json')).toThrow('expect_empty требует')
  })
})

describe('дело 00.json: попытка обмана хардкодом ловится', () => {
  // Берём последний шаг: его ответ — одна строка, и выписать её руками быстрее,
  // чем написать запрос. Там, где ответ в двадцать четыре строки, обман дороже
  // честного решения, поэтому shadow на первых шагах и не включён.
  it('ответ, верный на seed, но захардкоженный — отклоняется на shadow_seed', async () => {
    const kase = loadCaseFixture('00')
    const step = kase.steps[kase.steps.length - 1]
    expect(step.check.shadow).toBe(true)

    // Ровно та строка, которую отдаёт эталон на основной базе, — но не запрос, а список значений.
    const playerSql = "SELECT 11 AS room, 'Паша Горелик' AS name, 1904 AS gigabytes"

    const withoutShadow = await checkAnswer({
      step: { ...step, check: { ...step.check, shadow: false } },
      playerSql,
      runOnMain: executorFor(kase.db.schema, kase.db.seed),
    })
    // Без второй базы подлог неотличим от решения — ради этого shadow и существует.
    expect(withoutShadow.verdict).toBe('accepted')

    const verdict = await checkAnswer({
      step,
      playerSql,
      runOnMain: executorFor(kase.db.schema, kase.db.seed),
      runOnShadow: executorFor(kase.db.schema, kase.db.shadow_seed!),
    })

    expect(verdict.verdict).toBe('rejected')
  })
})
