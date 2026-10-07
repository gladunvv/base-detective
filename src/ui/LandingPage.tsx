import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { loadCase, loadCaseManifest } from '../core/caseLoader.ts'
import type { ProgressStore } from '../core/storage.ts'

const VISITED_KEY = 'bd:visited'

/**
 * «Уже заходил» — состояние экрана, а не прогресс игры, поэтому живёт отдельным
 * ключом, как и раскрытые подсказки. В `storage.ts` ему не место: там прогресс
 * по делам, и он единственный, у кого завтра может появиться HTTP-бэкенд.
 *
 * Опираться на пройденные дела было бы неверно: тот, кто начал первое дело и не
 * дошёл до конца, не считается новым посетителем, хотя в прогрессе у него пусто.
 */
function wasHereBefore(): boolean {
  try {
    return localStorage.getItem(VISITED_KEY) !== null
  } catch {
    return false
  }
}

function rememberVisit(): void {
  try {
    localStorage.setItem(VISITED_KEY, '1')
  } catch {
    // приватный режим или переполненная квота — просто покажем загрузку ещё раз
  }
}

const BOOT_LINES = [
  'БАЗА-1 · ОЗУ 640К · ПРОВЕРКА... ОК',
  'Подключение к архиву... ОК',
  'Новых записей с последнего входа: 3',
  'Найдено непрочитанное сообщение.',
]

const LETTER = [
  'Если ты это читаешь — контора теперь твоя. Вывеску не меняй, к ней в городе привыкли.',
  'Опыта у тебя немного. Не беда: у меня его поначалу тоже не было. Зато была вот эта машина.',
  'Не спрашивай, откуда в ней берутся записи. Я сорок лет пытался понять, а потом просто научился задавать ей правильные вопросы. Она понимает только один язык — шпаргалка в верхнем ящике.',
  'Клиенты приходят с утра. Не заставляй их ждать.',
]

const LINE_DELAY_MS = 550

