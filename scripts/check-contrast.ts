/**
 * Проверяет контраст цветовых пар по WCAG 2.1. Запуск: npm run check:contrast
 *
 * Держится отдельно от Lighthouse нарочно: Lighthouse проверяет только то, что
 * реально отрендерено на конкретном экране в конкретный момент, а здесь —
 * все пары палитры разом, включая состояния, до которых ещё надо доиграть.
 * Список пар ведётся руками: добавили цветовое сочетание в UI — добавьте сюда.
 */

const PALETTE = {
  ink: '#1b1a17',
  folder: '#c9bfa4',
  paper: '#e8e2d0',
  screen: '#2e3b34',
  glow: '#e0a72c',
  stamp: '#8c2f1e',
} as const

type ColorName = keyof typeof PALETTE

/** Цвет палитры, возможно полупрозрачный (Tailwind `text-ink/90` → `['ink', 0.9]`). */
type Layer = ColorName | [ColorName, number]

type Pair = {
  what: string
  fg: Layer
  bg: Layer
  /** Крупный текст (≥ 24px или ≥ 19px жирный) и нетекстовые элементы — порог 3:1. */
  large?: boolean
}

// Пары, которые реально встречаются в интерфейсе.
const PAIRS: Pair[] = [
  { what: 'текст терминала и таблицы', fg: 'glow', bg: 'screen' },
  { what: 'счётчик строк под таблицей', fg: ['glow', 0.9], bg: 'screen' },
  { what: 'заголовок списка дел, экраны загрузки', fg: 'paper', bg: 'ink' },
  { what: 'сообщение об ошибке загрузки', fg: 'paper', bg: 'ink' },
  { what: 'кнопки на тёмном фоне', fg: 'folder', bg: 'ink' },
  { what: 'недоступная папка', fg: ['folder', 0.7], bg: 'ink' },
  { what: 'номер и заголовок дела на карточке', fg: 'ink', bg: 'folder' },
  { what: 'штамп ЗАКРЫТО на карточке', fg: 'stamp', bg: 'folder' },
  { what: 'задание и теория на бумаге', fg: 'ink', bg: 'paper' },
  { what: 'подсказки на бумаге', fg: ['ink', 0.9], bg: 'paper' },
  { what: 'штамп ПРИНЯТО/ОТКАЗАНО', fg: 'stamp', bg: 'paper' },
  { what: 'причина отказа под штампом', fg: 'ink', bg: 'paper' },
  { what: 'кнопка «Выполнить»', fg: 'ink', bg: 'glow' },
  { what: 'кнопка «Далее»', fg: 'paper', bg: 'ink' },
  { what: 'сообщение про узкий экран', fg: 'paper', bg: 'ink' },
]

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Полупрозрачный цвет смешивается с фоном — иначе контраст считался бы не по тому, что видно. */
function flatten(layer: Layer, behind: string): string {
  if (typeof layer === 'string') return PALETTE[layer]
  const [name, alpha] = layer
  const fg = channels(PALETTE[name])
  const bg = channels(behind)
  const mixed = fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)))
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string): number {
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

let failed = 0
for (const pair of PAIRS) {
  const bg = flatten(pair.bg, PALETTE.ink)
  const fg = flatten(pair.fg, bg)
  const threshold = pair.large ? 3 : 4.5
  const ratio = contrast(fg, bg)

  if (ratio >= threshold) {
    console.log(`  ok  ${pair.what.padEnd(38)} ${ratio.toFixed(2)}:1`)
  } else {
    failed += 1
    console.error(`FAIL  ${pair.what.padEnd(38)} ${ratio.toFixed(2)}:1 — нужно ${threshold}:1`)
  }
}

console.log(`\n${PAIRS.length - failed} из ${PAIRS.length} пар проходят порог контраста`)
process.exit(failed === 0 ? 0 : 1)
