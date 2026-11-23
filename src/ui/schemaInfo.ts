/**
 * Схема текущего дела — какие есть таблицы и колонки. Читается из живой базы
 * через `sqlite_master` и `pragma_table_info()`, а не парсингом текста `CREATE TABLE`:
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
    const literal = tableName.replaceAll("'", "''")
    const columns = await exec(`SELECT name FROM pragma_table_info('${literal}')`)
    if (!columns.ok) continue
    info[tableName] = columns.result.rows.map(([name]) => String(name))
  }
  return info
}
