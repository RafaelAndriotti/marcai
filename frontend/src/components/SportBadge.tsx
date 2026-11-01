import { SPORT_LABELS, type Sport } from '@marcai/shared'

export function SportBadge({ sport }: { sport: Sport }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-neutral-fg">
      {SPORT_LABELS[sport]}
    </span>
  )
}
