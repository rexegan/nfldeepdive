import { useEffect, useState } from 'react'
import { fetchTeam, teamSiteUrl } from '../api.js'
import Roster, { PlayerView } from './Roster.jsx'
import FunFacts from './FunFacts.jsx'
import Coaches from './Coaches.jsx'
import { useData, useFavorites } from '../hooks.js'
import { closeTeam, useOpenTeam } from '../team.js'
import TeamLogo from './TeamLogo.jsx'
import TeamName from './TeamName.jsx'
import { ErrorBox, Loading } from './Status.jsx'

const shortDate = (iso) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })

function summarize(games) {
  const done = games.filter((g) => g.result)
  const avg = (key) => (done.length ? (done.reduce((n, g) => n + g[key], 0) / done.length).toFixed(1) : null)
  let streak = ''
  if (done.length) {
    const last = done[done.length - 1].result
    let n = 0
    for (let i = done.length - 1; i >= 0 && done[i].result === last; i--) n++
    streak = `${last}${n}`
  }
  return {
    form: done.slice(-5),
    streak,
    pointsFor: avg('pointsFor'),
    pointsAgainst: avg('pointsAgainst'),
    next: games.find((g) => g.state !== 'post'),
  }
}

function Body({ open }) {
  const { data: team, error, loading, refresh } = useData(() => fetchTeam(open.id), [open.id])
  const { isFav, toggle } = useFavorites()
  const [tab, setTab] = useState('overview')
  const [player, setPlayer] = useState(null)

  if (player) return <PlayerView player={player} onBack={() => setPlayer(null)} />

  if (loading)
    return (
      <>
        <div className="tc-head">
          <TeamLogo src={open.logo} size={56} />
          <h2>{open.name}</h2>
        </div>
        <Loading label="Loading team…" />
      </>
    )
  if (error) return <ErrorBox error={error} onRetry={refresh} />

  const s = summarize(team.games)
  const overall = team.records.find((r) => r.type === 'total') ?? team.records[0]
  const scoring = 'Points'
  const fav = isFav(team.id)

  return (
    <>
      <div className="tc-head" style={team.color ? { '--team': team.color } : undefined}>
        <TeamLogo src={team.logo} size={56} />
        <div className="tc-title">
          <h2>
            {team.name}
          </h2>
          <p className="muted">
            {team.standing || 'NFL'}
          </p>
        </div>
        <button
          className={`star${fav ? ' on' : ''}`}
          onClick={() => toggle({ id: team.id, name: team.short ?? team.name, logo: team.logo })}
          aria-label={fav ? 'Unfollow team' : 'Follow team'}
        >
          {fav ? '★' : '☆'}
        </button>
      </div>

      <div className="tc-stats">
        <div className="tc-big">
          <span className="label">Record</span>
          <strong>{overall?.summary ?? '—'}</strong>
        </div>
        {team.records
          .filter((r) => r !== overall && r.summary)
          .map((r) => (
            <div key={r.type + r.label} className="tc-big">
              <span className="label">{r.label}</span>
              <strong>{r.summary}</strong>
            </div>
          ))}
        {s.streak && (
          <div className="tc-big">
            <span className="label">Streak</span>
            <strong>{s.streak}</strong>
          </div>
        )}
        {s.pointsFor && (
          <div className="tc-big">
            <span className="label">{scoring} for / game</span>
            <strong>{s.pointsFor}</strong>
          </div>
        )}
        {s.pointsAgainst && (
          <div className="tc-big">
            <span className="label">{scoring} allowed / game</span>
            <strong>{s.pointsAgainst}</strong>
          </div>
        )}
        {team.link && (
          <a className="tc-action" href={team.link} target="_blank" rel="noreferrer">
            Full Team Page
          </a>
        )}
        <a className="tc-action" href={teamSiteUrl(team.name)} target="_blank" rel="noreferrer">
          Team Website
        </a>
        {[
          ['roster', 'Roster'],
          ['facts', 'Fun Facts'],
          ['coaches', 'Coaching Staff'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`tc-action${tab === id ? ' on' : ''}`}
            onClick={() => setTab(tab === id ? 'overview' : id)}
          >
            {tab === id ? `‹ ${label}` : label}
          </button>
        ))}
      </div>

      {tab === 'roster' ? (
        <Roster teamId={team.id} onPlayer={setPlayer} />
      ) : tab === 'facts' ? (
        <FunFacts team={team} />
      ) : tab === 'coaches' ? (
        <Coaches team={team} />
      ) : (
        <>

      {s.form.length > 0 && (
        <div className="tc-form">
          <span className="label">Last {s.form.length}</span>
          {s.form.map((g) => (
            <span key={g.id} className={`form-pill ${g.result}`} title={`${g.result} ${g.score} vs ${g.opponent.name}`}>
              {g.result}
            </span>
          ))}
        </div>
      )}

      {s.next && (
        <div className="tc-next">
          <span className="label">{s.next.state === 'in' ? 'Playing now' : 'Next game'}</span>
          <span>
            {s.next.home ? 'vs' : '@'} <TeamName team={s.next.opponent} /> · {shortDate(s.next.date)} · {s.next.detail}
          </span>
        </div>
      )}

      {team.games.length > 0 && (
        <details className="tc-section" open>
          <summary>Schedule & results</summary>
          <ul className="tc-schedule">
            {team.games.map((g) => (
              <li key={g.id}>
                <span className="muted when">{shortDate(g.date)}</span>
                <span className="ha muted">{g.neutral ? 'vs*' : g.home ? 'vs' : '@'}</span>
                <span className="opp">
                  <TeamLogo src={g.opponent.logo} size={18} />
                  <TeamName team={g.opponent} />
                </span>
                <span className="res">
                  {g.result ? (
                    <a href={g.link ?? undefined} target="_blank" rel="noreferrer" className={`r-${g.result}`}>
                      {g.result} {g.score}
                    </a>
                  ) : (
                    <span className="muted">{g.state === 'in' ? g.detail : new Date(g.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted tiny">vs* = neutral site</p>
        </details>
      )}

      {team.stats.map((c, i) => (
        <details key={c.name} className="tc-section" open={i === 0}>
          <summary>{c.name} stats</summary>
          <dl className="tc-statlist">
            {c.stats.map((st) => (
              <div key={st.name}>
                <dt>{st.name}</dt>
                <dd>
                  {st.value}
                  {st.rank && <span className="muted nat-rank"> {st.rank}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ))}

        </>
      )}
    </>
  )
}

export default function TeamCard() {
  const open = useOpenTeam()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && closeTeam()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null
  return (
    <div className="tc-overlay" onClick={closeTeam}>
      <aside className="tc-panel" role="dialog" aria-modal="true" aria-label={open.name} onClick={(e) => e.stopPropagation()}>
        <button className="tc-close" onClick={closeTeam} aria-label="Close">
          ×
        </button>
        <Body key={open.id} open={open} />
      </aside>
    </div>
  )
}
