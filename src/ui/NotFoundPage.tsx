import { Link } from 'react-router'

/**
 * 404. Раньше несуществующий путь молча редиректил в список — человек не понимал,
 * промахнулся он ссылкой или дела больше нет.
 */
export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink p-6 text-center">
      <p className="font-mono text-5xl text-folder">404</p>
      <p className="max-w-[46ch] font-sans text-sm text-paper">
        Такой папки в архиве нет. Возможно, номер дела набран с ошибкой.
      </p>
      <Link to="/" className="rounded border border-folder px-3 py-1 font-sans text-sm text-folder">
        Вернуться к делам
      </Link>
    </main>
  )
}
