import { describe, expect, it } from 'vitest'
import { translateError } from './errorDict.ts'
import type { ErrorRule } from './types.ts'

// Ровно те сообщения, которые реально отдаёт sql.js (сверено вручную:
// подставлены как есть, не придуманы по документации).
const RAW = {
  noSuchColumn: 'no such column: nam',
  noSuchTable: 'no such table: suspect',
  syntaxError: 'near "SELEKT": syntax error',
  notNull: 'NOT NULL constraint failed: suspects.name',
  unique: 'UNIQUE constraint failed: suspects.name',
  noSuchFunction: 'no such function: FOOBAR',
  ambiguous: 'ambiguous column name: id',
} as const

describe('translateError: минимальный набор из роадмапы', () => {
  it.each(Object.entries(RAW))('переводит "%s"', (_label, raw) => {
    const translated = translateError(raw)
    expect(translated).not.toBe(raw)
    expect(translated.length).toBeGreaterThan(0)
  })

  it('называет колонку из "no such column"', () => {
    expect(translateError(RAW.noSuchColumn)).toContain('nam')
  })

  it('называет таблицу из "no such table"', () => {
    expect(translateError(RAW.noSuchTable)).toContain('suspect')
  })

  it('называет функцию из "no such function"', () => {
    expect(translateError(RAW.noSuchFunction)).toContain('FOOBAR')
  })

  it('называет колонку из "ambiguous column name"', () => {
    expect(translateError(RAW.ambiguous)).toContain('id')
  })

  it('называет место ошибки из "syntax error"', () => {
    expect(translateError(RAW.syntaxError)).toContain('SELEKT')
  })

  it('называет колонку из NOT NULL', () => {
    expect(translateError(RAW.notNull)).toContain('suspects.name')
  })

  it('называет поле из UNIQUE', () => {
    expect(translateError(RAW.unique)).toContain('suspects.name')
  })
})

describe('translateError: общие свойства', () => {
  it('никогда не возвращает сырое сообщение SQLite как есть', () => {
    for (const raw of Object.values(RAW)) {
      expect(translateError(raw)).not.toBe(raw)
    }
  })

  it('неизвестная ошибка получает общий, но не сырой текст', () => {
    const raw = 'database disk image is malformed'
    const translated = translateError(raw)
    expect(translated).not.toBe(raw)
    expect(translated.length).toBeGreaterThan(0)
  })

  it('правило шага перекрывает общий словарь', () => {
    const rules: ErrorRule[] = [{ match: 'no such column', say: 'Текст специально для этого шага.' }]
    expect(translateError(RAW.noSuchColumn, rules)).toBe('Текст специально для этого шага.')
  })

  it('правило шага проверяется первым даже при совпадении с общим словарём', () => {
    // "no such table" совпало бы и с общим словарём, но шаг важнее.
    const rules: ErrorRule[] = [{ match: 'no such table: suspect\\b', say: 'Таблица называется suspects.' }]
    expect(translateError(RAW.noSuchTable, rules)).toBe('Таблица называется suspects.')
  })

  it('не совпавшее правило шага не мешает общему словарю', () => {
    const rules: ErrorRule[] = [{ match: 'совсем другая ошибка', say: 'Не должно сработать.' }]
    expect(translateError(RAW.noSuchColumn, rules)).not.toBe('Не должно сработать.')
    expect(translateError(RAW.noSuchColumn, rules)).toContain('nam')
  })
})
