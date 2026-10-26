import { useEffect, useState } from 'react'
import { fetchGame } from '../api.js'
import { useData } from '../hooks.js'
import { closeGame, useOpenGame } from '../team.js'
import { Headshot, PlayerView } from './Roster.jsx'
import TeamLogo from './TeamLogo.jsx'
import TeamName from './TeamName.jsx'
import { ErrorBox, Loading } from './Status.jsx'

const TABS = [
  { id: 'game', label: 'Game' },
  { id: 'box', label: 'Box Score' },
  { id: 'stats', label: 'Team Stats' },
  { id: 'plays', label: 'Plays' },
]

const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

const quarter = (n) => (!n ? '' : n <= 4 ? `Q${n}` : n === 5 ? 'OT' : `${n - 4}OT`)

function Scorebug({ g }) {
  const pre = g.state === 'pre'
  const row = (t, side) => (
    <div className={`gd-team${g.state === 'post' && !t.winner ? ' lost' : ''}`}>
      <TeamLogo src={t.logo} size={56} />
      <TeamName team={t} className="gd-name" />
      <span className="muted tiny">{[t.record, side].filter(Boolean).join(' · ')}</span>
    </div>
  )
  return (
    <div className="gd-score">
      {row(g.away, 'Away')}
      <div className="gd-mid">
        <div className="gd-nums">
          <strong className={g.away.winner ? 'won' : ''}>{pre ? '' : g.away.score}</strong>
          <span className="gd-status">
            {g.state === 'in' && <span className="live-dot" />}
            {pre ? 'Upcoming' : g.detail}
          </span>
          <strong className={g.home.winner ? 'won' : ''}>{pre ? '' : g.home.score}</strong>
        </div>
        {g.situation && (
          <span className="gd-sit">
            {g.possession && <span className="poss">●</span>} {g.situation}
          </span>
        )}
        <span className="muted tiny">{when(g.date)}</span>
      </div>
      {row(g.home, 'Home')}
    </div>
  )
}

function Leaders({ g, onPlayer }) {
  if (!g.leaders.length) return null
  const side = (l) =>
    l ? (
      <button className="gd-leader" onClick={() => onPlayer({ id: l.id, name: l.fullName, jersey: l.jersey, position: l.position })}>
        <Headshot src={l.headshot} name={l.fullName} size={44} />
        <span className="gd-leader-text">
          <strong>{l.value ?? ''}</strong>
          <span>
            {l.name} <span className="muted">{l.position}</span>
          </span>
          <span className="muted tiny">{l.line}</span>
        </span>
      </button>
    ) : (
      <span className="muted tiny gd-none">None</span>
    )
  return (
    <section className="tc-section">
      <h4>{g.state === 'pre' ? 'Season leaders' : 'Game leaders'}</h4>
      <div className="gd-leaders-head">
        <span>
          <TeamLogo src={g.away.logo} size={20} /> {g.away.abbr}
        </span>
        <span>
          {g.home.abbr} <TeamLogo src={g.home.logo} size={20} />
        </span>
      </div>
      {g.leaders.map((r) => (
        <div key={r.name} className="gd-leader-row">
          {side(r.away)}
          <span className="gd-cat">{r.label}</span>
          {side(r.home)}
        </div>
      ))}
    </section>
  )
}

