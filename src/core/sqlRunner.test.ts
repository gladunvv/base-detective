/// <reference lib="dom" />

import initSqlJs, { type Database } from 'sql.js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SqlRunner, type WorkerRequest, type WorkerResponse } from './sqlRunner.ts'
import { execSql, openDb, WRITE_QUERY_ERROR } from './sqlite.ts'

const schema = 'CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT NOT NULL)'
const seed = "INSERT INTO items VALUES (1, 'карта'), (2, 'шкатулка')"
const readItems = 'SELECT id, label FROM items ORDER BY id'
const originalRows = { ok: true, result: { columns: ['id', 'label'], rows: [[1, 'карта'], [2, 'шкатулка']] } }
let SQL: Awaited<ReturnType<typeof initSqlJs>>
let onHeldExec: (() => void) | undefined

class LocalWorker {
  onmessage?: (event: { data: WorkerResponse }) => void
  private db?: Database
  private terminated = false

  postMessage(request: WorkerRequest): void {
    if (request.type === 'exec' && onHeldExec) {
      const notify = onHeldExec
      onHeldExec = undefined
      notify()
      return
    }
    queueMicrotask(() => {
      if (this.terminated) return
      try {
        if (request.type === 'init') this.db = openDb(SQL, request.schema, request.seed)
        const result = request.type === 'init'
          ? { columns: [], rows: [] }
          : execSql(this.db!, request.sql, request.policy)
        this.onmessage?.({ data: { id: request.id, ok: true, result } })
      } catch (error) {
        this.onmessage?.({ data: { id: request.id, ok: false, error: String(error) } })
      }
    })
  }

  terminate(): void {
    this.terminated = true
    this.db?.close()
  }
}

describe('жизненный цикл SqlRunner с SQLite', () => {
  let runner: SqlRunner

  beforeAll(async () => {
    SQL = await initSqlJs()
  })

  beforeEach(() => {
    vi.stubGlobal('Worker', LocalWorker)
    onHeldExec = undefined
    runner = new SqlRunner({ schema, seed })
  })

  afterEach(() => {
    runner.dispose()
    vi.unstubAllGlobals()
  })

  it('показывает изменения внутри транзакции и восстанавливает данные после отката', async () => {
    expect(await runner.exec('BEGIN', 'write')).toMatchObject({ ok: true, result: { effect: { kind: 'begin' } } })
    expect(await runner.exec("INSERT INTO items VALUES (3, 'часы')", 'write'))
      .toMatchObject({ ok: true, result: { effect: { kind: 'changed', rows: 1 } } })
    expect(await runner.exec("UPDATE items SET label = 'план' WHERE id = 1 RETURNING label", 'write'))
      .toMatchObject({ ok: true, result: { rows: [['план']], effect: { kind: 'changed', rows: 1 } } })
    expect(await runner.exec('DELETE FROM items WHERE id = 2', 'write'))
      .toMatchObject({ ok: true, result: { effect: { kind: 'changed', rows: 1 } } })
    expect(await runner.exec(readItems, 'write'))
      .toMatchObject({ ok: true, result: { rows: [[1, 'план'], [3, 'часы']] } })

    const separate = new SqlRunner({ schema, seed })
    try {
      expect(await separate.exec(readItems)).toEqual(originalRows)
    } finally {
      separate.dispose()
    }

    expect(await runner.exec('ROLLBACK', 'write')).toMatchObject({ ok: true, result: { effect: { kind: 'rollback' } } })
    expect(await runner.exec(readItems)).toEqual(originalRows)
  })

  it('сохраняет COMMIT в текущем раннере, а reset возвращает seed и закрывает транзакцию', async () => {
    await runner.exec('BEGIN', 'write')
    await runner.exec('DELETE FROM items WHERE id = 2', 'write')
    expect(await runner.exec('COMMIT', 'write')).toMatchObject({ ok: true, result: { effect: { kind: 'commit' } } })
    expect(await runner.exec(readItems)).toMatchObject({ ok: true, result: { rows: [[1, 'карта']] } })

    await runner.exec('BEGIN', 'write')
    expect(await runner.reset()).toMatchObject({ ok: true })
    expect(await runner.exec('ROLLBACK', 'write')).toMatchObject({ ok: false, error: expect.stringContaining('no transaction') })
    expect(await runner.exec(readItems)).toEqual(originalRows)
  })

  it('отклоняет смену схемы и пакет команд до выполнения первой инструкции', async () => {
    expect(await runner.exec('CREATE TABLE notes (id INTEGER)', 'write'))
      .toEqual({ ok: false, error: `Error: ${WRITE_QUERY_ERROR}` })
    expect(await runner.exec('DELETE FROM items; SELECT id FROM items', 'write'))
      .toEqual({ ok: false, error: `Error: ${WRITE_QUERY_ERROR}` })
    expect(await runner.exec(readItems)).toEqual(originalRows)
  })

  it('отменяет выполняемый и поставленный в очередь запросы при сбросе', async () => {
    await runner.exec(readItems)
    const activePosted = new Promise<void>((resolve) => { onHeldExec = resolve })
    const active = runner.exec('DELETE FROM items WHERE id = 1', 'write')
    const queued = runner.exec('DELETE FROM items WHERE id = 2', 'write')
    await activePosted
    const reset = runner.reset()

    expect(await active).toMatchObject({ ok: false })
    expect(await queued).toMatchObject({ ok: false })
    expect(await reset).toMatchObject({ ok: true })
    expect(await runner.exec(readItems)).toEqual(originalRows)
  })
})
