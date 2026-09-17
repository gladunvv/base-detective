import MarkdownIt from 'markdown-it'

// Текст дел — наш собственный контент (public/cases/*.json), не ввод игрока,
// так что рендерить как HTML напрямую безопасно.
const md = new MarkdownIt({ html: false, linkify: true })

export function Markdown({ text, className }: { text: string; className?: string }) {
  if (text.trim() === '') return null
  return <div className={className} dangerouslySetInnerHTML={{ __html: md.render(text) }} />
}
