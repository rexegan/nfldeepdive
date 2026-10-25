import { fetchAthlete, fetchRoster } from '../api.js'
import { useData } from '../hooks.js'
import { ErrorBox, Loading } from './Status.jsx'

function Headshot({ src, name, size = 48 }) {
  const initials = (name ?? '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
  return (
    <span className="headshot" style={{ width: size, height: size, fontSize: size / 2.8 }}>
      <span>{initials}</span>
      {src && <img src={src} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />}
    </span>
  )
}

export default function Roster({ teamId, onPlayer }) {
  const { data, error, loading, refresh } = useData(() => fetchRoster(teamId), [teamId])
  if (loading) return <Loading label="Loading roster…" />
  if (error)
    return error.message?.includes('400') || error.message?.includes('404') ? (
      <div className="state">ESPN doesn't publish a roster for this team.</div>
    ) : (
      <ErrorBox error={error} onRetry={refresh} />
    )
  if (!data.groups.length) return <div className="state">No roster posted yet.</div>

  return (
    <div className="roster">
      {data.coach && (
        <p className="muted roster-coach">
          <span className="label">Head coach</span> {data.coach}
        </p>
      )}
      {data.groups.map((g) => (
        <section key={g.label} className="tc-section">
          {data.groups.length > 1 && <h4>{g.label}</h4>}
          <ul className="player-grid">
            {g.players.map((p) => (
              <li key={p.id}>
                <button className="player" onClick={() => onPlayer(p)}>
                  <Headshot src={p.headshot} name={p.name} />
                  <span className="player-text">
                    <strong>{p.name}</strong>
                    <span className="muted">
                      {[p.jersey && `#${p.jersey}`, p.position, p.college].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function PlayerView({ player, onBack }) {
  const { data, error, loading, refresh } = useData(() => fetchAthlete(player.id), [player.id])
  const p = data ?? player
  const facts = [
    ['Position', p.position && data ? p.position : player.positionName || player.position],
    ['Experience', p.year],
    ['Age', p.age],
    ['Height', p.height],
    ['Weight', p.weight],
    ['College', p.college],
    ['Draft', data?.draft],
    ['Hometown', p.hometown],
    ['Status', data?.status],
  ].filter(([, v]) => v)

  return (
    <div className="player-view">
      <button className="link-btn back" onClick={onBack}>
        ‹ Back to roster
      </button>
      <div className="tc-head">
        <Headshot src={p.headshot} name={p.name} size={96} />
        <div className="tc-title">
          <h2>{p.name}</h2>
          <p className="muted">
            {[data?.jersey || (player.jersey && `#${player.jersey}`), data?.team].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <dl className="tc-statlist facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {loading && <Loading label="Loading player…" />}
      {error && <ErrorBox error={error} onRetry={refresh} />}

      {data?.summary && (
        <section className="tc-section">
          <h4>{data.summary.title}</h4>
          <div className="tc-stats">
            {data.summary.stats.map((s) => (
              <div key={s.full} className="tc-big" title={s.full}>
                <span className="label">{s.name}</span>
                <strong>{s.value}</strong>
                {s.rank && <span className="muted nat-rank">{s.rank} in the NFL</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {data?.table && (
        <section className="tc-section">
          <h4>Stats by season</h4>
          <div className="table-scroll">
            <table className="standings">
              <thead>
                <tr>
                  <th className="left" />
                  {data.table.labels.map((l, i) => (
                    <th key={l + i} title={data.table.names[i]}>
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.table.rows.map((r) => (
                  <tr key={r.label}>
                    <td className="left">{r.label}</td>
                    {r.values.map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && !data.summary && !data.table && (
        <p className="muted">ESPN hasn't posted stats for this player yet.</p>
      )}

      {data?.news.length > 0 && (
        <section className="tc-section">
          <h4>Latest news</h4>
          <ul className="news">
            {data.news.map((n) => (
              <li key={n.headline}>
                {n.link ? (
                  <a href={n.link} target="_blank" rel="noreferrer">
                    {n.headline}
                  </a>
                ) : (
                  n.headline
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data?.link && (
        <p className="tc-foot">
          <a href={data.link} target="_blank" rel="noreferrer" className="more">
            Full player page on ESPN ↗
          </a>
        </p>
      )}
    </div>
  )
}
