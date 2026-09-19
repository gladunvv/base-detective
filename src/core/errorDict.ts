/**
 * Перевод сырых сообщений SQLite на человеческий язык. Игрок никогда не должен
 * увидеть текст вроде «near "SELEKT": syntax error» — задача этого файла
 * в том, чтобы такого не случилось.
 *
 * Правила шага (`Step.errors`) проверяются первыми и перекрывают общий
 * словарь — так и просит роадмапа. Формат у них проще (`match`/`say` —
 * обе строки, без групп захвата): их пишет автор дела в JSON, а не программист.
 */
import type { ErrorRule } from './types.ts'

type DictRule = { match: RegExp; say: (m: RegExpMatchArray) => string }

// Порядок важен: более specific-паттерны — раньше общих (иначе общий
// перехватит то, что должно было попасть в частный).
const DICTIONARY: DictRule[] = [
  {
    match: /no such column: (.+)/i,
    say: (m) => `Такой колонки нет: «${m[1]}». Проверьте название и то, из какой она таблицы.`,
  },
  {
    match: /no such table: (.+)/i,
    say: (m) => `Такой таблицы нет: «${m[1]}». Проверьте название — возможно, опечатка или число.`,
  },
  {
    match: /no such function: (.+)/i,
    say: (m) => `Такой функции нет: «${m[1]}». Проверьте написание.`,
  },
  {
    match: /ambiguous column name: (.+)/i,
    say: (m) =>
      `Колонка «${m[1]}» есть в нескольких таблицах сразу — уточните её через имя таблицы, например t.${m[1]}.`,
  },
  {
    match: /NOT NULL constraint failed: (.+)/i,
    say: (m) => `Колонка «${m[1]}» не может быть пустой — нужно указать значение.`,
  },
  {
    match: /UNIQUE constraint failed: (.+)/i,
    say: (m) => `Такое значение для «${m[1]}» уже есть — должно быть уникальным.`,
  },
  {
    match: /^near "(.+)": syntax error/i,
    say: (m) => `Ошибка в запросе рядом с «${m[1]}» — проверьте это место.`,
  },
  {
    match: /syntax error/i,
    say: () => 'Синтаксическая ошибка в запросе — проверьте ключевые слова, скобки и кавычки.',
  },
]

const FALLBACK = 'Запрос не выполнился. Проверьте синтаксис, имена таблиц и колонок.'

/** Переводит сырое сообщение SQLite. Ничего не находит — отдаёт общий, но не сырой текст. */
export function translateError(rawMessage: string, stepRules: ErrorRule[] = []): string {
  for (const rule of stepRules) {
    if (new RegExp(rule.match, 'i').test(rawMessage)) return rule.say
  }
  for (const rule of DICTIONARY) {
    const match = rawMessage.match(rule.match)
    if (match) return rule.say(match)
  }
  return FALLBACK
}
