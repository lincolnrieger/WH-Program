/**
 * The API behind the Woodhouse Program Builder.
 *
 * Static assets are served by Cloudflare's asset worker; only `/api/*` reaches
 * this script (see `run_worker_first` in `wrangler.jsonc`). Everything here is
 * row-level: the app sends the rows it changed rather than the whole plan, so
 * two people editing different schools at the same time don't clobber one
 * another. Within a row, last write wins.
 */

import type { Block, Booking, Overrides } from '../src/types'
import type { CatalogueKind, Op, RemoteState } from '../src/lib/api'

export interface Env {
  DB: D1Database
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  // The plan changes constantly and is small; never let a cache serve it.
  'cache-control': 'no-store',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function fail(message: string, status: number): Response {
  return new Response(message, { status, headers: { 'content-type': 'text/plain' } })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      return fail('Not found', 404)
    }
    if (!env.DB) {
      return fail(
        'No database bound. Create one with `npx wrangler d1 create wh-program` and ' +
          'add its id to wrangler.jsonc — see SETUP.md.',
        503,
      )
    }

    try {
      switch (`${request.method} ${url.pathname}`) {
        case 'GET /api/health':
          return json(await health(env))
        case 'GET /api/state':
          return json(await readState(env))
        case 'GET /api/revision':
          return json({ revision: await readRevision(env) })
        case 'POST /api/mutate':
          return json(await mutate(env, request))
        case 'POST /api/reset':
          return json(await reset(env))
        default:
          return fail('Not found', 404)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // A missing table means the schema was never applied — worth saying so
      // rather than returning a bare 500 that sends people to the logs.
      if (/no such table/i.test(message)) {
        return fail(
          'The database has no tables yet. Run `npx wrangler d1 execute wh-program ' +
            '--remote --file=./schema.sql` — see SETUP.md.',
          503,
        )
      }
      return fail(message, 500)
    }
  },
} satisfies ExportedHandler<Env>

// ─── reading ────────────────────────────────────────────────────────────────

async function health(env: Env): Promise<{ database: boolean; bookings: number }> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM bookings').first<{ n: number }>()
  return { database: true, bookings: row?.n ?? 0 }
}

async function readRevision(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'revision'").first<{
    value: string
  }>()
  return row ? Number(row.value) || 0 : 0
}

async function readState(env: Env): Promise<RemoteState> {
  const [bookings, blocks, catalogue, settings] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM bookings'),
    env.DB.prepare('SELECT * FROM blocks'),
    env.DB.prepare('SELECT kind, id, data FROM catalogue'),
    env.DB.prepare('SELECT key, value FROM settings'),
  ])

  const byKind = (kind: CatalogueKind): unknown[] =>
    (catalogue.results as CatalogueRow[])
      .filter((row) => row.kind === kind)
      .map((row) => JSON.parse(row.data) as unknown)

  const setting = (key: string): string | undefined =>
    (settings.results as SettingRow[]).find((row) => row.key === key)?.value

  const overridesRaw = setting('overrides')

  return {
    revision: Number(setting('revision') ?? 0) || 0,
    bookings: (bookings.results as BookingRow[]).map(toBooking),
    blocks: (blocks.results as BlockRow[]).map(toBlock),
    customActivities: byKind('activity'),
    customVenues: byKind('venue'),
    customStaff: byKind('staff'),
    overrides: overridesRaw ? (JSON.parse(overridesRaw) as Overrides) : null,
  }
}

// ─── writing ────────────────────────────────────────────────────────────────

const MAX_OPS = 5000

async function mutate(env: Env, request: Request): Promise<{ revision: number }> {
  const body = (await request.json()) as { ops?: Op[] }
  const ops = body.ops ?? []

  if (!Array.isArray(ops)) throw new Error('Expected { ops: [...] }')
  if (ops.length > MAX_OPS) throw new Error(`Too many changes at once (${ops.length}).`)
  if (ops.length === 0) return { revision: await readRevision(env) }

  const now = new Date().toISOString()
  const statements = ops.flatMap((op) => statementsFor(env, op, now))

  // D1 runs a batch as one transaction, so a bad op rolls the whole lot back
  // rather than leaving the plan half-changed.
  statements.push(bumpRevision(env, now))
  const results = await env.DB.batch(statements)

  const revisionRow = results[results.length - 1].results as { value: string }[] | undefined
  return { revision: Number(revisionRow?.[0]?.value ?? 0) || (await readRevision(env)) }
}

