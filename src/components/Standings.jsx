import { useState } from 'react'
import { DIVISIONS, divisionMembers, fetchStandings } from '../api.js'
import { buildHash, useData } from '../hooks.js'
import { SearchBox, matchesTeam } from './Search.jsx'
import TeamLogo from './TeamLogo.jsx'
import TeamName from './TeamName.jsx'
import { ErrorBox, Loading } from './Status.jsx'

const LEVELS = [
  { id: 'divisions', label: 'Divisions' },
  { id: 'conference', label: 'Conference (playoff seeds)' },
]

export default function Standings({ params }) {
  const level = LEVELS.some((l) => l.id === params.level) ? params.level : 'divisions'
  const division = params.d
  const { data, error, loading, refresh } = useData(
    async () => {
      const [groups, members] = await Promise.all([fetchStandings(level), division ? divisionMembers(division) : null])
      return members
        ? groups
            .map((g) => ({ ...g, entries: g.entries.filter((e) => members.has(String(e.team.id))) }))
            .filter((g) => g.entries.length)
        : groups
    },
    [level, division],
  )
  const [query, setQuery] = useState('')

  const groups = (data ?? [])
    .map((g) => ({ ...g, entries: g.entries.filter((e) => matchesTeam(e.team, query)) }))
    .filter((g) => g.entries.length)

  return (
    <section>
      <div className="toolbar">
        <div className="seg">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              className={l.id === level ? 'on' : ''}
              onClick={() => (window.location.hash = buildHash('standings', { ...params, level: l.id }))}
            >
              {l.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Division"
          value={division ?? ''}
          onChange={(e) => (window.location.hash = buildHash('standings', { ...params, d: e.target.value || null }))}
        >
          <option value="">All teams</option>
          {DIVISIONS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <SearchBox value={query} onChange={setQuery} />
      </div>

      {loading && <Loading label="Loading standings…" />}
      {error && <ErrorBox error={error} onRetry={refresh} />}
      {data && !groups.length && (
        <div className="state">{query ? 'No teams match that search.' : 'No standings available yet.'}</div>
      )}

      <div className="standings-grid">
        {groups.map((g) => (
          <div key={g.id} className="conf-card">
            <h3>{g.name}</h3>
            <table className="standings">
              <thead>
                <tr>
                  {level === 'conference' && <th>#</th>}
                  <th className="left">Team</th>
                  <th>W-L-T</th>
                  <th>Div</th>
                  <th>Conf</th>
                  <th>PF</th>
                  <th>PA</th>
                  <th>Diff</th>
                  <th>Strk</th>
                </tr>
              </thead>
              <tbody>
                {g.entries.map((e) => (
                  <tr key={e.team.id}>
                    {level === 'conference' && <td>{e.seed ?? ''}</td>}
                    <td className="left">
                      <span className="team-inline">
                        <TeamLogo src={e.team.logo} size={20} />
                        <TeamName team={e.team} />
                      </span>
                    </td>
                    <td>{e.overall}</td>
                    <td>{e.div}</td>
                    <td>{e.conf}</td>
                    <td>{e.pf}</td>
                    <td>{e.pa}</td>
                    <td>{e.diff}</td>
                    <td>{e.streak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  )
}
