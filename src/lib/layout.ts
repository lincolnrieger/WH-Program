import type { Block } from '@/types'

export interface PositionedBlock {
  block: Block
  /** First and last group column the block covers, inclusive. */
  startCol: number
  endCol: number
  /** Lane index and lane count, for blocks that overlap within the same columns. */
  lane: number
  lanes: number
  /** Whole-school bands sit behind the per-group blocks. */
  layer: 'band' | 'block'
}

/**
 * Works out where each block sits on the grid.
 *
 * Two kinds of block behave differently, which is what keeps the layout
 * predictable:
 *
 * - A block covering **more than one group** (lunch, dinner, departure) draws as
 *   one wide band across those columns, matching the merged cells in the current
 *   spreadsheets. Bands sit behind everything else.
 * - A block in a **single group** draws inside that column. Where two of them
 *   overlap — almost always a mistake — the column splits into lanes so both
 *   stay visible and clickable, and the clash is obvious.
 *
 * Laning each group separately is what stops a full-width band and a
 * single-column block from being handed overlapping geometry.
 */
export function layoutBlocks(blocks: Block[], groupIds: string[]): PositionedBlock[] {
  const indexOf = new Map(groupIds.map((id, index) => [id, index]))
  const lastColumn = Math.max(groupIds.length - 1, 0)

  const positioned: PositionedBlock[] = blocks
    .map((block) => {
      const indices = block.groupIds
        .map((id) => indexOf.get(id))
        .filter((index): index is number => index !== undefined)

      // A block whose groups have all been deleted still belongs to the school,
      // so show it across the full width rather than dropping it silently.
      const startCol = indices.length > 0 ? Math.min(...indices) : 0
      const endCol = indices.length > 0 ? Math.max(...indices) : lastColumn

      return {
        block,
        startCol,
        endCol,
        lane: 0,
        lanes: 1,
        layer: (startCol === endCol ? 'block' : 'band') as PositionedBlock['layer'],
      }
    })
    .sort((a, b) => a.block.startMin - b.block.startMin || a.startCol - b.startCol)

  // Lane the bands against each other, and each column's blocks against each
  // other — never the two groups against one another.
  assignLanes(positioned.filter((item) => item.layer === 'band'))
  for (let column = 0; column <= lastColumn; column += 1) {
    assignLanes(
      positioned.filter((item) => item.layer === 'block' && item.startCol === column),
    )
  }

  return positioned
}

/**
 * Classic interval-laning: walk the items in start order and drop each into the
 * first lane whose previous item has already finished.
 */
function assignLanes(items: PositionedBlock[]): void {
  if (items.length < 2) return

  const laneEnds: number[] = []

  for (const item of items) {
    let lane = laneEnds.findIndex((end) => item.block.startMin >= end)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(item.block.endMin)
    } else {
      laneEnds[lane] = item.block.endMin
    }
    item.lane = lane
  }

  // Only the items that actually share time with another need to be narrowed;
  // a block sitting alone in its slot keeps the full width.
  for (const item of items) {
    const overlapping = items.filter(
      (other) =>
        other === item ||
        (item.block.startMin < other.block.endMin && other.block.startMin < item.block.endMin),
    )
    item.lanes = Math.max(...overlapping.map((other) => other.lane)) + 1
  }
}
