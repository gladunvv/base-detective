import { useEffect, useState } from 'react'
import { CaseLoadError, loadCase, loadCaseManifest } from '../core/caseLoader.ts'
import type { ProgressStore } from '../core/storage.ts'
import { CaseCard } from './CaseCard.tsx'

export function CaseListPage({ storage }: { storage: ProgressStore }) {
  const [ids, setIds] = useState<string[] | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [cardInfo, setCardInfo] = useState<Record<string, { title: string; coverImage?: string }>>({})
  // localStorage не оповещает о своих изменениях — после сброса прогресса
  // перечитываем его нарочно, бампая эту переменную.
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    loadCaseManifest()
      .then(setIds)
      .catch((error: unknown) => {
        setManifestError(error instanceof CaseLoadError ? error.message : String(error))
      })
  }, [])

  useEffect(() => {
    if (!ids) return
    for (const id of ids) {
      if (!storage.isUnlocked(id) || cardInfo[id] !== undefined) continue
      void loadCase(id).then((kase) =>
        setCardInfo((prev) => ({ ...prev, [id]: { title: kase.title, coverImage: kase.cover_image } })),
      )
    }
    // cardInfo намеренно не в зависимостях: используется только чтобы не перезапрашивать
    // уже известные данные, а не как повод перезапускать сам эффект.
  }, [ids, refreshKey, storage])

  function handleReset(): void {
    if (!confirm('Сбросить весь прогресс? Это нельзя отменить.')) return
    storage.resetProgress()
    setRefreshKey((k) => k + 1)
  }

  const progress = storage.getProgress()

  return (
    <div className="min-h-dvh bg-ink p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-mono text-2xl font-bold text-paper">Base Detective</h1>
        <button
          type="button"
          onClick={handleReset}
          className="rounded border border-folder/60 px-3 py-1 font-sans text-sm text-folder"
        >
          Сбросить прогресс
        </button>
      </header>

      {manifestError && <p className="font-mono text-sm text-paper">{manifestError}</p>}

      {ids !== null && ids.length === 0 && (
        <p className="max-w-[46ch] font-sans text-sm text-folder">
          В архиве пока пусто — ни одного дела. Загляните позже.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {ids?.map((id) => (
          <CaseCard
            key={id}
            id={id}
            title={cardInfo[id]?.title}
            coverImage={cardInfo[id]?.coverImage}
            unlocked={storage.isUnlocked(id)}
            completed={progress.completed.includes(id)}
          />
        ))}
      </div>
    </div>
  )
}
