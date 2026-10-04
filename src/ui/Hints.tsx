type HintsProps = {
  hints: string[]
  revealed: number
  onReveal: () => void
}

/**
 * Подсказки лежат в деле как вымаранный документ: текст замылен, пока игрок сам
 * его не откроет. Открывает клик, а не наведение: мышь проходит по бумаге и так,
 * и на ховере подсказка выдавалась бы случайно — а на тач-экранах `:hover`
 * не срабатывает вовсе, и подсказка была бы недостижима с телефона.
 *
 * Открытая подсказка ничего не отнимает и нигде не учитывается — штрафы за
 * подсказки отучают ими пользоваться. Персистентность (переживает перезагрузку)
 * обеспечивает вызывающий код через revealed/onReveal.
 */
export function Hints({ hints, revealed, onReveal }: HintsProps) {
  if (hints.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-mono text-sm font-bold tracking-wide uppercase">Улики</h2>
      {/* Замыленная строка не выглядит интерактивной — подсказываем ровно до первого раза. */}
      {revealed === 0 && <p className="font-sans text-xs text-ink/70">Нажмите на строку, чтобы прочитать.</p>}
      <ol className="flex flex-col gap-2 font-sans text-sm text-ink/90">
        {hints.map((hint, i) => (
          <li key={i}>
            {i < revealed ? (
              <span className="animate-[reveal_.5s_ease-out]">— {hint}</span>
            ) : i === revealed ? (
              // Текст скрыт и от скринридера: замыливание — приём чисто визуальный,
              // без этого подсказка читалась бы вслух, не будучи открытой.
              <button
                type="button"
                onClick={onReveal}
                aria-label={`Открыть подсказку ${i + 1} из ${hints.length}`}
                className="block rounded text-left blur-[3.5px] transition-[filter] duration-300 select-none hover:bg-ink/10"
              >
                <span aria-hidden="true">— {hint}</span>
              </button>
            ) : (
              // Дальние подсказки не открываются через голову ближней — ни кликом, ни с клавиатуры.
              <span aria-hidden="true" className="block blur-[3.5px] opacity-50 select-none">
                — {hint}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
