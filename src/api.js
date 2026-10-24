// Data comes from ESPN's public (unauthenticated) site API, called straight
// from the browser. Every response is normalized here so the components never
// touch ESPN's raw shapes.

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'
const CORE = 'https://site.api.espn.com/apis/v2/sports/football/nfl'

// ---------- fetching ----------

const cache = new Map()
const CACHE_MS = 20_000

async function getJSON(url, { fresh = false } = {}) {
  const hit = cache.get(url)
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN returned ${res.status}`)
  const data = await res.json()
  cache.set(url, { at: Date.now(), data })
  return data
}

// ---------- scoreboard ----------

/** opts: { week, seasonType } (both optional = current week). */
export async function fetchScoreboard(opts = {}, fetchOpts) {
  const q = new URLSearchParams({ limit: '100' })
  if (opts.week) q.set('week', opts.week)
  if (opts.seasonType) q.set('seasontype', opts.seasonType)

  const raw = await getJSON(`${SITE}/scoreboard?${q}`, fetchOpts)
  const league = raw.leagues?.[0] ?? {}
  return {
    events: (raw.events ?? []).map(normalizeEvent),
    byes: (raw.week?.teamsOnBye ?? []).map((t) => ({
      id: t.id,
      name: t.shortDisplayName ?? t.location ?? t.displayName,
      fullName: t.displayName,
      abbr: t.abbreviation,
      logo: teamLogo(t),
    })),
    week: raw.week?.number ?? null,
    seasonType: raw.season?.type ?? null,
    calendar: normalizeCalendar(league.calendar),
    seasonStart: league.calendarStartDate ?? league.season?.startDate ?? null,
    seasonEnd: league.calendarEndDate ?? league.season?.endDate ?? null,
  }
}

function normalizeCalendar(cal) {
  if (!Array.isArray(cal) || typeof cal[0] !== 'object') return []
  return cal.flatMap((part) =>
    (part.entries ?? []).map((w) => ({
      label: w.label,
      detail: w.detail,
      week: w.value,
      seasonType: part.value,
      group: part.label,
      start: w.startDate,
      end: w.endDate,
    })),
  )
}

function teamLogo(team) {
  return team?.logo ?? team?.logos?.[0]?.href ?? null
}

function normalizeCompetitor(c, situation) {
  const t = c.team ?? {}
  return {
    id: t.id,
    name: t.shortDisplayName ?? t.location ?? t.displayName ?? t.name,
    fullName: t.displayName ?? t.name,
    abbr: t.abbreviation,
    logo: teamLogo(t),
    color: t.color ? `#${t.color}` : null,
    score: c.score ?? '',
    record: c.records?.find((r) => r.type === 'total')?.summary ?? c.records?.[0]?.summary ?? '',
    winner: !!c.winner,
    possession: situation?.possession != null && situation.possession === t.id,
  }
}

function normalizeEvent(e) {
  const comp = e.competitions?.[0] ?? {}
  const status = comp.status ?? e.status ?? {}
  const type = status.type ?? {}
  const sit = comp.situation
  const competitors = comp.competitors ?? []
  const home = competitors.find((c) => c.homeAway === 'home') ?? competitors[0]
  const away = competitors.find((c) => c.homeAway === 'away') ?? competitors[1]

  return {
    id: e.id,
    date: e.date,
    state: type.state ?? 'pre', // pre | in | post
    detail: type.shortDetail ?? type.detail ?? '',
    completed: !!type.completed,
    neutral: !!comp.neutralSite,
    note: comp.notes?.[0]?.headline ?? '',
    venue: comp.venue?.fullName ?? '',
    broadcast:
      comp.broadcasts?.flatMap((b) => b.names ?? []).join(', ') ||
      comp.geoBroadcasts?.map((b) => b.media?.shortName).filter(Boolean).join(', ') ||
      '',
    odds: comp.odds?.[0] ? { spread: comp.odds[0].details ?? '', total: comp.odds[0].overUnder ?? null } : null,
    situation: sit?.downDistanceText ?? sit?.shortDownDistanceText ?? '',
    link: e.links?.find((l) => l.rel?.includes('summary'))?.href ?? e.links?.[0]?.href ?? null,
    home: home ? normalizeCompetitor(home, sit) : null,
    away: away ? normalizeCompetitor(away, sit) : null,
  }
}

// ---------- standings ----------

function stat(stats, ...names) {
  const lower = names.map((n) => n.toLowerCase())
  return stats.find((s) => lower.includes(s.name?.toLowerCase()) || lower.includes(s.type?.toLowerCase()))
}

function normalizeEntry(entry) {
  const stats = entry.stats ?? []
  const t = entry.team ?? {}
  const val = (...names) => stat(stats, ...names)?.displayValue ?? ''
  return {
    team: {
      id: t.id,
      name: t.shortDisplayName ?? t.location ?? t.displayName,
      fullName: t.displayName,
      abbr: t.abbreviation,
      logo: teamLogo(t),
    },
    overall: val('overall', 'total'),
    div: val('vs. div.', 'divisionRecord'),
    conf: val('vs. conf.'),
    pf: val('pointsFor'),
    pa: val('pointsAgainst'),
    diff: val('differential', 'pointDifferential'),
    streak: val('streak'),
    seed: stat(stats, 'playoffSeed')?.value ?? null,
  }
}

