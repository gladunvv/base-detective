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
  /**
   * На каком шаге игрок остановился в каждом незакрытом деле: id дела → номер шага.
   * Лежит здесь, а не отдельным ключом, как подсказки: это именно прогресс, и когда
   * он переедет на HTTP, место в деле должно переехать вместе с пройденными делами —
   * иначе человек, сменивший устройство, потеряет середину двенадцатишагового дела.
   */
  step: Record<string, number>
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
  if (isEmptyProgress(raw)) return { completed: [], step: {} }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'completed' in parsed &&
      Array.isArray((parsed as { completed: unknown }).completed)
    ) {
      const saved = parsed as Partial<Progress>
      // Записи без `step` остались от версии, где шаг не хранился вовсе.
      const step = typeof saved.step === 'object' && saved.step !== null ? saved.step : {}
      return {
        completed: (saved.completed ?? []).filter((id) => typeof id === 'string'),
        step: Object.fromEntries(
          Object.entries(step).filter(([, value]) => typeof value === 'number' && value >= 0),
        ),
      }
    }
  } catch {
    // повреждённая запись — считаем, что прогресса нет, не падаем
  }
  return { completed: [], step: {} }
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
      // Дело закрыто — незачем помнить, на каком шаге его когда-то бросили.
      const step = { ...progress.step }
      delete step[id]
      if (progress.completed.includes(id)) {
        write(backend, { ...progress, step })
        return
      }
      write(backend, { completed: [...progress.completed, id], step })
    },

    /** Шаг, на котором игрок остановился. Ноль — дело ещё не начато. */
    getStep(id: string): number {
      return read(backend).step[id] ?? 0
    },

    setStep(id: string, index: number): void {
      const progress = read(backend)
      write(backend, { ...progress, step: { ...progress.step, [id]: index } })
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
