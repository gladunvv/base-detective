import type { Case } from '../core/types.ts'
import { CasePanel } from './CasePanel.tsx'
import { Monitor } from './Monitor.tsx'
import { useCaseEngine } from './useCaseEngine.ts'

/**
 * Две зоны: слева бумага (папка дела), справа машина (монитор). На узком экране
 * монитор заменяется честным сообщением — писать SQL с телефона мучительно (§13).
 */
export function CaseView({ kase, onFinished }: { kase: Case; onFinished?: () => void }) {
  const engine = useCaseEngine(kase, { onFinished })

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:flex-row md:overflow-hidden">
      <div className="md:h-full md:w-[40%]">
        <CasePanel kase={kase} engine={engine} />
      </div>

      <div className="hidden md:flex md:h-full md:flex-1">
        <Monitor engine={engine} />
      </div>

      <div className="flex items-center justify-center bg-ink p-6 text-center font-sans text-sm text-paper md:hidden">
        Терминал заблокирован: это дело удобнее решать с компьютера. Задание, теория и
        схема базы — выше.
      </div>
    </div>
  )
}
