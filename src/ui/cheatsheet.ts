import { useEffect, useState } from 'react'

export type CheatEntry = {
  id: string
  group: string
  title: string
  summary: string
  form: string
  example: string
}

const FILE = '/cheatsheet.json'

// Один запрос на всю сессию: справочник не меняется, а нужен он сразу в двух
// местах — в панели и в подписи шага.
let cached: Promise<CheatEntry[]> | null = null

function load(): Promise<CheatEntry[]> {
  cached ??= fetch(FILE).then((response) => {
    if (!response.ok) throw new Error(`${FILE}: ${response.status}`)
    return response.json() as Promise<CheatEntry[]>
  })
  return cached
}

type CheatsheetState = { entries: CheatEntry[] | null; failed: boolean }

/**
 * Шпаргалка деда — справочник конструкций, на который шаги ссылаются через
 * `step.teaches`. Названия берутся отсюда, а не дублируются в коде: иначе
 * переименование записи оставило бы на экране дела старую подпись.
 */
export function useCheatsheet(): CheatsheetState {
  const [state, setState] = useState<CheatsheetState>({ entries: null, failed: false })

  useEffect(() => {
    let alive = true
    void load().then(
      (entries) => alive && setState({ entries, failed: false }),
      () => alive && setState({ entries: null, failed: true }),
    )
    return () => {
      alive = false
    }
  }, [])

  return state
}

/** Название конструкции для подписи шага; до загрузки справочника — пусто. */
export function titlesFor(ids: string[], entries: CheatEntry[] | null): string[] {
  if (!entries) return []
  return ids.map((id) => entries.find((entry) => entry.id === id)?.title).filter((t): t is string => t !== undefined)
}
