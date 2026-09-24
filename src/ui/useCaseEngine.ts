import { useEffect, useState } from 'react'
import { checkAnswer, type CheckVerdict } from '../core/checker.ts'
import { translateError } from '../core/errorDict.ts'
import { SqlRunner } from '../core/sqlRunner.ts'
import type { RunOutcome, SqlResult } from '../core/sqlite.ts'
import type { Case, Step } from '../core/types.ts'
import { analytics } from './analytics.ts'
import { fetchSchemaInfo, type SchemaInfo } from './schemaInfo.ts'

export type Outcome =
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'result'; result: SqlResult }

type HintsState = Record<string, number>

function hintsKey(caseId: string): string {
  return `bd:hints:${caseId}`
}

function loadHints(caseId: string): HintsState {
  try {
    const raw = localStorage.getItem(hintsKey(caseId))
    return raw ? (JSON.parse(raw) as HintsState) : {}
  } catch {
    return {}
  }
}

function saveHints(caseId: string, state: HintsState): void {
  try {
    localStorage.setItem(hintsKey(caseId), JSON.stringify(state))
  } catch {
    // приватный режим браузера или переполненная квота — подсказки просто не переживут перезагрузку
  }
}

/** Разовый исполнитель для проверки: своя свежая база на каждый вызов, воркер закрывается сразу после. */
function makeFreshExecutor(schema: string, seed: string) {
  return async (sql: string): Promise<RunOutcome> => {
    const runner = new SqlRunner({ schema, seed })
    try {
      return await runner.exec(sql)
    } finally {
      runner.dispose()
    }
  }
}

export function useCaseEngine(kase: Case, options: { onFinished?: () => void } = {}) {
  // Инициализатор useState вызывается один раз — раннер создаётся ровно
  // один раз на дело, без чтения/записи ref во время рендера.
  const [runner] = useState(() => new SqlRunner({ schema: kase.db.schema, seed: kase.db.seed }))

  const [schema, setSchema] = useState<SchemaInfo>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [sql, setSql] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [verdict, setVerdict] = useState<CheckVerdict | null>(null)
  const [hints, setHints] = useState<HintsState>(() => loadHints(kase.id))
  const [finished, setFinished] = useState(false)

  const step: Step | undefined = kase.steps[stepIndex]
  const accepted = verdict?.verdict === 'accepted'
  // После отказа поле и кнопки заблокированы до «Попробовать ещё раз».
  const rejected = verdict !== null && !accepted

  useEffect(() => {
    runner.reopen()
    void fetchSchemaInfo((s) => runner.exec(s)).then(setSchema)
    return () => runner.dispose()
  }, [runner])

  /** Просто выполняет запрос — поиграть с данными. Ничего не проверяет. */
  async function run(): Promise<void> {
    if (!step || busy || rejected) return

    setBusy(true)
    const live = await runner.exec(sql)
    if (!live.ok) {
      setOutcome({ kind: 'error', message: translateError(live.error, step.errors) })
      analytics.queryFailed(kase.id, step.id)
    } else if (live.result.rows.length === 0) {
      setOutcome({ kind: 'empty' })
    } else {
      setOutcome({ kind: 'result', result: live.result })
    }
    setBusy(false)
  }

  /** Сдаёт текущий текст запроса на проверку. */
  async function submit(): Promise<void> {
    if (!step || busy || verdict || sql.trim() === '') return

    setBusy(true)
    const runOnMain = makeFreshExecutor(kase.db.schema, kase.db.seed)
    const runOnShadow =
      step.check.shadow && kase.db.shadow_seed !== undefined
        ? makeFreshExecutor(kase.db.schema, kase.db.shadow_seed)
        : undefined
    const result = await checkAnswer({ step, playerSql: sql, runOnMain, runOnShadow })

    setVerdict(result)
    if (result.verdict === 'accepted') {
      analytics.stepSolved(kase.id, step.id, stepIndex + 1)
    }
    setBusy(false)
  }

  /** Снимает штамп «Отказано» и сворачивает подсказки шага; текст запроса и результат на мониторе остаются. */
  function retry(): void {
    if (!step || !rejected) return
    setVerdict(null)
    const next = { ...hints, [step.id]: 0 }
    setHints(next)
    saveHints(kase.id, next)
  }

  async function resetDatabase(): Promise<void> {
    await runner.reset()
    setOutcome(null)
  }

  function advance(): void {
    if (!accepted) return
    const next = stepIndex + 1
    setSql('')
    setOutcome(null)
    setVerdict(null)
    if (next >= kase.steps.length) {
      setFinished(true)
      analytics.caseFinished(kase.id)
      options.onFinished?.()
      return
    }
    setStepIndex(next)
    // При persist_between_steps: false каждый шаг начинается с чистой базы —
    // иначе игрок унёс бы в новый шаг мутации, сделанные при исследовании прошлого.
    if (!kase.db.persist_between_steps) {
      void runner.reset()
    }
  }

  function revealHint(): void {
    if (!step) return
    // Считаем и пишем снаружи updater'а: React может вызвать его дважды
    // (StrictMode), а событие аналитики и запись в localStorage — побочные
    // эффекты, которые от этого задвоились бы.
    const current = hints[step.id] ?? 0
    if (current >= step.hints.length) return

    const next = { ...hints, [step.id]: current + 1 }
    setHints(next)
    saveHints(kase.id, next)
    analytics.hintRevealed(kase.id, step.id, current + 1)
  }

  return {
    step,
    stepNumber: stepIndex + 1,
    totalSteps: kase.steps.length,
    finished,
    schema,
    sql,
    setSql,
    outcome,
    busy,
    verdict,
    accepted,
    rejected,
    run,
    submit,
    retry,
    resetDatabase,
    advance,
    hintsRevealed: step ? (hints[step.id] ?? 0) : 0,
    revealHint,
  }
}
