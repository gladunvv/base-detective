import type { Case } from '../core/types.ts'
import { Hints } from './Hints.tsx'
import { Markdown } from './markdown.tsx'
import type { useCaseEngine } from './useCaseEngine.ts'

type CasePanelProps = {
  kase: Case
  engine: ReturnType<typeof useCaseEngine>
}

/**
 * Левая колонка — бумага: комикс (не в MVP), завязка, задание, улики. Здесь же
 * бьёт штамп «Принято»/«Отказано» — по дизайн-документу штамп ложится на лист,
 * а не на монитор.
 */
export function CasePanel({ kase, engine }: CasePanelProps) {
  const { step, stepNumber, totalSteps, finished, outcome, accepted, hintsRevealed, revealHint, advance } = engine

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-folder p-6 text-ink">
      <header className="font-mono">
        <p className="text-sm">
          ДЕЛО № {kase.id} · шаг {Math.min(stepNumber, totalSteps)} из {totalSteps}
        </p>
        <h1 className="text-xl font-bold">{kase.title}</h1>
      </header>

      <Markdown text={kase.intro} className="font-sans text-sm leading-relaxed" />

      {finished ? (
        <section className="flex flex-col gap-2 rounded bg-paper p-4">
          <Markdown text={kase.epilogue} className="font-sans text-sm leading-relaxed" />
        </section>
      ) : step ? (
        <section className="flex flex-col gap-4 rounded bg-paper p-4">
          <div>
            <h2 className="font-mono text-sm font-bold tracking-wide uppercase">Задание</h2>
            <Markdown text={step.brief} className="font-sans text-sm leading-relaxed" />
          </div>

          {step.theory.trim() !== '' && (
            <div>
              <h2 className="font-mono text-sm font-bold tracking-wide uppercase">Теория</h2>
              <Markdown text={step.theory} className="max-w-[70ch] font-sans text-sm leading-relaxed" />
            </div>
          )}

          <Hints hints={step.hints} revealed={hintsRevealed} onReveal={revealHint} />

          {outcome?.kind === 'error' && <Stamp kind="rejected" text={outcome.message} />}
          {outcome?.kind === 'result' && outcome.verdict.verdict === 'rejected' && (
            <Stamp kind="rejected" text={outcome.verdict.reason} />
          )}
          {outcome?.kind === 'result' && outcome.verdict.verdict === 'error' && (
            <Stamp kind="rejected" text={outcome.verdict.error} />
          )}

          {accepted && (
            <div className="flex flex-col gap-3">
              <Stamp
                kind="accepted"
                text={
                  outcome?.kind === 'result' && outcome.verdict.verdict === 'accepted'
                    ? outcome.verdict.note
                    : undefined
                }
              />
              {step.outro.trim() !== '' && <Markdown text={step.outro} className="font-sans text-sm leading-relaxed" />}
              <button
                type="button"
                onClick={advance}
                className="self-start rounded bg-ink px-3 py-1 font-sans text-sm text-paper"
              >
                {stepNumber < totalSteps ? 'Далее' : 'Закрыть дело'}
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

function Stamp({ kind, text }: { kind: 'accepted' | 'rejected'; text?: string }) {
  const label = kind === 'accepted' ? 'ПРИНЯТО' : 'ОТКАЗАНО'
  return (
    <div className="flex flex-col items-start gap-1">
      <p
        className="w-fit -rotate-3 border-4 border-stamp px-3 py-1 font-mono text-lg font-bold tracking-widest text-stamp"
        role="status"
      >
        {label}
      </p>
      {text && <p className="font-mono text-sm text-stamp">{text}</p>}
    </div>
  )
}
