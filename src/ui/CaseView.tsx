import type { Case } from '../core/types.ts'
import { CasePanel } from './CasePanel.tsx'
import { Monitor } from './Monitor.tsx'
import { SchemaPanel } from './SchemaPanel.tsx'
import { useCaseEngine } from './useCaseEngine.ts'

/**
 * Две зоны: слева бумага (папка дела), справа машина (монитор). На узком экране
 * монитор заменяется честным сообщением — писать SQL с телефона мучительно (§13).
 * Схема базы при этом остаётся: дизайн-документ перечисляет её среди того, что
 * на телефоне доступно, а живёт она внутри монитора — пришлось повторить отдельно.
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

      <div className="flex flex-col gap-4 bg-ink p-6 font-sans text-sm text-paper md:hidden">
        <p>Терминал заблокирован: запросы удобнее писать с компьютера. Задание и теория — выше.</p>
        <SchemaPanel schema={engine.schema} />
      </div>
    </div>
  )
}
