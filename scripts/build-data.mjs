// Builds public/data/nfl.json: every NFL draft pick and major award winner since
// 2000, grouped by NFL team id. Runs in CI before the Vite build; on failure it
// writes what it has so the site still deploys.
import { mkdir, writeFile } from 'node:fs/promises'

const FIRST = 2000
const last = new Date().getFullYear()
const DRAFT = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/draft'
const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl'
// ESPN award ids, with the short label the site shows.
const AWARDS = { 477: 'MVP', 478: 'Offensive Player of the Year', 479: 'Defensive Player of the Year', 482: 'Coach of the Year', 317: 'Super Bowl MVP' }

const draft = {}
const awards = {}
const json = async (url) => {
  const res = await fetch(url.replace(/^http:/, 'https:'))
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}
const idOf = (ref) => ref?.match(/\/(?:teams|athletes|coaches)\/(\d+)/)?.[1]

let drafts = 0
let awardYears = 0

for (let year = last; year >= FIRST; year--) {
  try {
    const raw = await json(`${DRAFT}?season=${year}`)
    if (raw.picks?.length && Number(raw.year) === year) {
      const positions = Object.fromEntries((raw.positions ?? []).map((p) => [p.id, p.abbreviation]))
      for (const p of raw.picks) {
        const a = p.athlete
        if (!a || p.status !== 'SELECTION_MADE') continue
        ;(draft[p.teamId] ??= []).push([year, p.round, p.overall, a.displayName, positions[a.position?.id] ?? '', a.team?.location ?? a.team?.shortDisplayName ?? ''])
      }
      drafts++
    }
  } catch (err) {
    console.warn(`draft ${year}: ${err.message}`)
  }

  try {
    let got = false
    for (const [id, label] of Object.entries(AWARDS)) {
      const award = await json(`${CORE}/seasons/${year}/awards/${id}`).catch(() => null)
      for (const w of award?.winners ?? []) {
        const teamId = idOf(w.team?.$ref)
        const who = w.athlete?.$ref ?? w.coach?.$ref
        if (!teamId || !who) continue
        const person = await json(who).catch(() => null)
        const name = person?.displayName ?? person?.fullName
        if (!name) continue
        ;(awards[teamId] ??= []).push([year, label, name])
        got = true
      }
    }
    if (got) awardYears++
  } catch (err) {
    console.warn(`awards ${year}: ${err.message}`)
  }
}

await mkdir('public/data', { recursive: true })
await writeFile('public/data/nfl.json', JSON.stringify({ built: new Date().toISOString(), draft, awards }))
console.log(`nfl.json: ${drafts} drafts, ${awardYears} award seasons, ${Object.keys(draft).length} teams`)
