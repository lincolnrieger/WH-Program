import type { Activity, Site } from '@/types'
import { ActivityPalette } from '@/components/palette/ActivityPalette'

/**
 * The left-hand column on the planning views: the things you drag onto the
 * grid. Choosing a school used to share this column behind a tab, which hid
 * the one choice everything else depends on; it now sits above the grid in
 * the school bar.
 */
export function Sidebar({
  activities, picked, site, dark, search, onSearch, onQuickAdd, canAdd,
  onAddCustom, onUnpick, onClearPicked,
}: {
  activities: Activity[]
  /** Activities set aside for manual dragging, shown above the full list. */
  picked: Activity[]
  site: Site
  dark: boolean
  search: string
  onSearch: (value: string) => void
  onQuickAdd: (payload: { type: 'activity'; id: string } | { type: 'routine'; id: string }) => void
  canAdd: boolean
  onAddCustom: (name: string) => void
  onUnpick: (id: string) => void
  onClearPicked: () => void
}) {
  return (
    <nav
      aria-label="Activities"
      className="no-print flex h-full w-[248px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]"
    >
      <ActivityPalette
        activities={activities}
        picked={picked}
        site={site}
        dark={dark}
        search={search}
        onSearch={onSearch}
        onQuickAdd={onQuickAdd}
        canAdd={canAdd}
        onAddCustom={onAddCustom}
        onUnpick={onUnpick}
        onClearPicked={onClearPicked}
      />
    </nav>
  )
}
