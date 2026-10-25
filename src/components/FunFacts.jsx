import { factsFor, fetchWiki, superBowlsFor } from '../api.js'
import { useData } from '../hooks.js'
import { Loading } from './Status.jsx'

async function load(team) {
  const [wiki, facts] = await Promise.all([fetchWiki(team.name), factsFor(team.id)])
  return { wiki, ...facts }
}

const AWARD_ORDER = ['MVP', 'Super Bowl MVP', 'Offensive Player of the Year', 'Defensive Player of the Year', 'Coach of the Year']

function DraftHistory({ picks }) {
  if (!picks.length) return <p className="muted">No draft picks found for this team since 2000.</p>
  const years = [...new Set(picks.map((p) => p.year))].sort((a, b) => b - a)
  const firstRound = picks.filter((p) => p.round === 1).length
  const topPicks = picks.filter((p) => p.overall === 1)
  return (
    <>
      <div className="tc-stats">
        <div className="tc-big">
          <span className="label">Picks since {Math.min(...years)}</span>
          <strong>{picks.length}</strong>
        </div>
        <div className="tc-big">
          <span className="label">1st-round picks</span>
          <strong>{firstRound}</strong>
        </div>
        {topPicks.length > 0 && (
          <div className="tc-big">
            <span className="label">#1 overall</span>
            <strong>{topPicks.length}</strong>
          </div>
        )}
      </div>
      {years.map((y, i) => {
        const list = picks.filter((p) => p.year === y).sort((a, b) => a.overall - b.overall)
        return (
          <details key={y} className="draft-year" open={i < 2}>
            <summary>
              {y} NFL Draft <span className="muted">· {list.length} picked</span>
            </summary>
            <ul className="draft-list">
              {list.map((p) => (
                <li key={`${p.overall}-${p.name}`}>
                  <span className="muted pick">
                    Rd {p.round} · #{p.overall}
                  </span>
                  <strong>{p.name}</strong>
                  <span className="muted">{p.pos}</span>
                  <span className="nfl">{p.college}</span>
                </li>
              ))}
            </ul>
          </details>
        )
      })}
    </>
  )
}

export default function FunFacts({ team }) {
  const { data, loading } = useData(() => load(team), [team.id])
  if (loading) return <Loading label="Digging up fun facts…" />

  const titles = superBowlsFor(team.abbr)
  const awards = [...data.awards].sort(
    (a, b) => AWARD_ORDER.indexOf(a.award) - AWARD_ORDER.indexOf(b.award) || b.year - a.year,
  )

  return (
    <div className="fun-facts">
      {data.wiki && (
        <section className="tc-section program">
          {data.wiki.thumb && <img src={data.wiki.thumb} alt="" className="program-img" />}
          <div>
            <h4>{data.wiki.title}</h4>
            <p>{data.wiki.extract}</p>
            {data.wiki.link && (
              <a href={data.wiki.link} target="_blank" rel="noreferrer" className="more">
                Read more on Wikipedia ↗
              </a>
            )}
          </div>
        </section>
      )}

      <section className="tc-section">
        <h4>🏆 Super Bowl titles ({titles.length})</h4>
        {titles.length ? (
          <ul className="facts-list">
            {[...titles].reverse().map((t) => (
              <li key={t.numeral}>
                <span className="muted year">{t.year}</span> <strong>Super Bowl {t.numeral}</strong>{' '}
                <span className="muted">{t.season} season</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No Super Bowl titles yet.</p>
        )}
      </section>

      <section className="tc-section">
        <h4>Major award winners (since 2000)</h4>
        {awards.length ? (
          <ul className="facts-list">
            {awards.map((a) => (
              <li key={a.year + a.award + a.name}>
                <span className="muted year">{a.year}</span> <strong>{a.name}</strong>{' '}
                <span className="muted">{a.award}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No MVP, Player of the Year, Coach of the Year or Super Bowl MVP winners since 2000.</p>
        )}
      </section>

      <section className="tc-section">
        <h4>🏈 Draft picks</h4>
        <DraftHistory picks={data.picks} />
      </section>
    </div>
  )
}
