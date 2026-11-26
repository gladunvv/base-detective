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

export const checkModeSchema = z.enum(['resultset', 'rowcount'])

export const checkSchema = z.object({
    mode: checkModeSchema,
    /** Учитывать порядок строк при сравнении. */
    ordered: z.boolean().default(false),
    /** Перепроверить ответ на базе из `db.shadow_seed`. */
    shadow: z.boolean().default(false),
    /** Конструкции, которые задумано применить: их отсутствие — замечание, не ошибка. */
    require: z.array(z.string()).default([]),
    forbid: z.array(z.string()).default([]),
    /**
     * Эталон возвращает ноль строк на seed и хотя бы одну на shadow_seed.
     */
    expect_empty: z.boolean().default(false),
  })

const caseText = z.string().trim().min(1)
const evidenceSchema = z.object({
  id: caseText,
  /** Короткий факт, который игрок получает после зачёта этого шага. */
  text: caseText,
})

const resolutionSchema = z.object({
  prompt: caseText,
  options: z.array(z.object({ id: caseText, text: caseText })).min(2),
  /** Эталон проверки. В интерфейсе показываются вопрос, варианты и открытые улики. */
  answer: z.object({
    option_id: caseText,
    evidence_ids: z.array(caseText).min(1),
  }),
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
  /** Путь под public/ (например, "/cases/images/02/s1.svg"). Появляется вместе со штампом «Принято». */
  image: z.string().optional(),
  /**
   * Про какие конструкции этот шаг — id записей из `public/cheatsheet.json`.
   * Связь идёт через название конструкции, а не через номер дела, поэтому
   * перенумерация дел её не ломает. Конструкция открывается в шпаргалке, как
   * только игрок до такого шага дошёл, и подписывается на экране дела.
   */
  teaches: z.array(z.string()).default([]),
  evidence: z.array(evidenceSchema).default([]),
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
    progress_revision: z.number().int().positive().default(1),
    id: z.string().regex(/^\d{2}$/, 'ожидается две цифры, например "00"'),
    title: z.string().min(1),
    topic: z.string().min(1),
    db: dbSchema,
    intro: z.string().default(''),
    steps: z.array(stepSchema).min(1),
    resolution: resolutionSchema.optional(),
    epilogue: z.string().default(''),
    /** Путь под public/, обложка карточки в списке дел. Без неё карточка просто без картинки. */
    cover_image: z.string().optional(),
    /** Путь под public/, финальный кадр дела. Показывается с эпилогом, после последнего шага. */
    epilogue_image: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    const seen = new Set<string>()
    const evidenceIds = new Set<string>()
    c.steps.forEach((step, i) => {
      if (seen.has(step.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `id шага "${step.id}" уже занят`,
          path: ['steps', i, 'id'],
        })
      }
      seen.add(step.id)

      step.evidence.forEach(({ id }, j) => {
        if (evidenceIds.has(id)) {
          ctx.addIssue({
            code: 'custom',
            message: `id улики "${id}" уже занят`,
            path: ['steps', i, 'evidence', j, 'id'],
          })
        }
        evidenceIds.add(id)
      })

      if (step.check.shadow && c.db.shadow_seed === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'шаг просит shadow-проверку, но в db нет shadow_seed',
          path: ['steps', i, 'check', 'shadow'],
        })
      }

      if (step.check.expect_empty && (step.check.mode !== 'resultset' || !step.check.shadow)) {
        ctx.addIssue({
          code: 'custom',
          message: 'expect_empty требует режим resultset и включённую shadow-проверку',
          path: ['steps', i, 'check', 'expect_empty'],
        })
      }
    })

    const resolution = c.resolution
    if (!resolution) return

    const optionIds = new Set<string>()
    resolution.options.forEach(({ id }, i) => {
      if (optionIds.has(id)) {
        ctx.addIssue({
          code: 'custom',
          message: `id версии "${id}" уже занят`,
          path: ['resolution', 'options', i, 'id'],
        })
      }
      optionIds.add(id)
    })

    if (!optionIds.has(resolution.answer.option_id)) {
      ctx.addIssue({
        code: 'custom',
        message: 'такой версии нет в вариантах ответа',
        path: ['resolution', 'answer', 'option_id'],
      })
    }

    const cited = new Set<string>()
    resolution.answer.evidence_ids.forEach((id, i) => {
      const path = ['resolution', 'answer', 'evidence_ids', i]
      if (!evidenceIds.has(id)) {
        ctx.addIssue({ code: 'custom', message: `улика "${id}" не найдена`, path })
      } else if (cited.has(id)) {
        ctx.addIssue({ code: 'custom', message: `улика "${id}" указана повторно`, path })
      }
      cited.add(id)
    })
  })

export type ErrorRule = z.infer<typeof errorRuleSchema>
export type CheckMode = z.infer<typeof checkModeSchema>
export type Check = z.infer<typeof checkSchema>
export type Step = z.infer<typeof stepSchema>
export type CaseDb = z.infer<typeof dbSchema>
export type Case = z.infer<typeof caseSchema>
