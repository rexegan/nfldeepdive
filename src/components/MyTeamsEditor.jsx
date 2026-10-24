import { useEffect, useState } from 'react'
import { fetchTeams } from '../api.js'
import { useData, useFavorites } from '../hooks.js'
import { setEditorOpen, useEditorOpen } from '../team.js'
import { SearchBox, matchesTeam } from './Search.jsx'
import TeamLogo from './TeamLogo.jsx'
import { ErrorBox, Loading } from './Status.jsx'

function AddTeams() {
  const { data, error, loading, refresh } = useData(() => fetchTeams(), [])
  const [query, setQuery] = useState('')
  const { isFav, toggle } = useFavorites()

  if (loading) return <Loading label="Loading teams…" />
  if (error) return <ErrorBox error={error} onRetry={refresh} />
  const results = query.trim() ? data.filter((t) => matchesTeam(t, query)).slice(0, 40) : []

  return (
    <>
      <SearchBox value={query} onChange={setQuery} />
      {query.trim() && !results.length && <p className="muted">No teams match.</p>}
      {!query.trim() && <p className="muted tiny">Type a team or city to find it.</p>}
      <ul className="ed-list">
        {results.map((t) => {
          const fav = isFav(t.id)
          return (
            <li key={t.id}>
              <TeamLogo src={t.logo} size={22} />
              <span className="ed-name">{t.fullName}</span>
              <button className={`btn ${fav ? '' : 'primary'}`} onClick={() => toggle(t)}>
                {fav ? 'Following' : '+ Add'}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default function MyTeamsEditor() {
  const open = useEditorOpen()
  const { list, toggle } = useFavorites()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setEditorOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  const close = () => setEditorOpen(false)

  return (
    <div className="tc-overlay" onClick={close}>
      <aside className="tc-panel" role="dialog" aria-modal="true" aria-label="Edit My Teams" onClick={(e) => e.stopPropagation()}>
        <button className="tc-close" onClick={close} aria-label="Close">
          ×
        </button>
        <h2 className="ed-title">Edit My Teams</h2>

        <section className="tc-section">
          <h4>Following ({list.length})</h4>
          {list.length === 0 ? (
            <p className="muted">You aren't following any teams yet. Add some below.</p>
          ) : (
            <ul className="ed-list">
              {list.map((f) => (
                <li key={f.id}>
                  <TeamLogo src={f.logo} size={22} />
                  <span className="ed-name">
                    {f.name}
                  </span>
                  <button className="btn danger" onClick={() => toggle(f)} aria-label={`Remove ${f.name}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tc-section">
          <h4>Add a team</h4>
          <AddTeams />
        </section>

        <button className="btn ed-done" onClick={close}>
          Done
        </button>
      </aside>
    </div>
  )
}

export function EditTeamsButton() {
  return (
    <button className="btn small-btn" onClick={() => setEditorOpen(true)}>
      Edit
    </button>
  )
}
