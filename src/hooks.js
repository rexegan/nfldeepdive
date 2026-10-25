import { useCallback, useEffect, useRef, useState } from 'react'

// ---------- routing: #/<view>?k=v ----------

function parseHash() {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  return { view: path.split('/')[0], params: Object.fromEntries(new URLSearchParams(query)) }
}

export function buildHash(view, params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  const q = new URLSearchParams(clean).toString()
  return `#/${view ?? ''}${q ? `?${q}` : ''}`
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash)
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

// ---------- data loading with optional live polling ----------

export function useData(load, deps, { pollMs = 30_000, shouldPoll } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true, updated: null })
  const loadRef = useRef(load)
  loadRef.current = load

  const run = useCallback(async (fresh) => {
    try {
      const data = await loadRef.current({ fresh })
      setState({ data, error: null, loading: false, updated: new Date() })
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }))
    }
  }, [])

  useEffect(() => {
    setState({ data: null, error: null, loading: true, updated: null })
    run(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const polling = !!(state.data && shouldPoll?.(state.data))
  useEffect(() => {
    if (!polling) return
    const id = setInterval(() => {
      if (!document.hidden) run(true)
    }, pollMs)
    return () => clearInterval(id)
  }, [polling, pollMs, run])

  const retry = () => {
    setState((s) => ({ ...s, error: null, loading: !s.data }))
    run(true)
  }

  return { ...state, polling, refresh: retry }
}

// ---------- favorite teams, kept in this browser ----------

const FAV_KEY = 'nfldd:favorites'

function readFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) ?? {}
  } catch {
    return {}
  }
}

const listeners = new Set()
let favs = readFavs()

export function useFavorites() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])

  const save = (next) => {
    favs = next
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next))
    } catch {
      // storage blocked; favorites last for this visit only
    }
    listeners.forEach((fn) => fn())
  }

  const toggle = useCallback((team) => {
    const key = String(team.id)
    const next = { ...favs }
    if (next[key]) delete next[key]
    else next[key] = { id: team.id, name: team.name, logo: team.logo }
    save(next)
  }, [])

  // Conferences and divisions share the store under a 'div:' prefix.
  const toggleDiv = useCallback((label) => {
    const key = `div:${label}`
    const next = { ...favs }
    if (next[key]) delete next[key]
    else next[key] = { kind: 'div', id: label, label }
    save(next)
  }, [])

  const isFav = useCallback((id) => !!favs[String(id)], [])
  const isDivFav = useCallback((label) => !!favs[`div:${label}`], [])
  const all = Object.values(favs)
  return {
    favorites: favs,
    list: all.filter((f) => f.kind !== 'div'),
    divisions: all.filter((f) => f.kind === 'div'),
    isFav,
    toggle,
    isDivFav,
    toggleDiv,
  }
}
