import { useMemo, useState } from 'react'
import { fetchScoreboard } from '../api.js'
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

export default function Scoreboard({ params }) {
  const { week, st } = params
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const { isFav, list: favList } = useFavorites()

  const { data, error, loading, updated, polling, refresh } = useData(
    (o) => fetchScoreboard({ week, seasonType: st }, o),
    [week, st],
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

      {data && !data.events.length && (
        <div className="state">
          <p>No games this week.</p>
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

      {data?.byes.length > 0 && (
        <p className="muted sub">Bye week: {data.byes.map((t) => t.fullName).join(', ')}</p>
      )}
    </section>
  )
}
