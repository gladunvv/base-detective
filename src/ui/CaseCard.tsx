import { Link } from 'react-router'

type CaseCardProps = {
  id: string
  /** `undefined`, пока заголовок ещё не загружен; для закрытых дел не запрашивается вовсе. */
  title?: string
  unlocked: boolean
  completed: boolean
}

/**
 * Три состояния папки (дизайн-документ, §4). Недоступная папка не получает
 * заголовка даже в props — имя дела спойлерит интригу.
 */
export function CaseCard({ id, title, unlocked, completed }: CaseCardProps) {
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
      className="relative flex aspect-4/3 flex-col justify-between rounded bg-folder p-3 text-ink outline-offset-2 hover:brightness-95"
    >
      <span className="font-mono text-xs">ДЕЛО № {id}</span>
      <span className="font-sans text-sm font-semibold">{title ?? '…'}</span>
      {completed && (
        <span className="absolute top-2 right-2 -rotate-6 rounded border-2 border-stamp px-1 py-0.5 font-mono text-[10px] font-bold text-stamp">
          ЗАКРЫТО
        </span>
      )}
    </Link>
  )
}
