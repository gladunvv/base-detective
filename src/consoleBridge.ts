/**
 * Временная сцепка: даёт дёрнуть движок из консоли браузера, пока нет интерфейса.
 * Едет и в прод — ради неё загрузка WASM проверяется там, где она обычно и ломается.
 * Удаляется в фазе 4 вместе с появлением терминала.
 */
import { loadCase } from './core/caseLoader.ts'
import { SqlRunner } from './core/sqlRunner.ts'

export async function installConsoleBridge(): Promise<void> {
  const kase = await loadCase('00')
  const runner = new SqlRunner(kase.db)

  Object.assign(window, { bd: { case: kase, runner } })
  console.info(
    `Дело «${kase.title}» загружено. Пробуйте:\n` +
      `  await bd.runner.exec('SELECT * FROM suspects')\n` +
      `  await bd.runner.reset()`,
  )
}
