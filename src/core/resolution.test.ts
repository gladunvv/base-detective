import { describe, expect, it } from 'vitest'
import { checkResolution } from './resolution.ts'

describe('финальное решение дела', () => {
  const answer = { option_id: 'archive', evidence_ids: ['volume', 'log'] }

  it.each([
    ['неверная версия с верными уликами', 'console', ['volume', 'log'], 'wrong-version'],
    ['версия без улик', 'archive', [], 'wrong-evidence'],
    ['одной улики не хватает', 'archive', ['log'], 'wrong-evidence'],
    ['добавлена лишняя улика', 'archive', ['volume', 'log', 'console'], 'wrong-evidence'],
    ['повтор одной улики вместо двух разных', 'archive', ['log', 'log'], 'wrong-evidence'],
    ['версия и оба доказательства в обратном порядке', 'archive', ['log', 'volume'], 'accepted'],
  ] as const)('%s', (_name, optionId, selected, expected) => {
    expect(checkResolution(answer, optionId, selected)).toBe(expected)
  })
})
