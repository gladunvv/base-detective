import { z } from 'zod'

/** Правило перевода ошибки SQLite, заданное шагом дела. */
export const errorRuleSchema = z.object({
  match: z.string().refine(
    (s) => {
      try {
        new RegExp(s, 'i')
        return true
      } catch {
        return false
      }
    },
    { message: 'не компилируется как регулярное выражение' },
  ),
  say: z.string().min(1),
})

export const checkModeSchema = z.enum(['resultset', 'schema', 'rowcount'])

export const checkSchema = z
  .object({
    mode: checkModeSchema,
    /** Учитывать порядок строк при сравнении. */
    ordered: z.boolean().default(false),
    /** Перепроверить ответ на базе из `db.shadow_seed`. */
    shadow: z.boolean().default(false),
    /** Конструкции, которые задумано применить: их отсутствие — замечание, не ошибка. */
    require: z.array(z.string()).default([]),
    forbid: z.array(z.string()).default([]),
    /** Таблица для `mode: schema`. */
    table: z.string().nullable().default(null),
  })
  .refine((c) => c.mode !== 'schema' || c.table !== null, {
    message: 'при mode "schema" нужно указать table',
    path: ['table'],
  })

export const stepSchema = z.object({
  id: z.string().min(1),
  brief: z.string().min(1),
  theory: z.string().default(''),
  /** Эталонный запрос. Игроку не показывается. */
  solution: z.string().min(1),
  check: checkSchema,
  hints: z.array(z.string()).default([]),
  errors: z.array(errorRuleSchema).default([]),
  outro: z.string().default(''),
})

export const dbSchema = z.object({
  schema: z.string().min(1),
  seed: z.string().default(''),
  /** Те же таблицы, другие значения. Нужен, если хоть один шаг просит `check.shadow`. */
  shadow_seed: z.string().optional(),
  /**
   * База не пересоздаётся между шагами: шаг видит изменения предыдущих.
   * Поведение реализуется в фазе 2, поле объявлено заранее, чтобы не поднимать format_version.
   */
  persist_between_steps: z.boolean().default(false),
})

export const caseSchema = z
  .object({
    format_version: z.literal(1),
    id: z.string().regex(/^\d{2}$/, 'ожидается две цифры, например "00"'),
    title: z.string().min(1),
    topic: z.string().min(1),
    db: dbSchema,
    intro: z.string().default(''),
    steps: z.array(stepSchema).min(1),
    epilogue: z.string().default(''),
  })
  .superRefine((c, ctx) => {
    const seen = new Set<string>()
    c.steps.forEach((step, i) => {
      if (seen.has(step.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `id шага "${step.id}" уже занят`,
          path: ['steps', i, 'id'],
        })
      }
      seen.add(step.id)

      if (step.check.shadow && c.db.shadow_seed === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'шаг просит shadow-проверку, но в db нет shadow_seed',
          path: ['steps', i, 'check', 'shadow'],
        })
      }
    })
  })

export type ErrorRule = z.infer<typeof errorRuleSchema>
export type CheckMode = z.infer<typeof checkModeSchema>
export type Check = z.infer<typeof checkSchema>
export type Step = z.infer<typeof stepSchema>
export type CaseDb = z.infer<typeof dbSchema>
export type Case = z.infer<typeof caseSchema>
