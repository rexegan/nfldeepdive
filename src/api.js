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

/** opts: { week, seasonType } (both optional = current week), or { date: 'YYYYMMDD' } for one day. */
export async function fetchScoreboard(opts = {}, fetchOpts) {
  const q = new URLSearchParams({ limit: '100' })
  if (opts.date) q.set('dates', opts.date)
  else {
    if (opts.week) q.set('week', opts.week)
    if (opts.seasonType) q.set('seasontype', opts.seasonType)
  }

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

function recordFrom(games) {
  const w = games.filter((g) => g.result === 'W').length
  const l = games.filter((g) => g.result === 'L').length
  const t = games.filter((g) => g.result === 'T').length
  return games.length ? `${w}-${l}${t ? `-${t}` : ''}` : null
}

// ESPN's NFL /teams/{id} endpoint sends no CORS headers, so a browser can't read it;
// the schedule payload carries the same team header (name, color, record, standing).
export async function fetchTeam(id) {
  const base = `${SITE}/teams/${id}`
  const [schedule, stats] = await Promise.allSettled([getJSON(`${base}/schedule`), getJSON(`${base}/statistics`)])
  if (schedule.status === 'rejected') throw schedule.reason
  const t = schedule.value.team ?? {}
  const games = (schedule.value.events ?? []).map((e) => normalizeScheduleEvent(e, t.id ?? id))
  const done = games.filter((g) => g.result)
  const records = [
    { type: 'total', label: 'Record', summary: t.recordSummary || recordFrom(done) },
    { type: 'home', label: 'Home', summary: recordFrom(done.filter((g) => g.home && !g.neutral)) },
    { type: 'away', label: 'Away', summary: recordFrom(done.filter((g) => !g.home && !g.neutral)) },
    { type: 'neutral', label: 'Neutral', summary: recordFrom(done.filter((g) => g.neutral)) },
  ].filter((r) => r.summary)
  return {
    id: t.id ?? id,
    seasonYear: schedule.value.season?.year ?? null,
    name: t.displayName ?? t.name,
    short: t.name ?? t.location,
    nickname: t.name,
    abbr: t.abbreviation,
    color: t.color ? `#${t.color}` : null,
    logo: teamLogo(t),
    standing: t.standingSummary ?? '',
    records,
    link: t.clubhouse ?? null,
    games,
    stats: stats.status === 'fulfilled' ? normalizeStatCategories(stats.value) : [],
  }
}

// ---------- team directory (for adding favorites) ----------

// Built from standings, since ESPN's /teams list has no CORS headers either.
export async function fetchTeams() {
  const groups = await fetchStandings('divisions')
  return groups
    .flatMap((g) => g.entries.map((e) => ({ ...e.team, conference: g.name })))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

// ---------- divisions & conferences (for following) ----------

export const DIVISIONS = [
  'AFC',
  'NFC',
  'AFC East',
  'AFC North',
  'AFC South',
  'AFC West',
  'NFC East',
  'NFC North',
  'NFC South',
  'NFC West',
]

/** Team ids in a conference ('AFC') or division ('AFC East'). */
export async function divisionMembers(label) {
  const groups = await fetchStandings('divisions')
  return new Set(
    groups.filter((g) => g.name === label || g.conference === label).flatMap((g) => g.entries.map((e) => String(e.team.id))),
  )
}

// ---------- roster & players ----------

const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl'

const experience = (years) => (years == null ? '' : years === 0 ? 'Rookie' : `${years} yr${years === 1 ? '' : 's'} pro`)

function normalizePlayer(a) {
  return {
    id: a.id,
    name: a.fullName ?? a.displayName,
    jersey: a.jersey ?? '',
    position: a.position?.abbreviation ?? '',
    positionName: a.position?.displayName ?? a.position?.name ?? '',
    headshot: a.headshot?.href ?? null,
    height: a.displayHeight ?? '',
    weight: a.displayWeight ?? '',
    age: a.age ?? '',
    year: experience(a.experience?.years),
    college: a.college?.name ?? '',
    hometown: [a.birthPlace?.city, a.birthPlace?.state ?? a.birthPlace?.country].filter(Boolean).join(', '),
    status: a.status?.name && a.status.name !== 'Active' ? a.status.name : '',
  }
}

const GROUP_LABEL = { offense: 'Offense', defense: 'Defense', specialTeam: 'Special Teams', specialteam: 'Special Teams' }

/** Returns { groups: [{ label, players }], coach } with the roster split by unit. */
export async function fetchRoster(teamId) {
  const raw = await getJSON(`${SITE}/teams/${teamId}/roster`)
  const athletes = raw.athletes ?? []
  const groups = athletes.some((a) => Array.isArray(a.items))
    ? athletes.map((g) => ({
        label: GROUP_LABEL[g.position] ?? g.position ?? 'Players',
        players: (g.items ?? []).map(normalizePlayer),
      }))
    : [{ label: 'Players', players: athletes.map(normalizePlayer) }]
  const coach = raw.coach?.[0]
  return {
    groups: groups.filter((g) => g.players.length),
    coach: coach ? [coach.firstName, coach.lastName].filter(Boolean).join(' ') : '',
  }
}

function normalizeStatsTable(s) {
  // overview.statistics: { labels, displayNames, splits: [{ displayName, stats: [...] }] }
  if (!s?.labels?.length || !s.splits?.length) return null
  return {
    labels: s.labels,
    names: s.displayNames ?? s.labels,
    rows: s.splits.map((r) => ({ label: r.displayName, values: r.stats ?? [] })),
  }
}

export async function fetchAthlete(id) {
  const base = `${WEB}/athletes/${id}`
  const [info, overview] = await Promise.allSettled([getJSON(base), getJSON(`${base}/overview`)])
  if (info.status === 'rejected') throw info.reason
  const a = info.value.athlete ?? {}
  const ov = overview.status === 'fulfilled' ? overview.value : {}
  return {
    id: a.id ?? id,
    name: a.displayName ?? a.fullName,
    jersey: a.displayJersey ?? (a.jersey ? `#${a.jersey}` : ''),
    position: a.position?.displayName ?? '',
    headshot: a.headshot?.href ?? null,
    height: a.displayHeight ?? '',
    weight: a.displayWeight ?? '',
    age: a.age ?? '',
    year: a.displayExperience ?? experience(a.experience?.years),
    college: a.college?.name ?? '',
    draft: a.displayDraft ?? a.draft?.displayText ?? '',
    hometown: a.displayBirthPlace ?? '',
    team: a.team?.displayName ?? '',
    status: a.status?.name && a.status.name !== 'Active' ? a.status.name : '',
    link: a.links?.find((l) => l.rel?.includes('playercard'))?.href ?? a.links?.[0]?.href ?? null,
    summary: a.statsSummary?.statistics?.length
      ? {
          title: a.statsSummary.displayName ?? 'Season stats',
          stats: a.statsSummary.statistics.map((s) => ({
            name: s.shortDisplayName ?? s.abbreviation ?? s.displayName,
            full: s.displayName,
            value: s.displayValue,
            rank: s.rankDisplayValue ?? '',
          })),
        }
      : null,
    table: normalizeStatsTable(ov.statistics),
    news: (ov.news ?? []).slice(0, 5).map((n) => ({
      headline: n.headline,
      link: n.links?.web?.href ?? null,
      date: n.published ?? n.lastModified ?? null,
    })),
  }
}

/** Team website: ESPN doesn't publish it, so jump to the top search result. */
export function teamSiteUrl(teamName) {
  return `https://duckduckgo.com/?q=${encodeURIComponent(`\\${teamName} official website`)}`
}

// ---------- fun facts & coaches ----------

const https = (url) => url?.replace(/^http:/, 'https:')

// Super Bowl champions by franchise (ESPN abbreviations). The game year is the season + 1.
const SUPER_BOWLS = [
  ['I', 1966, 'GB'], ['II', 1967, 'GB'], ['III', 1968, 'NYJ'], ['IV', 1969, 'KC'], ['V', 1970, 'IND'],
  ['VI', 1971, 'DAL'], ['VII', 1972, 'MIA'], ['VIII', 1973, 'MIA'], ['IX', 1974, 'PIT'], ['X', 1975, 'PIT'],
  ['XI', 1976, 'LV'], ['XII', 1977, 'DAL'], ['XIII', 1978, 'PIT'], ['XIV', 1979, 'PIT'], ['XV', 1980, 'LV'],
  ['XVI', 1981, 'SF'], ['XVII', 1982, 'WSH'], ['XVIII', 1983, 'LV'], ['XIX', 1984, 'SF'], ['XX', 1985, 'CHI'],
  ['XXI', 1986, 'NYG'], ['XXII', 1987, 'WSH'], ['XXIII', 1988, 'SF'], ['XXIV', 1989, 'SF'], ['XXV', 1990, 'NYG'],
  ['XXVI', 1991, 'WSH'], ['XXVII', 1992, 'DAL'], ['XXVIII', 1993, 'DAL'], ['XXIX', 1994, 'SF'], ['XXX', 1995, 'DAL'],
  ['XXXI', 1996, 'GB'], ['XXXII', 1997, 'DEN'], ['XXXIII', 1998, 'DEN'], ['XXXIV', 1999, 'LAR'], ['XXXV', 2000, 'BAL'],
  ['XXXVI', 2001, 'NE'], ['XXXVII', 2002, 'TB'], ['XXXVIII', 2003, 'NE'], ['XXXIX', 2004, 'NE'], ['XL', 2005, 'PIT'],
  ['XLI', 2006, 'IND'], ['XLII', 2007, 'NYG'], ['XLIII', 2008, 'PIT'], ['XLIV', 2009, 'NO'], ['XLV', 2010, 'GB'],
  ['XLVI', 2011, 'NYG'], ['XLVII', 2012, 'BAL'], ['XLVIII', 2013, 'SEA'], ['XLIX', 2014, 'NE'], ['50', 2015, 'DEN'],
  ['LI', 2016, 'NE'], ['LII', 2017, 'PHI'], ['LIII', 2018, 'NE'], ['LIV', 2019, 'KC'], ['LV', 2020, 'TB'],
  ['LVI', 2021, 'LAR'], ['LVII', 2022, 'KC'], ['LVIII', 2023, 'KC'], ['LIX', 2024, 'PHI'], ['LX', 2025, 'SEA'],
]

export const superBowlsFor = (abbr) =>
  SUPER_BOWLS.filter(([, , a]) => a === abbr).map(([numeral, season]) => ({ numeral, season, year: season + 1 }))

let factsPromise = null
/** Awards and draft picks by NFL team id, built into the site at deploy time (scripts/build-data.mjs). */
export function fetchFacts() {
  factsPromise ??= fetch('./data/nfl.json')
    .then((r) => (r.ok ? r.json() : { awards: {}, draft: {} }))
    .catch(() => ({ awards: {}, draft: {} }))
  return factsPromise
}

export async function factsFor(teamId) {
  const { awards, draft } = await fetchFacts()
  return {
    awards: (awards[teamId] ?? []).map(([year, award, name]) => ({ year, award, name })),
    picks: (draft[teamId] ?? []).map(([year, round, overall, name, pos, college]) => ({
      year,
      round,
      overall,
      name,
      pos,
      college,
    })),
  }
}

/** Wikipedia page summary (CORS-enabled REST API), or null. */
export async function fetchWiki(title) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`)
    if (!res.ok) return null
    const w = await res.json()
    if (w.type === 'disambiguation') return null
    return {
      title: w.title,
      description: w.description ?? '',
      extract: w.extract ?? '',
      image: w.originalimage?.source ?? w.thumbnail?.source ?? null,
      thumb: w.thumbnail?.source ?? null,
      link: w.content_urls?.desktop?.page ?? null,
    }
  } catch {
    return null
  }
}

const CORE_SPORTS = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl'

/** Head coach from ESPN's core API (the only coach ESPN publishes), plus a Wikipedia bio. */
export async function fetchHeadCoach(teamId, seasonYear) {
  const year = seasonYear ?? new Date().getFullYear()
  const list = await getJSON(`${CORE_SPORTS}/seasons/${year}/teams/${teamId}/coaches`)
  const ref = list.items?.[0]?.$ref
  if (!ref) return null
  const coach = await getJSON(https(ref))
  const person = coach.person?.$ref ? await getJSON(https(coach.person.$ref)).catch(() => coach) : coach
  const career = person.careerRecords?.[0]?.$ref
    ? await getJSON(https(person.careerRecords[0].$ref)).catch(() => null)
    : null
  const seasonRecord = coach.records?.[0]?.record?.$ref
    ? await getJSON(https(coach.records[0].record.$ref)).catch(() => null)
    : null
  const name = [person.firstName ?? coach.firstName, person.lastName ?? coach.lastName].filter(Boolean).join(' ')
  const wiki = await fetchWiki(name)
  return {
    name,
    seasons: person.coachSeasons?.length ?? null,
    career: career?.summary ?? career?.displayValue ?? null,
    season: seasonRecord?.summary ?? seasonRecord?.displayValue ?? null,
    // Only trust the Wikipedia page if it's about a coach.
    wiki: wiki && /coach/i.test(`${wiki.description} ${wiki.extract}`) ? wiki : null,
  }
}

// ---------- upsets ----------

/**
 * Finished games where the winner was the betting underdog. ESPN drops odds from
 * the scoreboard once a game ends, but the core API keeps them. Adds
 * game.upset = { spread } (points the winner was getting, 0 for a pick'em).
 */
export async function withUpsets(events, fetchOpts) {
  const done = events.filter((g) => g.state === 'post' && g.home && g.away)
  const checked = await Promise.all(
    done.map(async (g) => {
      try {
        const raw = await getJSON(`${CORE_SPORTS}/events/${g.id}/competitions/${g.id}/odds`, fetchOpts)
        const odds = raw.items?.[0]
        if (!odds) return null
        const winner = g.home.winner ? 'home' : g.away.winner ? 'away' : null
        if (!winner) return null
        const side = odds[`${winner}TeamOdds`]
        if (!side?.underdog) return null
        return { ...g, upset: { spread: Math.abs(Number(odds.spread) || 0) } }
      } catch {
        return null
      }
    }),
  )
  return checked.filter(Boolean)
}
