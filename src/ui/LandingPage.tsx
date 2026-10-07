import { Link } from 'react-router'

/**
 * Главная. Задаёт рамку всей игре: кто игрок, откуда у него чужие базы и что он
 * тут делает. Список дел живёт отдельно, на /archive — не на /cases, потому что
 * этот префикс в проде отдан самим файлам дел (см. рерайт в vercel.json).
 */
export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-ink p-6">
      <div className="mx-auto flex w-full max-w-[54ch] flex-col gap-6">
        <h1 className="font-mono text-3xl font-bold text-paper sm:text-4xl">Base Detective</h1>

        <section className="flex flex-col gap-4 rounded bg-paper p-6 font-sans text-sm leading-relaxed text-ink sm:text-base">
          <p>Вы молодой детектив и только что открыли своё дело — по стопам деда.</p>
          <p>Опыта пока немного, но усердия и желания помочь хватает с избытком.</p>
          <p>От деда достался старый компьютер, а в нём — огромная база данных, которая пополняется сама.</p>
          <p>Пора открывать двери для клиентов и распутывать городские неурядицы с помощью SQL.</p>
        </section>

        <Link
          to="/archive"
          className="self-start rounded bg-glow px-4 py-2 font-sans text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5"
        >
          Открыть архив дел
        </Link>
      </div>
    </main>
  )
}
