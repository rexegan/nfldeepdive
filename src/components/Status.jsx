export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state">
      <span className="spinner" /> {label}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="state error">
      <p>Couldn't reach ESPN's data feed ({error?.message ?? 'network error'}).</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Updated({ updated, polling, onRefresh }) {
  if (!updated) return null
  return (
    <div className="updated">
      {polling && <span className="live-dot" />}
      {polling ? 'Live · auto-updating' : 'Updated'}{' '}
      {updated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      <button className="link-btn" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  )
}
