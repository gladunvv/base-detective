import { Link } from 'react-router'

type CaseCardProps = {
  id: string
  /** `undefined`, пока заголовок ещё не загружен; для закрытых дел не запрашивается вовсе. */
  title?: string
  /** Обложка дела. Приглушена, пока дело не пройдено — цвет открывается вместе со штампом «ЗАКРЫТО». */
  coverImage?: string
  unlocked: boolean
  completed: boolean
}

/**
 * Три состояния папки (дизайн-документ, §4). Недоступная папка не получает
 * заголовка даже в props — имя дела спойлерит интригу.
 */
export function CaseCard({ id, title, coverImage, unlocked, completed }: CaseCardProps) {
  if (!unlocked) {
    return (
      <div
        className="flex aspect-4/3 flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-folder/60 font-mono text-folder/70"
        aria-label={`Дело № ${id}, недоступно`}
      >
        <span className="text-lg font-bold">№ {id}</span>
        <span className="text-xs tracking-wide">недоступно</span>
      </div>
    )
  }

  return (
    <Link
      to={`/case/${id}`}
      className="group @container relative flex aspect-4/3 flex-col justify-between rounded p-3 text-ink outline-offset-2 transition-transform duration-300 hover:-translate-y-1"
    >
      {/*
       * Листы внутри папки. Лежат под обложкой и выезжают вверх сильнее, чем
       * поднимается сама карточка, — поэтому на ховере выглядывают из-за неё.
       * Тень для объёма здесь не годится: список лежит на почти чёрном ink,
       * и чёрную полупрозрачную тень на нём не видно.
       */}
      <span
        aria-hidden="true"
        className="absolute inset-x-4 top-0 h-2/3 translate-y-2 -rotate-2 rounded-sm bg-paper transition-transform duration-300 group-hover:-translate-y-4 group-focus-visible:-translate-y-4"
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-7 top-0 h-2/3 translate-y-2 rotate-3 rounded-sm bg-paper/80 transition-transform duration-300 group-hover:-translate-y-2.5 group-focus-visible:-translate-y-2.5"
      />

      {/* Лицевая сторона папки. Внутренняя тень снизу читается как толщина картона. */}
      <span className="absolute inset-0 overflow-hidden rounded bg-folder shadow-[inset_0_-6px_0_--theme(--color-ink/0.18)]">
        {coverImage && (
          <img
            src={coverImage}
            alt=""
            className={`h-full w-full object-cover transition-[filter] duration-700 ${
              completed ? '' : 'grayscale-[.65] brightness-90'
            }`}
          />
        )}
      </span>

      <span className="relative w-fit rounded bg-folder/90 px-1 font-mono text-xs">ДЕЛО № {id}</span>
      <span className="relative w-fit rounded bg-folder/90 px-1 font-sans text-sm font-semibold">{title ?? '…'}</span>
      {completed && (
        <span className="absolute top-2 right-2 -rotate-6 rounded border-3 border-stamp px-1 py-0.5 text-[8cqw] font-sans font-extrabold stamp-ink text-stamp">
          ЗАКРЫТО
        </span>
      )}
    </Link>
  )
}
