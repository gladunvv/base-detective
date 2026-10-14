import { beforeEach, describe, expect, it } from 'vitest'
import { createStorage, type StorageBackend } from './storage.ts'

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
    expect(storage.getProgress()).toEqual({ completed: [], step: {} })
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
    expect(storage.getProgress()).toEqual({ completed: ['00'], step: {} })
  })

  it('completeCase не дублирует id при повторном вызове', () => {
    storage.completeCase('00')
    storage.completeCase('00')
    expect(storage.getProgress()).toEqual({ completed: ['00'], step: {} })
  })

  it('порядок прохождения сохраняется', () => {
    storage.completeCase('00')
    storage.completeCase('01')
    expect(storage.getProgress()).toEqual({ completed: ['00', '01'], step: {} })
  })

  it('resetProgress возвращает к начальному состоянию', () => {
    storage.completeCase('00')
    storage.completeCase('01')
    storage.resetProgress()
    expect(storage.getProgress()).toEqual({ completed: [], step: {} })
    expect(storage.isUnlocked('01')).toBe(false)
  })

  it('прогресс переживает пересоздание store поверх того же бэкенда', () => {
    storage.completeCase('00')
    const reopened = createStorage(backend)
    expect(reopened.getProgress()).toEqual({ completed: ['00'], step: {} })
  })

  it('повреждённая запись в бэкенде не роняет чтение', () => {
    backend.setItem('bd:progress', '{не json')
    expect(storage.getProgress()).toEqual({ completed: [], step: {} })
    expect(storage.isUnlocked('00')).toBe(true)
  })

  it('шаг внутри дела запоминается и переживает пересоздание store', () => {
    storage.setStep('00', 4)
    expect(storage.getStep('00')).toBe(4)
    expect(createStorage(backend).getStep('00')).toBe(4)
  })

  it('у нетронутого дела шаг нулевой', () => {
    expect(storage.getStep('00')).toBe(0)
  })

  it('шаг не путается между делами', () => {
    storage.setStep('00', 3)
    storage.setStep('01', 7)
    expect(storage.getStep('00')).toBe(3)
    expect(storage.getStep('01')).toBe(7)
  })

  it('закрытое дело забывает свой шаг, остальные сохраняют', () => {
    storage.setStep('00', 5)
    storage.setStep('01', 2)
    storage.completeCase('00')
    expect(storage.getStep('00')).toBe(0)
    expect(storage.getStep('01')).toBe(2)
  })

  it('completeCase не теряет уже пройденные дела при очистке шага', () => {
    storage.completeCase('00')
    storage.setStep('01', 6)
    storage.completeCase('01')
    expect(storage.getProgress().completed).toEqual(['00', '01'])
  })

  // Записи, сделанные версией без шагов, должны читаться как есть.
  it('старая запись без поля step читается без потерь', () => {
    backend.setItem('bd:progress', JSON.stringify({ completed: ['00'] }))
    expect(storage.getProgress()).toEqual({ completed: ['00'], step: {} })
    expect(storage.getStep('00')).toBe(0)
  })

  it('мусор в поле step отбрасывается, прогресс остаётся', () => {
    backend.setItem('bd:progress', JSON.stringify({ completed: ['00'], step: { '01': 'три', '02': 2 } }))
    expect(storage.getStep('01')).toBe(0)
    expect(storage.getStep('02')).toBe(2)
    expect(storage.getProgress().completed).toEqual(['00'])
  })

  it('resetProgress стирает и шаги', () => {
    storage.setStep('00', 4)
    storage.resetProgress()
    expect(storage.getStep('00')).toBe(0)
  })
})
