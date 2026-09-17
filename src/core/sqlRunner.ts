/**
 * Обёртка над воркером с sql.js. sql.js синхронный: тяжёлый запрос в основном потоке
 * вешает вкладку без возможности что-то нажать, поэтому база живёт в воркере,
 * а здесь стоит таймаут и право этот воркер убить.
 */

export type SqlValue = number | string | Uint8Array | null

export type SqlResult = {
  columns: string[]
  rows: SqlValue[][]
}

export type RunOutcome = { ok: true; result: SqlResult } | { ok: false; error: string }

export type WorkerRequest =
  | { id: number; type: 'init'; schema: string; seed: string }
  | { id: number; type: 'exec'; sql: string }

export type WorkerResponse =
  | { id: number; ok: true; result: SqlResult }
  | { id: number; ok: false; error: string }

export type RunnerDb = {
  schema: string
  seed: string
}

export const TIMEOUT_MESSAGE =
  'Запрос слишком тяжёлый и был остановлен. Скорее всего, таблицы соединились без условия.'

const TIMEOUT_MS = 5000

const EMPTY_RESULT: SqlResult = { columns: [], rows: [] }

type Pending = {
  id: number
  resolve: (outcome: RunOutcome) => void
  timer: ReturnType<typeof setTimeout>
}

export class SqlRunner {
  #db: RunnerDb
  #worker: Worker | null = null
  #pending: Pending | null = null
  #nextId = 1
  /** Запросы идут по одному: убийство воркера по таймауту рвёт всё разом. */
  #chain: Promise<unknown> = Promise.resolve()
  #disposed = false

  constructor(db: RunnerDb) {
    this.#db = db
  }

  /** Выполняет запрос игрока. Не бросает: ошибка приходит в `RunOutcome`. */
  exec(sql: string): Promise<RunOutcome> {
    return this.#enqueue(async () => {
      const init = await this.#initIfNeeded()
      if (init && !init.ok) return init
      return this.#request({ id: this.#nextId++, type: 'exec', sql })
    })
  }

  /** Пересоздаёт базу из `schema` и `seed`, теряя всё, что игрок успел в неё записать. */
  reset(): Promise<RunOutcome> {
    this.#kill({ ok: false, error: 'База пересоздана, предыдущий запрос отменён.' })
    return this.#enqueue(async () => (await this.#initIfNeeded()) ?? { ok: true, result: EMPTY_RESULT })
  }

  /** Воркер и база живут ровно столько, сколько открыто дело. */
  dispose(): void {
    this.#disposed = true
    this.#kill({ ok: false, error: 'Движок базы остановлен.' })
  }

  #enqueue(task: () => Promise<RunOutcome>): Promise<RunOutcome> {
    const outcome = this.#chain.then(() =>
      this.#disposed ? { ok: false as const, error: 'Движок базы уже остановлен.' } : task(),
    )
    this.#chain = outcome.catch(() => {})
    return outcome
  }

  /** `null`, если база уже поднята. Воркер создаётся лениво — в том числе заново после таймаута. */
  #initIfNeeded(): Promise<RunOutcome> | null {
    if (this.#worker) return null
    this.#worker = this.#createWorker()
    return this.#request({
      id: this.#nextId++,
      type: 'init',
      schema: this.#db.schema,
      seed: this.#db.seed,
    })
  }

  #createWorker(): Worker {
    const worker = new Worker(new URL('../worker/sql.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data
      this.#settle(
        response.id,
        response.ok ? { ok: true, result: response.result } : { ok: false, error: response.error },
      )
    }
    worker.onerror = (event) => {
      this.#kill({ ok: false, error: `Движок базы не запустился: ${event.message}` })
    }
    return worker
  }

  #request(request: WorkerRequest): Promise<RunOutcome> {
    const worker = this.#worker
    if (!worker) return Promise.resolve({ ok: false, error: 'Движок базы не запущен.' })

    return new Promise<RunOutcome>((resolve) => {
      this.#pending = {
        id: request.id,
        resolve,
        timer: setTimeout(() => {
          // Ответа нет: воркер занят синхронным запросом и сам не остановится.
          this.#kill({ ok: false, error: TIMEOUT_MESSAGE })
        }, TIMEOUT_MS),
      }
      worker.postMessage(request)
    })
  }

  #settle(id: number, outcome: RunOutcome): void {
    if (this.#pending?.id !== id) return
    this.#abort(outcome)
  }

  /** Воркера больше нет, поэтому ответа на запрос в полёте не будет — закрываем его сами. */
  #kill(reason: RunOutcome): void {
    this.#worker?.terminate()
    this.#worker = null
    this.#abort(reason)
  }

  #abort(outcome: RunOutcome): void {
    const pending = this.#pending
    if (!pending) return
    this.#pending = null
    clearTimeout(pending.timer)
    pending.resolve(outcome)
  }
}
