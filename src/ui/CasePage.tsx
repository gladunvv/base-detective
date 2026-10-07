import { useEffect, useState } from 'react'
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
  | { status: 'ready'; kase: Case }

/**
 * `id` — снаружи (см. `CaseRoute` в App.tsx), с `key={id}`: при переходе между
 * делами компонент пересоздаётся заново, а не переиспользуется с новым
 * пропом, — состояние загрузки не нужно сбрасывать вручную.
 */
export function CasePage({ id, storage }: { id: string; storage: ProgressStore }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    loadCase(id)
      .then((kase) => {
        setState({ status: 'ready', kase })
        analytics.caseOpened(kase.id)
      })
      .catch((error: unknown) => {
        if (error instanceof CaseLoadError && error.notFound) {
          setState({ status: 'missing' })
          return
        }
        const message = error instanceof CaseLoadError ? error.message : String(error)
        setState({ status: 'error', message })
      })
  }, [id])

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

  return <CaseView kase={state.kase} onFinished={() => storage.completeCase(id)} />
}
