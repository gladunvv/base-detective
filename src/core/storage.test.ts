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
    expect(storage.getProgress()).toEqual({ completed: [] })
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
    expect(storage.getProgress()).toEqual({ completed: ['00'] })
  })

  it('completeCase не дублирует id при повторном вызове', () => {
    storage.completeCase('00')
    storage.completeCase('00')
    expect(storage.getProgress()).toEqual({ completed: ['00'] })
  })

  it('порядок прохождения сохраняется', () => {
    storage.completeCase('00')
    storage.completeCase('01')
    expect(storage.getProgress()).toEqual({ completed: ['00', '01'] })
  })

  it('resetProgress возвращает к начальному состоянию', () => {
    storage.completeCase('00')
    storage.completeCase('01')
    storage.resetProgress()
    expect(storage.getProgress()).toEqual({ completed: [] })
    expect(storage.isUnlocked('01')).toBe(false)
  })

  it('прогресс переживает пересоздание store поверх того же бэкенда', () => {
    storage.completeCase('00')
    const reopened = createStorage(backend)
    expect(reopened.getProgress()).toEqual({ completed: ['00'] })
  })

  it('повреждённая запись в бэкенде не роняет чтение', () => {
    backend.setItem('bd:progress', '{не json')
    expect(storage.getProgress()).toEqual({ completed: [] })
    expect(storage.isUnlocked('00')).toBe(true)
  })
})