/** Загрузка проигрывается только новичку и только если движение не выключено системно. */
function shouldPlayBoot(): boolean {
  if (wasHereBefore()) return false
  try {
    return !matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

export function LandingPage({ storage }: { storage: ProgressStore }) {
  // Глобальное правило в index.css гасит только CSS-анимации; последовательность
  // на таймерах оно не остановит, поэтому решение принимается здесь, в JS.
  const [playing, setPlaying] = useState(shouldPlayBoot)
  const [shownLines, setShownLines] = useState(() => (shouldPlayBoot() ? 0 : BOOT_LINES.length))
  const navigate = useNavigate()

  const done = !playing
  useEffect(() => {
    rememberVisit()
  }, [])

  // Строки загрузки по одной.
  useEffect(() => {
    if (!playing) return
    if (shownLines >= BOOT_LINES.length) {
      const id = setTimeout(() => setPlaying(false), LINE_DELAY_MS)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setShownLines((n) => n + 1), LINE_DELAY_MS)
    return () => clearTimeout(id)
  }, [playing, shownLines])

  // Пропуск: любой клик или клавиша досматривают загрузку до конца.
  useEffect(() => {
    if (!playing) return
    const skip = () => {
      setShownLines(BOOT_LINES.length)
      setPlaying(false)
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [playing])

  // Enter запускает запрос, когда письмо уже на экране. Если фокус стоит на самой
  // ссылке или кнопке, браузер нажмёт её сам — второй раз уводить не нужно.
  useEffect(() => {
    if (!done) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey) return
      const active = document.activeElement
      if (active instanceof HTMLAnchorElement || active instanceof HTMLButtonElement) return
      navigate('/archive')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, navigate])

  return (
    <main className="min-h-dvh bg-ink">
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-12 sm:py-16">
        <header className="text-center">
          <h1 className="font-mono text-3xl font-bold text-paper sm:text-5xl">Base Detective</h1>
          <p className="mt-2 font-sans text-sm text-folder sm:text-base">Улики не врут. Таблицы тоже.</p>
        </header>

        <Monitor>
          {playing ? (
            <BootLines count={shownLines} />
          ) : (
            <>
              <Letter />
              <CommandLink />
            </>
          )}
        </Monitor>

        <ResumeButton storage={storage} />
      </section>

      <Facts />
      <Footer />
    </main>
  )
}

/** Корпус старого монитора: рамка и подставка — CSS, без единого файла-картинки. */
function Monitor({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full">
      <div className="rounded-xl border-4 border-folder/40 bg-ink p-2 shadow-[inset_0_0_0_2px_--theme(--color-ink)] sm:p-3">
        <div className="min-h-[19rem] rounded-lg bg-screen p-4 sm:min-h-[22rem] sm:p-6">{children}</div>
      </div>
      <div className="mx-auto h-3 w-24 rounded-b bg-folder/40" />
      <div className="mx-auto h-1.5 w-40 rounded bg-folder/30" />
    </div>
  )
}

function BootLines({ count }: { count: number }) {
  return (
    <ol className="flex flex-col gap-2 font-mono text-xs text-glow sm:text-sm">
      {BOOT_LINES.slice(0, count).map((line) => (
        <li key={line} className="animate-[reveal_.3s_ease-out]">
          {line}
        </li>
      ))}
    </ol>
  )
}

function Letter() {
  return (
    <div className="flex flex-col gap-3 font-mono text-xs leading-relaxed text-paper sm:text-sm">
      {LETTER.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p className="text-folder">— Дед</p>
      <p className="text-folder">P.S. Если придёт человек насчёт гуся — это не шутка.</p>
    </div>
  )
}

/** Главная кнопка притворяется командной строкой, но остаётся обычной ссылкой. */
function CommandLink() {
  return (
    <Link
      to="/archive"
      aria-label="Открыть архив дел"
      className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded font-mono text-xs text-glow sm:text-sm"
    >
      <span aria-hidden="true">&gt;</span>
      <span>SELECT * FROM дела WHERE статус = 'открыто';</span>
      <span aria-hidden="true" className="inline-block h-4 w-2 animate-[blink_1.1s_step-end_infinite] bg-glow" />
      <span aria-hidden="true" className="ml-auto text-folder">
        Enter ↵
      </span>
    </Link>
  )
}

/** Первое незакрытое из открытых дел. Появляется не сразу: нужны манифест и само дело. */
function ResumeButton({ storage }: { storage: ProgressStore }) {
  const [next, setNext] = useState<{ id: string; title: string } | null>(null)
  // Прогресс читается один раз при монтировании — на этом экране он не меняется.
  const completed = useRef(storage.getProgress().completed).current

  useEffect(() => {
    if (completed.length === 0) return
    let cancelled = false
    void loadCaseManifest()
      .then(async (ids) => {
        const id = ids.find((candidate) => storage.isUnlocked(candidate) && !completed.includes(candidate))
        if (id === undefined) return
        const kase = await loadCase(id)
        if (!cancelled) setNext({ id, title: kase.title })
      })
      .catch(() => {
        // не удалось узнать название — просто не показываем кнопку
      })
    return () => {
      cancelled = true
    }
  }, [completed, storage])

  if (!next) return null

  return (
    <Link
      to={`/case/${next.id}`}
      className="rounded border border-folder px-4 py-2 font-sans text-sm text-folder transition-transform duration-200 hover:-translate-y-0.5"
    >
      Продолжить: {next.title}
    </Link>
  )
}

function Facts() {
  const facts = [
    'Прямо в браузере, без регистрации',
    'Настоящий SQLite — запрос выполняется по-честному',
    'Теория встроена в каждое дело',
  ]
  return (
    <section className="mx-auto grid w-full max-w-4xl gap-3 px-4 pb-10 sm:grid-cols-3">
      {facts.map((fact) => (
        <p key={fact} className="rounded border border-folder/30 p-3 font-sans text-sm text-folder">
          {fact}
        </p>
      ))}
    </section>
  )
}

function Footer() {
  return (
    <footer className="mx-auto w-full max-w-4xl px-4 pb-10 font-sans text-xs text-folder">
      <a href="https://github.com/gladunvv/base-detective" className="underline">
        Исходный код на GitHub
      </a>
      <p className="mt-1">Код — MIT, тексты и дела — CC BY-SA 4.0.</p>
    </footer>
  )
}
