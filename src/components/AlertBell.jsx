import { useState } from 'react'
import { MARGINS, dismissToast, notificationsSupported, setAlertsEnabled, setMargin, useAlerts } from '../alerts.js'

export default function AlertBell() {
  const { enabled, margin } = useAlerts()
  const [open, setOpen] = useState(false)
  const blocked = notificationsSupported() && Notification.permission === 'denied'

  return (
    <div className="alert-bell">
      <button
        className={`btn small-btn${enabled ? ' on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Close-game alerts"
      >
        🔔 {enabled ? 'Alerts on' : 'Alerts'}
      </button>
      {open && (
        <div className="alert-pop" role="dialog" aria-label="Close-game alerts">
          <label className="alert-row">
            <input type="checkbox" checked={enabled} onChange={(e) => setAlertsEnabled(e.target.checked)} />
            Alert me to close games in the 4th quarter or overtime
          </label>
          <select aria-label="Margin" value={margin} onChange={(e) => setMargin(e.target.value)}>
            {MARGINS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="muted tiny">
            Alerts fire while this page is open (a background tab is fine).
            {!notificationsSupported() && ' This browser has no desktop notifications, so alerts show here on the page.'}
            {blocked && ' Desktop notifications are blocked for this site, so alerts show here on the page.'}
          </p>
        </div>
      )}
    </div>
  )
}

export function AlertToasts() {
  const { toasts } = useAlerts()
  if (!toasts.length) return null
  return (
    <div className="alert-toasts" role="status">
      {toasts.map((t) => (
        <div key={t.id} className="alert-toast">
          <div>
            <strong>🚨 {t.title}</strong>
            <span className="muted">{t.body}</span>
          </div>
          {t.link && (
            <a href={t.link} target="_blank" rel="noreferrer" className="more">
              Gamecast ↗
            </a>
          )}
          <button className="tc-close-sm" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
