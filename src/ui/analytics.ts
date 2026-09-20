import { track } from '@vercel/analytics'

/**
 * Пять событий из роадмапы. Всё, что отправляется, — номер дела, номер шага
 * и порядковый номер подсказки: ни текста запроса игрока, ни сообщений об
 * ошибках, ни чего-либо, по чему можно узнать человека. Поэтому cookie-баннер
 * не нужен — собирать нечего.
 *
 * Вопрос, ради которого всё это ставится: на каком шаге люди уходят. Значит,
 * в каждом событии должны быть и дело, и шаг — иначе воронку не построить.
 */
export const analytics = {
  caseOpened(caseId: string): void {
    track('case_opened', { case: caseId })
  },

  stepSolved(caseId: string, stepId: string, stepNumber: number): void {
    track('step_solved', { case: caseId, step: stepId, number: stepNumber })
  },

  hintRevealed(caseId: string, stepId: string, hintNumber: number): void {
    track('hint_revealed', { case: caseId, step: stepId, hint: hintNumber })
  },

  /** Текст ошибки не отправляется: он может содержать кусок запроса игрока. */
  queryFailed(caseId: string, stepId: string): void {
    track('query_failed', { case: caseId, step: stepId })
  },

  caseFinished(caseId: string): void {
    track('case_finished', { case: caseId })
  },
}