function Scoring({ g }) {
  if (!g.scoring.length) return null
  return (
    <section className="tc-section">
      <h4>Scoring summary</h4>
      <ul className="gd-scoring">
        {g.scoring.map((p) => (
          <li key={p.id}>
            <TeamLogo src={p.team?.logo} size={30} />
            <div>
              <strong>{p.type}</strong>
              <span className="muted tiny">
                {' '}
                {p.clock} · {quarter(p.period)}
              </span>
              <p>{p.text}</p>
            </div>
            <span className="gd-running">
              <span>{p.away}</span>
              <span className="muted tiny">{g.away.abbr}</span>
              <span>{p.home}</span>
              <span className="muted tiny">{g.home.abbr}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Odds({ g }) {
  const o = g.odds
  if (!o) return null
  return (
    <section className="tc-section">
      <h4>
        Game odds <span className="muted tiny">{o.provider && `· ${o.provider}`}</span>
      </h4>
      <table className="standings">
        <thead>
          <tr>
            <th className="left">Team</th>
            <th>Spread</th>
            <th>Total</th>
            <th>ML</th>
          </tr>
        </thead>
        <tbody>
          {[
            [g.away, o.away, o.total != null && `o${o.total}`],
            [g.home, o.home, o.total != null && `u${o.total}`],
          ].map(([t, x, total]) => (
            <tr key={t.id}>
              <td className="left">
                <span className="team-inline">
                  <TeamLogo src={t.logo} size={20} />
                  {t.name}
                </span>
              </td>
              <td>{x.spread || '—'}</td>
              <td>{total || '—'}</td>
              <td>{x.moneyLine || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted tiny">Odds and lines subject to change.</p>
    </section>
  )
}

function Venue({ g }) {
  const bits = [g.venue, g.city, g.weather, g.broadcast, g.attendance && `${Number(g.attendance).toLocaleString()} attendance`].filter(Boolean)
  return bits.length ? <p className="muted tiny gd-venue">{bits.join(' · ')}</p> : null
}

function BoxScore({ g, onPlayer }) {
  const [side, setSide] = useState('away')
  const cats = g.players[side] ?? []
  if (!Object.keys(g.players).length) return <p className="muted">The box score isn't posted yet.</p>
  return (
    <>
      <div className="seg small gd-sides">
        {['away', 'home'].map((s) => (
          <button key={s} className={s === side ? 'on' : ''} onClick={() => setSide(s)}>
            {g[s].name}
          </button>
        ))}
      </div>
      {cats.map((c) => (
        <section key={c.name} className="tc-section">
          <h4>{c.title}</h4>
          <div className="table-scroll">
            <table className="standings">
              <thead>
                <tr>
                  <th className="left" />
                  {c.labels.map((l) => (
                    <th key={l}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.id ?? r.name}>
                    <td className="left">
                      <button className="team-link" onClick={() => onPlayer({ id: r.id, name: r.name, jersey: r.jersey })}>
                        {r.name}
                      </button>
                    </td>
                    {r.stats.map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
                {c.totals.length > 0 && (
                  <tr className="gd-total">
                    <td className="left">Total</td>
                    {c.totals.map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  )
}

function TeamStats({ g }) {
  if (!g.stats.length) return <p className="muted">Team stats aren't posted yet.</p>
  return (
    <section className="tc-section">
      <div className="gd-leaders-head">
        <span>
          <TeamLogo src={g.away.logo} size={20} /> {g.away.abbr}
        </span>
        <span>
          {g.home.abbr} <TeamLogo src={g.home.logo} size={20} />
        </span>
      </div>
      <dl className="tc-statlist gd-stats">
        {g.stats.map((s) => (
          <div key={s.label}>
            <dd>{s.away}</dd>
            <dt>{s.label}</dt>
            <dd>{s.home}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Plays({ g }) {
  if (!g.drives.length) return <p className="muted">No plays yet.</p>
  return (
    <div className="gd-drives">
      {g.drives.map((d, i) => (
        <details key={d.id} className="draft-year" open={i === 0}>
          <summary>
            <TeamLogo src={d.team?.logo} size={18} /> {[d.team?.abbr, d.result || (d.live ? 'In progress' : '')].filter(Boolean).join(' · ')}
            <span className="muted"> · {d.description}</span>
          </summary>
          <ul className="gd-plays">
            {[...d.plays].reverse().map((p) => (
              <li key={p.id} className={p.scoring ? 'scoring' : ''}>
                <span className="muted tiny">
                  {quarter(p.period)} {p.clock}
                  {p.down && ` · ${p.down}`}
                </span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}

function Body({ open }) {
  const { data, error, loading, refresh } = useData(({ fresh }) => fetchGame(open.id, { fresh }), [open.id], {
    pollMs: 15_000,
    shouldPoll: (d) => d.state === 'in',
  })
  const [tab, setTab] = useState('game')
  const [player, setPlayer] = useState(null)

  if (player) return <PlayerView player={player} onBack={() => setPlayer(null)} />
  if (loading)
    return (
      <>
        <h2 className="ed-title">
          {open.away?.name} @ {open.home?.name}
        </h2>
        <Loading label="Loading game…" />
      </>
    )
  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />

  const g = data
  return (
    <>
      <Scorebug g={g} />
      <div className="seg small gd-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'game' && (
        <>
          <Leaders g={g} onPlayer={setPlayer} />
          <Scoring g={g} />
          <Odds g={g} />
          <Venue g={g} />
        </>
      )}
      {tab === 'box' && <BoxScore g={g} onPlayer={setPlayer} />}
      {tab === 'stats' && <TeamStats g={g} />}
      {tab === 'plays' && <Plays g={g} />}

      {g.link && (
        <p className="tc-foot">
          <a href={g.link} target="_blank" rel="noreferrer" className="more">
            Full Gamecast on ESPN ↗
          </a>
        </p>
      )}
    </>
  )
}

export default function GameDetail() {
  const open = useOpenGame()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && closeGame()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null
  return (
    <div className="tc-overlay" onClick={closeGame}>
      <aside className="tc-panel gd-panel" role="dialog" aria-modal="true" aria-label="Game details" onClick={(e) => e.stopPropagation()}>
        <button className="tc-close" onClick={closeGame} aria-label="Close">
          ×
        </button>
        <Body key={open.id} open={open} />
      </aside>
    </div>
  )
}
