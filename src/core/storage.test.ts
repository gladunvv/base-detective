import { beforeEach, describe, expect, it } from 'vitest'
import { caseHintsKey, createStorage, type StorageBackend } from './storage.ts'

/** То же поведение, что у localStorage, без браузера. */
function fakeBackend(): StorageBackend {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

describe('storage', () => {
  let backend: StorageBackend
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    backend = fakeBackend()
    storage = createStorage(backend)
  })

  it('изначально прогресс пуст', () => {
    expect(storage.getProgress()).toEqual({ completed: [], step: {}, learned: [] })
  })

  it('первое дело разблокировано всегда', () => {
    expect(storage.isUnlocked('00')).toBe(true)
  })

  it('следующее дело закрыто, пока предыдущее не пройдено', () => {
    expect(storage.isUnlocked('01')).toBe(false)
    storage.completeCase('00')
    expect(storage.isUnlocked('01')).toBe(true)
    expect(storage.isUnlocked('02')).toBe(false)
  })

  it('completeCase добавляет id в прогресс', () => {
    storage.completeCase('00')
    expect(storage.getProgress()).toEqual({ completed: ['00'], step: {}, learned: [] })
  })

  it('completeCase не дублирует id при повторном вызове', () => {
    storage.completeCase('00')
    storage.completeCase('00')
    expect(storage.getProgress()).toEqual({ completed: ['00'], step: {}, learned: [] })
  })

  it('порядок прохождения сохраняется', () => {
    storage.completeCase('00')
    storage.completeCase('01')
    expect(storage.getProgress()).toEqual({ completed: ['00', '01'], step: {}, learned: [] })
  })

  it('resetProgress возвращает к начальному состоянию', () => {
    storage.completeCase('00')
    storage.completeCase('01')
    storage.resetProgress()
    expect(storage.getProgress()).toEqual({ completed: [], step: {}, learned: [] })
    expect(storage.isUnlocked('01')).toBe(false)
  })

  it('прогресс переживает пересоздание store поверх того же бэкенда', () => {
    storage.completeCase('00')
    const reopened = createStorage(backend)
    expect(reopened.getProgress()).toEqual({ completed: ['00'], step: {}, learned: [] })
  })

  it('повреждённая запись в бэкенде не роняет чтение', () => {
    backend.setItem('bd:progress', '{не json')
    expect(storage.getProgress()).toEqual({ completed: [], step: {}, learned: [] })
    expect(storage.isUnlocked('00')).toBe(true)
  })

  it('шаг внутри дела запоминается и переживает пересоздание store', () => {
    storage.setStep('00', 4, 1)
    expect(storage.resumeCase('00', 1, 10).index).toBe(4)
    expect(createStorage(backend).resumeCase('00', 1, 10).index).toBe(4)
  })

  it('у нетронутого дела шаг нулевой', () => {
    expect(storage.resumeCase('00', 1, 10).index).toBe(0)
  })

  it('шаг не путается между делами', () => {
    storage.setStep('00', 3, 1)
    storage.setStep('01', 7, 1)
    expect(storage.resumeCase('00', 1, 10).index).toBe(3)
    expect(storage.resumeCase('01', 1, 10).index).toBe(7)
  })

  it('закрытое дело забывает свой шаг, остальные сохраняют', () => {
    storage.setStep('00', 5, 1)
    storage.setStep('01', 2, 1)
    storage.completeCase('00')
    expect(storage.resumeCase('00', 1, 10).index).toBe(0)
    expect(storage.resumeCase('01', 1, 10).index).toBe(2)
  })

  it('completeCase не теряет уже пройденные дела при очистке шага', () => {
    storage.completeCase('00')
    storage.setStep('01', 6, 1)
    storage.completeCase('01')
    expect(storage.getProgress().completed).toEqual(['00', '01'])
  })

  // Записи, сделанные версией без шагов, должны читаться как есть.
  it('старая запись без поля step читается без потерь', () => {
    backend.setItem('bd:progress', JSON.stringify({ completed: ['00'] }))
    expect(storage.getProgress()).toEqual({ completed: ['00'], step: {}, learned: [] })
    expect(storage.resumeCase('00', 1, 10).index).toBe(0)
  })

  it('мусор в поле step отбрасывается, прогресс остаётся', () => {
    backend.setItem('bd:progress', JSON.stringify({ completed: ['00'], step: { '01': 'три', '02': 2 } }))
    expect(storage.resumeCase('01', 1, 10).index).toBe(0)
    expect(storage.resumeCase('02', 1, 10).index).toBe(2)
    expect(storage.getProgress().completed).toEqual(['00'])
  })

  it('при смене редакции сбрасывает только шаг и подсказки затронутого дела', () => {
    backend.setItem('bd:progress', JSON.stringify({
      completed: ['00'],
      step: { '01': 4, '02': 2 },
      learned: ['select'],
    }))
    const oldHints = caseHintsKey('01', 1)
    backend.setItem(oldHints, '{"s5":2}')
    backend.setItem(caseHintsKey('02', 1), '{"s3":1}')

    expect(storage.resumeCase('01', 2, 8)).toEqual({ index: 0, restarted: true })
    expect(storage.resumeCase('01', 2, 8)).toEqual({ index: 0, restarted: false })
    expect(backend.getItem(oldHints)).toBeNull()
    expect(backend.getItem(caseHintsKey('02', 1))).toBe('{"s3":1}')
    expect(storage.resumeCase('02', 1, 3)).toEqual({ index: 2, restarted: false })
    expect(storage.getProgress().completed).toEqual(['00'])
    expect(storage.isUnlocked('01')).toBe(true)
    expect(storage.getLearned()).toEqual(['select'])

    storage.setStep('01', 1, 2)
    expect(createStorage(backend).resumeCase('01', 2, 8)).toEqual({ index: 1, restarted: false })
    expect(caseHintsKey('01', 2)).not.toBe(oldHints)
  })

  it('устаревший индекс за пределами дела возвращает на первый шаг', () => {
    storage.setStep('00', 5, 1)
    expect(storage.resumeCase('00', 1, 3)).toEqual({ index: 0, restarted: true })
  })

  it('пройденные конструкции копятся и не дублируются', () => {
    storage.learn(['select', 'where'])
    storage.learn(['where', 'order-by'])
    expect(storage.getProgress().learned).toEqual(['select', 'where', 'order-by'])
    expect(storage.getLearned()).toEqual(['select', 'where', 'order-by'])
  })

  it('пройденные конструкции переживают пересоздание store', () => {
    storage.learn(['join'])
    expect(createStorage(backend).getLearned()).toContain('join')
  })

  it('закрытие дела не стирает пройденные конструкции', () => {
    storage.learn(['select'])
    storage.completeCase('00')
    expect(storage.getLearned()).toContain('select')
  })

  it('resetProgress стирает и шаги', () => {
    storage.setStep('00', 4, 1)
    storage.resetProgress()
    expect(storage.resumeCase('00', 1, 10).index).toBe(0)
  })
})