function statementsFor(env: Env, op: Op, now: string): D1PreparedStatement[] {
  switch (op.type) {
    case 'booking.put': {
      const b = op.booking
      return [env.DB.prepare(
        `INSERT INTO bookings
           (id, site, school_name, year_level, student_count, package_tier, building,
            start_date, end_date, groups, notes, contact, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(id) DO UPDATE SET
           site = ?2, school_name = ?3, year_level = ?4, student_count = ?5,
           package_tier = ?6, building = ?7, start_date = ?8, end_date = ?9,
           groups = ?10, notes = ?11, contact = ?12, updated_at = ?13`,
      ).bind(
        b.id, b.site, b.schoolName ?? '', b.yearLevel ?? '', b.studentCount ?? null,
        b.packageTier ?? 'gold', b.building ?? '', b.startDate, b.endDate,
        JSON.stringify(b.groups ?? []), b.notes ?? null, b.contact ?? null, now,
      )]
    }

    case 'booking.delete':
      // The foreign key cascades, but only where it's enforced — dropping the
      // sessions here as well means a booking never leaves orphans behind.
      return [
        env.DB.prepare('DELETE FROM blocks WHERE booking_id = ?1').bind(op.id),
        env.DB.prepare('DELETE FROM bookings WHERE id = ?1').bind(op.id),
      ]

    case 'block.put': {
      const b = op.block
      return [env.DB.prepare(
        `INSERT INTO blocks
           (id, booking_id, date, start_min, end_min, group_ids, kind, activity_id,
            title, delivery, staff_ids, training_staff_ids, venue_id, note, locked,
            colour, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
         ON CONFLICT(id) DO UPDATE SET
           booking_id = ?2, date = ?3, start_min = ?4, end_min = ?5, group_ids = ?6,
           kind = ?7, activity_id = ?8, title = ?9, delivery = ?10, staff_ids = ?11,
           training_staff_ids = ?12, venue_id = ?13, note = ?14, locked = ?15,
           colour = ?16, updated_at = ?17`,
      ).bind(
        b.id, b.bookingId, b.date, b.startMin, b.endMin,
        JSON.stringify(b.groupIds ?? []), b.kind, b.activityId ?? null, b.title ?? null,
        b.delivery, JSON.stringify(b.staffIds ?? []),
        b.trainingStaffIds?.length ? JSON.stringify(b.trainingStaffIds) : null,
        b.venueId ?? null, b.note ?? null, b.locked ? 1 : 0, b.colour ?? null, now,
      )]
    }

    case 'block.delete':
      return [env.DB.prepare('DELETE FROM blocks WHERE id = ?1').bind(op.id)]

    case 'catalogue.put':
      return [
        env.DB.prepare(
          `INSERT INTO catalogue (kind, id, data, updated_at) VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(kind, id) DO UPDATE SET data = ?3, updated_at = ?4`,
        ).bind(op.kind, op.id, JSON.stringify(op.data), now),
      ]

    case 'catalogue.delete':
      return [
        env.DB.prepare('DELETE FROM catalogue WHERE kind = ?1 AND id = ?2').bind(op.kind, op.id),
      ]

    case 'overrides.put':
      return [
        env.DB.prepare(
          `INSERT INTO settings (key, value, updated_at) VALUES ('overrides', ?1, ?2)
           ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2`,
        ).bind(JSON.stringify(op.overrides), now),
      ]

    default: {
      // Exhaustiveness: a new op type has to be handled here or this won't compile.
      const unknown: never = op
      throw new Error(`Unknown change: ${JSON.stringify(unknown)}`)
    }
  }
}

function bumpRevision(env: Env, now: string): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('revision', '1', ?1)
     ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(settings.value AS INTEGER) + 1 AS TEXT),
       updated_at = ?1
     RETURNING value`,
  ).bind(now)
}

async function reset(env: Env): Promise<{ revision: number }> {
  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM blocks'),
    env.DB.prepare('DELETE FROM bookings'),
    env.DB.prepare('DELETE FROM catalogue'),
    env.DB.prepare("DELETE FROM settings WHERE key = 'overrides'"),
    bumpRevision(env, now),
  ])
  return { revision: await readRevision(env) }
}

// ─── row shapes ─────────────────────────────────────────────────────────────

interface CatalogueRow { kind: string; id: string; data: string }
interface SettingRow { key: string; value: string }

interface BookingRow {
  id: string
  site: string
  school_name: string
  year_level: string
  student_count: number | null
  package_tier: string
  building: string
  start_date: string
  end_date: string
  groups: string
  notes: string | null
  contact: string | null
}

interface BlockRow {
  id: string
  booking_id: string
  date: string
  start_min: number
  end_min: number
  group_ids: string
  kind: string
  activity_id: string | null
  title: string | null
  delivery: string
  staff_ids: string
  training_staff_ids: string | null
  venue_id: string | null
  note: string | null
  locked: number
  colour: string | null
}

function parseArray(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    site: row.site as Booking['site'],
    schoolName: row.school_name,
    yearLevel: row.year_level,
    studentCount: row.student_count ?? undefined,
    packageTier: row.package_tier as Booking['packageTier'],
    building: row.building,
    startDate: row.start_date,
    endDate: row.end_date,
    groups: (() => {
      try {
        return JSON.parse(row.groups) as Booking['groups']
      } catch {
        return []
      }
    })(),
    notes: row.notes ?? undefined,
    contact: row.contact ?? undefined,
  }
}

function toBlock(row: BlockRow): Block {
  const training = parseArray(row.training_staff_ids)
  return {
    id: row.id,
    bookingId: row.booking_id,
    date: row.date,
    startMin: row.start_min,
    endMin: row.end_min,
    groupIds: parseArray(row.group_ids),
    kind: row.kind as Block['kind'],
    activityId: row.activity_id ?? undefined,
    title: row.title ?? undefined,
    delivery: row.delivery as Block['delivery'],
    staffIds: parseArray(row.staff_ids),
    trainingStaffIds: training.length > 0 ? training : undefined,
    venueId: row.venue_id ?? undefined,
    note: row.note ?? undefined,
    locked: row.locked === 1 ? true : undefined,
    colour: row.colour ?? undefined,
  }
}
