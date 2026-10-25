import { fetchHeadCoach } from '../api.js'
import { useData } from '../hooks.js'
import { ErrorBox, Loading } from './Status.jsx'

const staffSearch = (team) => `https://duckduckgo.com/?q=${encodeURIComponent(`\\${team.name} coaching staff`)}`

export default function Coaches({ team }) {
  const { data: coach, error, loading, refresh } = useData(
    () => fetchHeadCoach(team.id, team.seasonYear),
    [team.id],
  )
  if (loading) return <Loading label="Loading coaching staff…" />

  return (
    <div className="coaches">
      {error && <ErrorBox error={error} onRetry={refresh} />}
      {!error && !coach && <p className="muted">ESPN hasn't listed a head coach for this team.</p>}
      {coach && (
        <section className="tc-section coach-card">
          <div className="coach-head">
            <span className="headshot coach-photo">
              <span>{coach.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
              {coach.wiki?.thumb && <img src={coach.wiki.thumb} alt={coach.name} />}
            </span>
            <div>
              <span className="label">Head Coach</span>
              <h3 className="coach-name">{coach.name}</h3>
              {coach.wiki?.description && <p className="muted">{coach.wiki.description}</p>}
            </div>
          </div>
          <div className="tc-stats">
            {coach.season && (
              <div className="tc-big">
                <span className="label">This season</span>
                <strong>{coach.season}</strong>
              </div>
            )}
            {coach.career && (
              <div className="tc-big">
                <span className="label">Career record</span>
                <strong>{coach.career}</strong>
              </div>
            )}
            {coach.seasons > 0 && (
              <div className="tc-big">
                <span className="label">Seasons as HC</span>
                <strong>{coach.seasons}</strong>
              </div>
            )}
          </div>
          {coach.wiki?.extract && <p className="coach-bio">{coach.wiki.extract}</p>}
          {coach.wiki?.link && (
            <a href={coach.wiki.link} target="_blank" rel="noreferrer" className="more">
              Full bio on Wikipedia ↗
            </a>
          )}
        </section>
      )}

      <section className="tc-section">
        <h4>Assistant coaches</h4>
        <p className="muted">
          ESPN only publishes the head coach. The full staff, with photos, is on the team's website.
        </p>
        <a href={staffSearch(team)} target="_blank" rel="noreferrer" className="tc-action inline">
          Full coaching staff ↗
        </a>
      </section>
    </div>
  )
}
