import { SPORT_LABELS, type Sport } from '@marcai/shared'

export function SportBadge({ sport }: { sport: Sport }) {
  return (
    <span className="inline-flex h-5 flex-none items-center rounded-sm bg-surface-2 px-1.5 text-xs font-medium whitespace-nowrap text-neutral-fg">
      {SPORT_LABELS[sport]}
    </span>
  )
}
