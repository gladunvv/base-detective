import { useEffect, useState } from 'react'
import { CaseLoadError, loadCase } from './core/caseLoader.ts'
import type { Case } from './core/types.ts'
import { CaseView } from './ui/CaseView.tsx'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; kase: Case }

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    loadCase('00')
      .then((kase) => setState({ status: 'ready', kase }))
      .catch((error: unknown) => {
        const message = error instanceof CaseLoadError ? error.message : String(error)
        setState({ status: 'error', message })
      })
  }, [])

  if (state.status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink font-sans text-paper">Загрузка дела…</main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink p-6 font-sans text-stamp">
        {state.message}
      </main>
    )
  }

  return <CaseView kase={state.kase} />
}

export default App
