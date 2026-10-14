import { useState } from 'react'
import { useCheatsheet, type CheatEntry } from './cheatsheet.ts'
import { Markdown } from './markdown.tsx'

/**
 * Дедова шпаргалка из верхнего ящика — панель поверх экрана дела, как схема базы.
 * Именно панель, а не страница: уход со страницы стоил бы игроку места в деле,
 * а на двенадцати шагах это вся работа за вечер.
 *
 * Непройденные конструкции видны, но не раскрываются. Прятать их хуже: список
 * превращается в обрубок, и не видно, куда ведёт курс. Название конструкции
 * само по себе ничего не выдаёт.
 */
export function CheatSheet({ learned }: { learned: string[] }) {
  const [open, setOpen] = useState(false)
  const { entries, failed } = useCheatsheet()

  const groups = entries ? [...new Map(entries.map((e) => [e.group, e.group])).keys()] : []

  return (
    <div className="contents">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-w-36 self-start rounded border border-folder/60 px-2 py-1 text-center font-sans text-sm text-folder"
      >
        {open ? 'Убрать шпаргалку' : 'Шпаргалка'}
      </button>

      {open && (
        <div className="order-last flex basis-full flex-col gap-4 rounded border border-glow/30 bg-screen p-3">
          {failed && <p className="font-mono text-xs text-glow">Шпаргалку не удалось загрузить.</p>}
          {!entries && !failed && <p className="font-mono text-xs text-glow">Открываем верхний ящик…</p>}

          {groups.map((group) => (
            <section key={group} className="flex flex-col gap-1">
              <h3 className="font-mono text-xs tracking-wide text-folder uppercase">{group}</h3>
              {entries
                ?.filter((entry) => entry.group === group)
                .map((entry) =>
                  learned.includes(entry.id) ? (
                    <Known key={entry.id} entry={entry} />
                  ) : (
                    <p key={entry.id} className="font-mono text-xs text-folder/85">
                      {entry.title} — ещё не проходили
                    </p>
                  ),
                )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/** `details` вместо своего раскрывашки: клавиатура и скринридер достаются бесплатно. */
function Known({ entry }: { entry: CheatEntry }) {
  return (
    <details className="font-mono text-xs text-glow">
      <summary className="cursor-pointer">{entry.title}</summary>
      <div className="mt-1 mb-2 flex flex-col gap-1 border-l-2 border-glow/30 pl-3">
        <Markdown text={entry.summary} className="font-sans text-paper" />
        <p className="text-folder">{entry.form}</p>
        <p className="text-folder">{entry.example}</p>
      </div>
    </details>
  )
}
