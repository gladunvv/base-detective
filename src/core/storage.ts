/**
 * Прогресс игрока. Сегодня поверх `localStorage`, завтра — HTTP; остальное
 * приложение об этом не знает и не должно узнать. Бэкенд передаётся снаружи
 * (`createStorage(localStorage)` в UI-слое), поэтому само ядро не ссылается
 * на браузерные глобали и тестируется в Node обычной подменой.
 *
 * Разблокировка — последовательная и вычисляется из id: дело "00" открыто
 * всегда, дело "NN" — как только пройдено "NN-1". Отдельного списка дел
 * не нужно: двузначный числовой id — это и есть позиция в очереди
 * (контракт закреплён в types.ts ещё в фазе 1).
 */

export type Progress = {
  /** id пройденных дел, в порядке прохождения, без повторов. */
  completed: string[]
}

export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY = 'bd:progress'
const FIRST_CASE_ID = '00'

function isEmptyProgress(raw: string | null): raw is null {
  return raw === null
}

function read(backend: StorageBackend): Progress {
  const raw = backend.getItem(KEY)
  if (isEmptyProgress(raw)) return { completed: [] }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'completed' in parsed &&
      Array.isArray((parsed as { completed: unknown }).completed)
    ) {
      return { completed: (parsed as Progress).completed.filter((id) => typeof id === 'string') }
    }
  } catch {
    // повреждённая запись — считаем, что прогресса нет, не падаем
  }
  return { completed: [] }
}

function write(backend: StorageBackend, progress: Progress): void {
  backend.setItem(KEY, JSON.stringify(progress))
}

/** Предыдущий id в последовательности "00", "01", "02", ... или `null` для первого дела. */
function previousId(id: string): string | null {
  const n = Number(id)
  if (id === FIRST_CASE_ID || Number.isNaN(n) || n <= 0) return null
  return String(n - 1).padStart(id.length, '0')
}

export function createStorage(backend: StorageBackend) {
  return {
    getProgress(): Progress {
      return read(backend)
    },

    completeCase(id: string): void {
      const progress = read(backend)
      if (progress.completed.includes(id)) return
      write(backend, { completed: [...progress.completed, id] })
    },

    resetProgress(): void {
      backend.removeItem(KEY)
    },

    isUnlocked(id: string): boolean {
      const prev = previousId(id)
      if (prev === null) return true
      return read(backend).completed.includes(prev)
    },
  }
}

export type ProgressStore = ReturnType<typeof createStorage>
