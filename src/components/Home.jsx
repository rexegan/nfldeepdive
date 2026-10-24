import { fetchScoreboard } from '../api.js'
import { buildHash, useData, useFavorites } from '../hooks.js'
import GameCard from './GameCard.jsx'
import TeamLogo from './TeamLogo.jsx'
import TeamName from './TeamName.jsx'
import { EditTeamsButton } from './MyTeamsEditor.jsx'
import { Loading, ErrorBox, Updated } from './Status.jsx'

const ORDER = { in: 0, pre: 1, post: 2 }
const byInterest = (a, b) => ORDER[a.state] - ORDER[b.state] || new Date(a.date) - new Date(b.date)

const anyLive = (d) => d.events.some((e) => e.state === 'in')

export default function Home() {
  const { data, error, loading, updated, polling, refresh } = useData(
    ({ fresh }) => fetchScoreboard({}, { fresh }),
    [],
    { shouldPoll: anyLive },
  )
  const { isFav, list: favs } = useFavorites()

  if (loading) return <Loading label="Checking the scoreboard…" />
  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />

  const all = [...data.events].sort(byInterest)
  const live = all.filter((g) => g.state === 'in')
  const mine = all.filter((g) => [g.home, g.away].some((t) => t && isFav(t.id)))
  const mineBye = data.byes.filter((t) => isFav(t.id))
  const week = data.calendar.find(
    (w) => String(w.week) === String(data.week) && String(w.seasonType) === String(data.seasonType),
  )

  return (
    <div className="home">
      <Updated updated={updated} polling={polling} onRefresh={refresh} />

      <section className="home-block">
        <div className="heading-row">
          <h2>My Teams</h2>
          <EditTeamsButton />
        </div>
        {favs.length === 0 ? (
          <p className="muted">
            Tap Edit to add teams, or tap ☆ next to any team on a scoreboard or in the standings. Their games show up
            here first.
          </p>
        ) : (
          <>
            <div className="fav-chips">
              {favs.map((f) => (
                <span key={f.id} className="chip">
                  <TeamLogo src={f.logo} size={18} /> <TeamName team={f} />
                </span>
              ))}
            </div>
            {mine.length ? (
              <div className="grid">
                {mine.map((g) => (
                  <GameCard key={g.id} game={g} />
                ))}
              </div>
            ) : (
              <p className="muted">
                {mineBye.length ? `${mineBye.map((t) => t.name).join(', ')} on bye this week.` : 'None of your teams play this week.'}
              </p>
            )}
          </>
        )}
      </section>

      {live.length > 0 && (
        <section className="home-block">
          <h2>
            <span className="live-dot" /> Live now <span className="count">{live.length}</span>
          </h2>
          <div className="grid">
            {live.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}

      <section className="home-block">
        <div className="block-head">
          <h2>🏈 {week?.label ?? 'This week'}</h2>
          <a href={buildHash('scores')} className="more">
            {all.length ? `All ${all.length} games ›` : 'Scores ›'}
          </a>
        </div>
        {!all.length && (
          <p className="muted">
            No games this week.
            {data.seasonStart && new Date(data.seasonStart) > new Date()
              ? ` Season starts ${new Date(data.seasonStart).toLocaleDateString([], { month: 'long', day: 'numeric' })}.`
              : ''}{' '}
            <a href={buildHash('standings')}>Standings</a>
          </p>
        )}
        <div className="grid">
          {all.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
        {data.byes.length > 0 && <p className="muted sub">Bye: {data.byes.map((t) => t.fullName).join(', ')}</p>}
      </section>
    </div>
  )
}
