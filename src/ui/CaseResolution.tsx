import { useEffect, useRef, useState } from 'react'
import type { Case } from '../core/types.ts'

type CaseResolutionProps = {
  resolution: NonNullable<Case['resolution']>
  evidence: { id: string; text: string; stepNumber: number }[]
  feedback: string | null
  onSubmit: (optionId: string, evidenceIds: string[]) => void
}

export function CaseResolution({ resolution, evidence, feedback, onSubmit }: CaseResolutionProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [optionId, setOptionId] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <form
      className="flex flex-col gap-4 rounded bg-paper p-4 font-sans text-sm text-ink"
      onSubmit={(event) => {
        event.preventDefault()
        if (optionId) onSubmit(optionId, selected)
      }}
    >
      <h2 ref={heading} tabIndex={-1} className="font-mono text-base font-bold">
        {resolution.prompt}
      </h2>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-bold">Выберите версию</legend>
        {resolution.options.map(({ id, text }) => (
          <label key={id} className="flex cursor-pointer items-start gap-2 rounded border border-ink/30 p-3">
            <input
              type="radio"
              name="resolution-option"
              checked={optionId === id}
              onChange={() => setOptionId(id)}
              className="mt-1 shrink-0 accent-ink"
            />
            <span>{text}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-bold">Отметьте улики, которые прямо подтверждают версию</legend>
        {evidence.map(({ id, text, stepNumber }) => (
          <label key={id} className="flex cursor-pointer items-start gap-2 rounded border border-ink/30 p-3">
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={(event) => {
                const checked = event.currentTarget.checked
                setSelected((previous) => checked ? [...previous, id] : previous.filter((value) => value !== id))
              }}
              className="mt-1 shrink-0 accent-ink"
            />
            <span>{text} <span className="block text-xs">Шаг {stepNumber}</span></span>
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={!optionId}
        className="self-start rounded bg-ink px-3 py-2 font-semibold text-paper disabled:opacity-50"
      >
        Проверить версию
      </button>
      {feedback && <p role="status">{feedback}</p>}
    </form>
  )
}
