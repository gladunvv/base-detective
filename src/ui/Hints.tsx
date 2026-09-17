type HintsProps = {
  hints: string[]
  revealed: number
  onReveal: () => void
}

/**
 * Подсказки открываются по одной, взятая ничего не отнимает и нигде не учитывается —
 * штрафы за подсказки отучают ими пользоваться. Персистентность (переживает
 * перезагрузку) обеспечивает вызывающий код через revealed/onReveal.
 */
export function Hints({ hints, revealed, onReveal }: HintsProps) {
  if (hints.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1 font-sans text-sm text-ink/90">
        {hints.slice(0, revealed).map((hint, i) => (
          <li key={i}>— {hint}</li>
        ))}
      </ol>
      {revealed < hints.length && (
        <button
          type="button"
          onClick={onReveal}
          className="self-start rounded border border-ink/40 px-2 py-1 font-sans text-sm text-ink"
        >
          Подсказка ({revealed + 1} из {hints.length})
        </button>
      )}
    </div>
  )
}
