/**
 * Рисует картинку превью для соцсетей: public/og.png, 1200×630.
 * Запуск: npm run og:image
 *
 * SVG собирается здесь же и конвертируется системным `sips` — внешних
 * зависимостей не нужно. Соцсети SVG не принимают, поэтому на выходе PNG.
 *
 * Шрифты проекта системному рендереру недоступны, поэтому надписи заданы
 * generic-семействами (monospace / sans-serif): на картинке важнее, чтобы
 * текст был на месте и читался, чем чтобы совпало начертание.
 */
import { execFileSync } from 'node:child_process'
import { unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = join(root, 'public', 'og.png')
const tmp = join(root, 'public', '_og.svg')

const INK = '#1b1a17'
const SCREEN = '#2e3b34'
const PAPER = '#e8e2d0'
const FOLDER = '#c9bfa4'
const GLOW = '#e0a72c'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${INK}"/>
  <text x="90" y="92" font-family="monospace" font-size="58" font-weight="bold" fill="${PAPER}">Base Detective</text>
  <text x="92" y="138" font-family="sans-serif" font-size="28" fill="${FOLDER}">Улики не врут. Таблицы тоже.</text>
  <rect x="90" y="178" width="1020" height="372" rx="20" fill="none" stroke="${FOLDER}" stroke-opacity="0.4" stroke-width="8"/>
  <rect x="110" y="198" width="980" height="332" rx="12" fill="${SCREEN}"/>
  <text x="150" y="262" font-family="monospace" font-size="26" fill="${GLOW}">БАЗА-1 · ОЗУ 640К · ПРОВЕРКА... ОК</text>
  <text x="150" y="306" font-family="monospace" font-size="26" fill="${GLOW}">Подключение к архиву... ОК</text>
  <text x="150" y="350" font-family="monospace" font-size="26" fill="${GLOW}">Найдено непрочитанное сообщение.</text>
  <text x="150" y="420" font-family="monospace" font-size="26" fill="${PAPER}">Если ты это читаешь — контора теперь твоя.</text>
  <text x="150" y="492" font-family="monospace" font-size="26" fill="${GLOW}">&gt; SELECT * FROM дела WHERE статус = 'открыто';</text>
  <rect x="902" y="471" width="12" height="28" fill="${GLOW}"/>
</svg>
`

writeFileSync(tmp, svg)
try {
  execFileSync('sips', ['-s', 'format', 'png', tmp, '--out', out], { stdio: 'pipe' })
  const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out]).toString()
  console.log(`  ok  public/og.png\n${size.trim()}`)
} finally {
  unlinkSync(tmp)
}
