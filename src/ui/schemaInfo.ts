/**
 * Схема текущего дела — какие есть таблицы и колонки. Читается из живой базы
 * через `sqlite_master` и `PRAGMA table_info`, а не парсингом текста `CREATE TABLE`:
 * SQLite и так знает точный ответ, парсить DDL руками — плодить второй источник правды.
 */
import type { RunOutcome } from '../core/sqlite.ts'

export type SchemaInfo = Record<string, string[]>

export async function fetchSchemaInfo(exec: (sql: string) => Promise<RunOutcome>): Promise<SchemaInfo> {
  const tables = await exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  if (!tables.ok) return {}

  const info: SchemaInfo = {}
  for (const [name] of tables.result.rows) {
    const tableName = String(name)
    const columns = await exec(`PRAGMA table_info(${tableName})`)
    if (!columns.ok) continue
    const nameIdx = columns.result.columns.indexOf('name')
    info[tableName] = columns.result.rows.map((row) => String(row[nameIdx]))
  }
  return info
}