/** Divisions come back as the second level of the tree; conferences list all 16 teams by seed. */
export async function fetchStandings(level = 'divisions') {
  const raw = await getJSON(`${CORE}/standings${level === 'divisions' ? '?level=3' : ''}`)
  const out = []
  for (const conf of raw.children ?? []) {
    const nodes = level === 'divisions' ? (conf.children ?? []) : [conf]
    for (const node of nodes) {
      const entries = node.standings?.entries ?? []
      if (!entries.length) continue
      out.push({
        id: node.id ?? node.name,
        conference: conf.abbreviation ?? conf.name,
        name: node.name,
        entries: entries.map(normalizeEntry),
      })
    }
  }
  return out
}

// ---------- team detail ----------

function scoreValue(score) {
  if (score == null) return ''
  if (typeof score === 'object') return score.displayValue ?? String(score.value ?? '')
  return String(score)
}

function normalizeScheduleEvent(e, teamId) {
  const comp = e.competitions?.[0] ?? {}
  const type = (comp.status ?? e.status ?? {}).type ?? {}
  const competitors = comp.competitors ?? []
  const us = competitors.find((c) => String(c.team?.id ?? c.id) === String(teamId))
  const them = competitors.find((c) => c !== us)
  const t = them?.team ?? {}
  const usScore = scoreValue(us?.score)
  const themScore = scoreValue(them?.score)
  const state = type.state ?? 'pre'
  return {
    id: e.id,
    date: e.date,
    state,
    detail: type.shortDetail ?? type.detail ?? '',
    home: us?.homeAway === 'home',
    neutral: !!comp.neutralSite,
    result:
      state === 'post' && usScore !== '' ? (us?.winner ? 'W' : them?.winner ? 'L' : 'T') : null,
    score: usScore !== '' && themScore !== '' ? `${usScore}-${themScore}` : '',
    pointsFor: Number(usScore) || 0,
    pointsAgainst: Number(themScore) || 0,
    link: e.links?.find((l) => l.rel?.includes('summary'))?.href ?? e.links?.[0]?.href ?? null,
    opponent: {
      id: t.id,
      name: t.shortDisplayName ?? t.location ?? t.displayName,
      fullName: t.displayName,
      abbr: t.abbreviation,
      logo: teamLogo(t),
    },
  }
}

function normalizeStatCategories(raw) {
  const cats =
    raw?.results?.stats?.categories ?? raw?.statistics?.splits?.categories ?? raw?.splits?.categories ?? []
  return cats
    .map((c) => ({
      name: c.displayName ?? c.name,
      stats: (c.stats ?? [])
        .filter((s) => s.displayValue != null && s.displayValue !== '')
        .map((s) => ({
          name: s.displayName ?? s.shortDisplayName ?? s.name,
          value: s.perGameDisplayValue && /per ?game/i.test(s.displayName ?? '') ? s.perGameDisplayValue : s.displayValue,
          rank: s.rankDisplayValue ?? (s.rank ? `#${s.rank}` : ''),
        })),
    }))
    .filter((c) => c.stats.length)
}

// ESPN's NFL /teams/{id} endpoint sends no CORS headers, so a browser can't read it;
// the schedule payload carries the same team header (name, color, record, standing).
export async function fetchTeam(id) {
  const base = `${SITE}/teams/${id}`
  const [schedule, stats] = await Promise.allSettled([getJSON(`${base}/schedule`), getJSON(`${base}/statistics`)])
  if (schedule.status === 'rejected') throw schedule.reason
  const t = schedule.value.team ?? {}
  return {
    id: t.id ?? id,
    name: t.displayName ?? t.name,
    short: t.name ?? t.location,
    nickname: t.name,
    abbr: t.abbreviation,
    color: t.color ? `#${t.color}` : null,
    logo: teamLogo(t),
    standing: t.standingSummary ?? '',
    records: t.recordSummary ? [{ type: 'total', label: 'Record', summary: t.recordSummary }] : [],
    link: t.clubhouse ?? null,
    games: (schedule.value.events ?? []).map((e) => normalizeScheduleEvent(e, t.id ?? id)),
    stats: stats.status === 'fulfilled' ? normalizeStatCategories(stats.value) : [],
  }
}

// ---------- team directory (for adding favorites) ----------

export async function fetchTeams() {
  const raw = await getJSON(`${SITE}/teams?limit=100`)
  return (raw.sports?.[0]?.leagues?.[0]?.teams ?? [])
    .map(({ team: t }) => ({
      id: t.id,
      name: t.shortDisplayName ?? t.location ?? t.displayName,
      fullName: t.displayName,
      abbr: t.abbreviation,
      logo: teamLogo(t),
    }))
    .filter((t) => t.id)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}
