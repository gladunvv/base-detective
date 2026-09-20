import { z } from 'zod'
import { caseSchema, type Case } from './types.ts'

export class CaseLoadError extends Error {
  source: string
  /** Дела с таким номером не существует — это 404, а не поломка файла. */
  notFound: boolean

  constructor(source: string, message: string, notFound = false) {
    super(`Дело ${source}: ${message}`)
    this.name = 'CaseLoadError'
    this.source = source
    this.notFound = notFound
  }
}

function describe(issues: z.core.$ZodIssue[]): string {
  const lines = issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(корень)'
    return `  ${path} — ${issue.message}`
  })
  return `файл не соответствует формату\n${lines.join('\n')}`
}

/** Разбирает уже прочитанный JSON. Отдельно от `loadCase`, чтобы этим же путём шёл валидатор. */
export function parseCase(raw: unknown, source: string): Case {
  const result = caseSchema.safeParse(raw)
  if (!result.success) {
    throw new CaseLoadError(source, describe(result.error.issues))
  }
  return result.data
}

/** Грузит дело из `public/cases/NN.json`. Файл не попадает в бандл — это намеренно. */
export async function loadCase(id: string): Promise<Case> {
  const source = `${id}.json`
  let response: Response
  try {
    response = await fetch(`/cases/${source}`)
  } catch (cause) {
    throw new CaseLoadError(source, `не удалось загрузить файл (${String(cause)})`)
  }
  if (!response.ok) {
    throw new CaseLoadError(source, `сервер ответил ${response.status}`, response.status === 404)
  }

  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    throw new CaseLoadError(source, 'файл не является корректным JSON')
  }

  const parsed = parseCase(raw, source)
  if (parsed.id !== id) {
    throw new CaseLoadError(source, `поле id равно "${parsed.id}", а файл называется "${id}"`)
  }
  return parsed
}

/**
 * Список id дел в порядке отображения. Отдельный файл, а не сканирование каталога:
 * статический хостинг не отдаёт листинг директории. Специально не хранит заголовки —
 * иначе название ещё не пройденного дела утекало бы в список одним запросом
 * (дизайн-документ, §4: заголовок недоступного дела — спойлер).
 */
export async function loadCaseManifest(): Promise<string[]> {
  const source = 'index.json'
  let response: Response
  try {
    response = await fetch(`/cases/${source}`)
  } catch (cause) {
    throw new CaseLoadError(source, `не удалось загрузить файл (${String(cause)})`)
  }
  if (!response.ok) {
    throw new CaseLoadError(source, `сервер ответил ${response.status}`)
  }

  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    throw new CaseLoadError(source, 'файл не является корректным JSON')
  }

  if (!Array.isArray(raw) || !raw.every((id) => typeof id === 'string')) {
    throw new CaseLoadError(source, 'ожидался массив строк')
  }
  return raw
}
