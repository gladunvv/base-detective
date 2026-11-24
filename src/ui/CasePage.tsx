import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { CaseLoadError, loadCase } from '../core/caseLoader.ts'
import type { ProgressStore } from '../core/storage.ts'
import type { Case } from '../core/types.ts'
import { analytics } from './analytics.ts'
import { CaseView } from './CaseView.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; kase: Case; resume: ReturnType<ProgressStore['resumeCase']> }

/**
 * `id` — снаружи (см. `CaseRoute` в App.tsx), с `key={id}`: при переходе между
 * делами компонент пересоздаётся заново, а не переиспользуется с новым
 * пропом, — состояние загрузки не нужно сбрасывать вручную.
 */
export function CasePage({ id, storage }: { id: string; storage: ProgressStore }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // Выученное держим в состоянии: хранилище не реактивно, и без этого шпаргалка
  // показывала бы новую конструкцию только после следующего рендера.
  const [learned, setLearned] = useState(() => storage.getLearned())
  const handleReach = useCallback((teaches: string[]) => {
    setLearned(storage.learn(teaches))
  }, [storage])

  useEffect(() => {
    let active = true
    loadCase(id)
      .then((kase) => {
        if (!active) return
        const resume = storage.isUnlocked(id)
          ? storage.resumeCase(id, kase.progress_revision, kase.steps.length)
          : { index: 0, restarted: false }
        setState({ status: 'ready', kase, resume })
        analytics.caseOpened(kase.id)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof CaseLoadError && error.notFound) {
          setState({ status: 'missing' })
          return
        }
        const message = error instanceof CaseLoadError ? error.message : String(error)
        setState({ status: 'error', message })
      })
    return () => { active = false }
  }, [id, storage])

  // Попытка зайти в дело раньше очереди — редирект в список, без объяснений
  // на этом экране: объяснение и так на месте, в виде перевязанной папки.
  if (!storage.isUnlocked(id)) {
    return <Navigate to="/archive" replace />
  }

  if (state.status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink font-sans text-paper">Загрузка дела…</main>
    )
  }

  // Дела с таким номером нет — это 404, а не поломка. Сломанный файл (следующая
  // ветка) показывает техническую причину: она нужна автору дела, не игроку.
  if (state.status === 'missing') {
    return <NotFoundPage />
  }

  if (state.status === 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink p-6 font-sans text-paper">
        {state.message}
      </main>
    )
  }

  return (
    <CaseView
      kase={state.kase}
      initialStep={state.resume.index}
      restarted={state.resume.restarted}
      onStepChange={(index) => storage.setStep(id, index, state.kase.progress_revision)}
      onReach={handleReach}
      learned={learned}
      onFinished={() => storage.completeCase(id)}
    />
  )
}
