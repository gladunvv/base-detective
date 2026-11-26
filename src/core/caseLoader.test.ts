import { describe, expect, it } from 'vitest'
import { parseCase } from './caseLoader.ts'

function caseWithResolution() {
  const step = { brief: 'Найдите запись.', solution: 'SELECT 1', check: { mode: 'resultset' } }
  return {
    format_version: 1,
    id: '00',
    title: 'Проверка формата',
    topic: 'SELECT',
    db: { schema: 'CREATE TABLE reports (id INTEGER)' },
    steps: [
      { ...step, id: 's1', evidence: [{ id: 'label', text: 'На бирке номер 14.' }] },
      { ...step, id: 's2', evidence: [{ id: 'receipt', text: 'В накладной указан номер 14.' }] },
    ],
    resolution: {
      prompt: 'Какой предмет вернуть посетителю?',
      options: [{ id: 'head', text: 'Голову куклы' }, { id: 'coat', text: 'Плащ' }],
      answer: { option_id: 'head', evidence_ids: ['label', 'receipt'] },
    },
  }
}

describe('формат улик и финального решения', () => {
  it('читает дело старого формата без полей расследования', () => {
    const raw = caseWithResolution()
    const legacy = {
      ...raw,
      resolution: undefined,
      steps: raw.steps.map(({ evidence: _evidence, ...step }) => step),
    }
    const parsed = parseCase(legacy, '00.json')
    expect(parsed.resolution).toBeUndefined()
    expect(parsed.steps.map(({ evidence }) => evidence)).toEqual([[], []])
  })

  it('сохраняет улики и ссылки на подтверждающие факты', () => {
    const raw = caseWithResolution()
    const parsed = parseCase(raw, '00.json')
    expect(parsed.steps[0].evidence).toEqual(raw.steps[0].evidence)
    expect(parsed.resolution).toEqual(raw.resolution)
    expect(parseCase({ ...raw, resolution: undefined }, '00.json').steps[0].evidence).toHaveLength(1)
  })

  it.each([
    ['дубликат улики в разных шагах', (raw) => { raw.steps[1].evidence[0].id = 'label' },
      'steps.1.evidence.0.id'],
    ['дубликат версии', (raw) => { raw.resolution.options[1].id = 'head' },
      'resolution.options.1.id'],
    ['неизвестная версия в ответе', (raw) => { raw.resolution.answer.option_id = 'other' },
      'resolution.answer.option_id'],
    ['неизвестная улика в ответе', (raw) => { raw.resolution.answer.evidence_ids[1] = 'missing' },
      'resolution.answer.evidence_ids.1'],
    ['повторная ссылка на улику', (raw) => { raw.resolution.answer.evidence_ids[1] = 'label' },
      'resolution.answer.evidence_ids.1'],
    ['ответ без доказательств', (raw) => { raw.resolution.answer.evidence_ids = [] },
      'resolution.answer.evidence_ids'],
    ['одна версия на выбор', (raw) => { raw.resolution.options.pop() },
      'resolution.options'],
    ['пустой текст улики', (raw) => { raw.steps[0].evidence[0].text = '  ' },
      'steps.0.evidence.0.text'],
  ] satisfies [string, (raw: ReturnType<typeof caseWithResolution>) => void, string][])(
    '%s',
    (_name, modify, path) => {
      const raw = caseWithResolution()
      modify(raw)
      expect(() => parseCase(raw, '00.json')).toThrow(path)
    },
  )
})
