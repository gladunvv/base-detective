import { Link } from 'react-router'
import type { Case } from '../core/types.ts'
import { useCheatsheet, titlesFor } from './cheatsheet.ts'
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
  const {
    step,
    stepNumber,
    totalSteps,
    stepTeaches,
    finished,
    verdict,
    accepted,
    hintsRevealed,
    revealHint,
    advance,
    retry,
  } = engine
  const { entries } = useCheatsheet()
  const teaches = titlesFor(stepTeaches, entries)

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-folder p-6 text-ink">
      <Link to="/archive" className="self-start font-sans text-sm underline">
        ← К списку дел
      </Link>

      <header className="font-mono">
        <p className="text-sm">
          ДЕЛО № {kase.id}
          {!finished && teaches.length > 0 && (
            <>
              {' · '}
              <span className="font-bold">{teaches.join(' + ')}</span>
            </>
          )}
        </p>
        <h1 className="text-xl font-bold">{kase.title}</h1>
        <StepDots current={Math.min(stepNumber, totalSteps)} total={totalSteps} finished={finished} />
      </header>

      <Markdown text={kase.intro} className="font-sans text-sm leading-relaxed" />

      {finished ? (
        <section className="flex flex-col gap-3 rounded bg-paper p-4">
          <Markdown text={kase.epilogue} className="font-sans text-sm leading-relaxed" />
          {kase.epilogue_image && (
            <img
              src={kase.epilogue_image}
              alt=""
              className="w-full max-w-sm animate-[reveal_1.2s_ease-out] rounded border border-ink/20"
            />
          )}
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

          {verdict && verdict.verdict !== 'accepted' && (
            <div className="flex flex-col gap-3">
              <Stamp kind="rejected" text={verdict.verdict === 'rejected' ? verdict.reason : verdict.error} />
              <button
                type="button"
                onClick={retry}
                className="self-start rounded bg-ink px-3 py-1 font-sans text-sm text-paper"
              >
                Попробовать ещё раз
              </button>
            </div>
          )}

          {accepted && (
            <div className="flex flex-col gap-3">
              <Stamp
                kind="accepted"
                text={verdict?.verdict === 'accepted' ? verdict.note : undefined}
              />
              {step.outro.trim() !== '' && <Markdown text={step.outro} className="font-sans text-sm leading-relaxed" />}
              {step.image && (
                <img
                  src={step.image}
                  alt=""
                  className="w-full max-w-sm animate-[reveal_1.2s_ease-out] rounded border border-ink/20"
                />
              )}
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

/**
 * Сколько шагов позади и сколько впереди — одним взглядом. Номер шага словами
 * рядом не пишется: это тот же факт во второй раз, а длину хвоста кружки
 * показывают лучше, чем число.
 *
 * Глазу достаётся ряд, скринридеру — та же строка, что была раньше в шапке;
 * тринадцать отдельных кружков он бы читал как тринадцать пустых элементов.
 * Кружки не кликабельны: движок не умеет открывать произвольный шаг, и прыжок
 * вперёд ломал бы проверку.
 */
function StepDots({ current, total, finished }: { current: number; total: number; finished: boolean }) {
  const done = finished ? total : current - 1
  return (
    <div
      className="mt-2 flex flex-wrap gap-1.5"
      role="img"
      aria-label={finished ? `Дело закрыто, шагов: ${total}` : `Шаг ${current} из ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            i < done
              ? 'size-2.5 rounded-full bg-ink'
              : i === done
                ? 'size-2.5 rounded-full border-2 border-ink'
                : 'size-2.5 rounded-full border border-ink/60'
          }
        />
      ))}
    </div>
  )
}

function Stamp({ kind, text }: { kind: 'accepted' | 'rejected'; text?: string }) {
  const label = kind === 'accepted' ? 'ПРИНЯТО' : 'ОТКАЗАНО'
  return (
    <div className="flex flex-col items-start gap-1">
      <p
        className="w-fit -rotate-3 border-4 border-stamp px-3 py-1 font-sans text-lg font-extrabold tracking-widest text-stamp"
        role="status"
      >
        {label}
      </p>
      {text && <p className="font-mono text-sm text-ink">{text}</p>}
    </div>
  )
}
