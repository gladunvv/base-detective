import type { Case } from './types.ts'

export function checkResolution(
  answer: NonNullable<Case['resolution']>['answer'],
  optionId: string,
  evidenceIds: readonly string[],
): 'accepted' | 'wrong-version' | 'wrong-evidence' {
  if (optionId !== answer.option_id) return 'wrong-version'
  const selected = new Set(evidenceIds)
  if (selected.size !== answer.evidence_ids.length || !answer.evidence_ids.every((id) => selected.has(id))) {
    return 'wrong-evidence'
  }
  return 'accepted'
}
