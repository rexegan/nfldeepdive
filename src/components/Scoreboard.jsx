import { useMemo, useState } from 'react'
import { DIVISIONS, divisionMembers, fetchScoreboard, withUpsets } from '../api.js'
import { buildHash, useData, useFavorites } from '../hooks.js'
import GameCard from './GameCard.jsx'
import { EditTeamsButton } from './MyTeamsEditor.jsx'
import { SearchBox, matchesTeam } from './Search.jsx'
import { ErrorBox, Loading, Updated } from './Status.jsx'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'My Teams' },
  { id: 'live', label: 'Live' },
]

const hasLive = (d) => d.events.some((e) => e.state === 'in')

const toKey = (d) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
const dayName = (key) =>
  new Date(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6)).toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

// Yesterday's finished games where the winner was the betting underdog. The NFL
// rarely plays on a given weekday, so with no games yesterday it falls back to
// the most recent game day this week.
async function loadUpsets(o) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  let day = toKey(yesterday)
  let board = await fetchScoreboard({ date: day }, o)
  if (!board.events.some((g) => g.state === 'post')) {
    const week = await fetchScoreboard({}, o)
    const done = week.events.filter((g) => g.state === 'post')
    if (done.length) {
      day = done.map((g) => toKey(new Date(g.date))).sort().at(-1)
      board = { ...week, events: done.filter((g) => toKey(new Date(g.date)) === day) }
    }
  }
  const finals = board.events.filter((g) => g.state === 'post')
  return { ...board, upsetDay: day, wasYesterday: day === toKey(yesterday), played: finals.length, events: await withUpsets(finals, o) }
}

export default function Scoreboard({ params }) {
  const { week, st, d: division } = params
  const upsets = params.m === 'upsets'
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const { isFav, list: favList } = useFavorites()

  const { data, error, loading, updated, polling, refresh } = useData(
    async (o) => {
      if (upsets) return loadUpsets(o)
      const [board, members] = await Promise.all([
        fetchScoreboard({ week, seasonType: st }, o),
        division ? divisionMembers(division) : null,
      ])
      if (!members) return board
      const inDiv = (t) => t && members.has(String(t.id))
      return { ...board, events: board.events.filter((g) => inDiv(g.home) || inDiv(g.away)) }
    },
    [week, st, division, upsets],
    { shouldPoll: hasLive },
  )

  const go = (next) => {
    window.location.hash = buildHash('scores', { ...params, ...next })
  }

  const games = useMemo(() => {
    if (!data) return []
    return data.events.filter((g) => {
      const teams = [g.home, g.away].filter(Boolean)
      if (filter === 'mine' && !teams.some((t) => isFav(t.id))) return false
      if (filter === 'live' && g.state !== 'in') return false
      if (query && !teams.some((t) => matchesTeam(t, query))) return false
      return true
    })
    // favList is read so the list re-filters when a team is followed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, query, favList.length])

  const sections = [
    { id: 'in', title: 'Live', games: games.filter((g) => g.state === 'in') },
    { id: 'pre', title: 'Upcoming', games: games.filter((g) => g.state === 'pre') },
    { id: 'post', title: 'Final', games: games.filter((g) => g.state === 'post') },
  ]

  const currentWeek = data?.calendar.find(
    (w) => String(w.week) === String(week ?? data?.week) && String(w.seasonType) === String(st ?? data?.seasonType),
  )

  return (
    <section>
      <div className="toolbar">
        <div className="seg">
          <button className={!upsets ? 'on' : ''} onClick={() => go({ m: null })}>
            By week
          </button>
          <button className={upsets ? 'on' : ''} onClick={() => go({ m: 'upsets', week: null, st: null })}>
            Yesterday's Upsets
          </button>
        </div>
      </div>

      <div className="toolbar" style={upsets ? { display: 'none' } : undefined}>
        <div className="date-nav">
          <select
            aria-label="Week"
            value={currentWeek ? `${currentWeek.seasonType}:${currentWeek.week}` : ''}
            onChange={(e) => {
              const [s, w] = e.target.value.split(':')
              go({ st: s, week: w })
            }}
          >
            {!currentWeek && <option value="">Current week</option>}
            {data?.calendar.map((w) => (
              <option key={`${w.seasonType}:${w.week}`} value={`${w.seasonType}:${w.week}`}>
                {w.seasonType !== '2' && w.group ? `${w.group}: ` : ''}
                {w.label}
                {w.detail ? ` (${w.detail})` : ''}
              </option>
            ))}
          </select>
          {(week || st) && (
            <button className="btn ghost" onClick={() => go({ week: null, st: null })}>
              This week
            </button>
          )}
        </div>
        <select aria-label="Division" value={division ?? ''} onChange={(e) => go({ d: e.target.value || null })}>
          <option value="">All teams</option>
          {DIVISIONS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar">
        <div className="filter-group">
          <div className="seg small">
            {FILTERS.map((f) => (
              <button key={f.id} className={f.id === filter ? 'on' : ''} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <EditTeamsButton />
        </div>
        <SearchBox value={query} onChange={setQuery} />
      </div>

      <div className="status-bar">
        <Updated updated={updated} polling={polling} onRefresh={refresh} />
      </div>

      {loading && <Loading label="Loading games…" />}
      {error && !data && <ErrorBox error={error} onRetry={refresh} />}

      {upsets && data?.upsetDay && data.played > 0 && (
        <p className="muted upset-head">
          {data.wasYesterday ? 'Yesterday' : `No games yesterday, so showing ${dayName(data.upsetDay)}`}: {data.events.length} upset
          {data.events.length === 1 ? '' : 's'} in {data.played} final{data.played === 1 ? '' : 's'}. An upset is a win by the
          betting underdog.
        </p>
      )}

      {upsets && data && !data.events.length && data.played > 0 && (
        <div className="state">
          <p>No upsets. The favorites held serve.</p>
        </div>
      )}

      {data && !data.events.length && !(upsets && data.played > 0) && (
        <div className="state">
          <p>No games {upsets ? 'yesterday' : division ? `for ${division} this week` : 'this week'}.</p>
          {data.seasonStart && new Date(data.seasonStart) > new Date() && (
            <p className="muted">
              Season starts {new Date(data.seasonStart).toLocaleDateString([], { month: 'long', day: 'numeric' })}.
            </p>
          )}
        </div>
      )}

      {data && data.events.length > 0 && !games.length && (
        <div className="state">
          <p>No games match{filter === 'mine' ? '. Tap ☆ next to a team to follow it.' : '.'}</p>
        </div>
      )}

      {sections.map(
        (s) =>
          s.games.length > 0 && (
            <div key={s.id} className="game-section">
              <h3>
                {s.title} <span className="count">{s.games.length}</span>
              </h3>
              <div className="grid">
                {s.games.map((g) => (
                  <GameCard key={g.id} game={g} />
                ))}
              </div>
            </div>
          ),
      )}

      {!upsets && data?.byes.length > 0 && (
        <p className="muted sub">Bye week: {data.byes.map((t) => t.fullName).join(', ')}</p>
      )}
    </section>
  )
}
