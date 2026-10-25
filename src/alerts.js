import { useEffect, useState } from 'react'
import { fetchScoreboard } from './api.js'

// Close-game alerts: while on, the scoreboard is polled every 30 seconds and any
// game in the 4th quarter or overtime within the chosen margin raises one alert.
// Settings live in this browser; alerts only fire while the page is open.

const KEY = 'nfldd:alerts'
const POLL_MS = 30_000

export const MARGINS = [
  { value: 3, label: 'Within a field goal (3)' },
  { value: 8, label: 'Within one score (8)' },
  { value: 10, label: 'Within 10 points' },
]

function read() {
  try {
    return { enabled: false, margin: 8, ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return { enabled: false, margin: 8 }
  }
}

let settings = read()
let toasts = []
const seen = new Set()
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // storage blocked; settings last for this visit only
  }
}

export const notificationsSupported = () => typeof Notification !== 'undefined'

export async function setAlertsEnabled(enabled) {
  if (enabled && notificationsSupported() && Notification.permission === 'default') {
    await Notification.requestPermission().catch(() => {})
  }
  settings = { ...settings, enabled }
  persist()
  seen.clear()
  emit()
  if (enabled) check()
}

export function setMargin(margin) {
  settings = { ...settings, margin: Number(margin) }
  persist()
  seen.clear()
  emit()
  if (settings.enabled) check()
}

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

const num = (v) => Number(v) || 0

/** 4th quarter or overtime, and the margin is within the limit. */
export const isCloseLate = (g, margin) =>
  g.state === 'in' && g.period >= 4 && g.home && g.away && Math.abs(num(g.home.score) - num(g.away.score)) <= margin

function raise(g) {
  const lead = num(g.home.score) - num(g.away.score)
  const title = `Close game: ${g.away.name} @ ${g.home.name}`
  const body = `${g.away.name} ${g.away.score}, ${g.home.name} ${g.home.score} · ${g.detail}${lead === 0 ? ' · tied' : ''}`
  toasts = [{ id: g.id, title, body, link: g.link }, ...toasts.filter((t) => t.id !== g.id)]
  if (notificationsSupported() && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: `nfl-close-${g.id}` })
    } catch {
      // some browsers only allow notifications from a service worker; the in-app toast still shows
    }
  }
}

async function check() {
  if (!settings.enabled) return
  try {
    const board = await fetchScoreboard({}, { fresh: true })
    for (const g of board.events) {
      if (!isCloseLate(g, settings.margin)) {
        // allow another alert if the game tightens up again later
        if (g.state !== 'in') seen.delete(g.id)
        continue
      }
      if (seen.has(g.id)) continue
      seen.add(g.id)
      raise(g)
    }
    emit()
  } catch {
    // network hiccup; try again next tick
  }
}

setInterval(check, POLL_MS)
check()

export function useAlerts() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])
  return { ...settings, toasts }
}
