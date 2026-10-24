import { useEffect, useState } from 'react'

// Which team card is open, shared app-wide so any team name can open it.
let current = null
const listeners = new Set()

export function openTeam(team) {
  if (!team?.id) return
  current = { id: String(team.id), name: team.name ?? team.fullName, logo: team.logo }
  listeners.forEach((fn) => fn(current))
}

export function closeTeam() {
  current = null
  listeners.forEach((fn) => fn(current))
}

export function useOpenTeam() {
  const [team, setTeam] = useState(current)
  useEffect(() => {
    listeners.add(setTeam)
    return () => listeners.delete(setTeam)
  }, [])
  return team
}

// The My Teams editor panel, opened from Home or the scoreboard.
let editorOpen = false
const editorListeners = new Set()

export function setEditorOpen(open) {
  editorOpen = open
  editorListeners.forEach((fn) => fn(open))
}

export function useEditorOpen() {
  const [open, setOpen] = useState(editorOpen)
  useEffect(() => {
    editorListeners.add(setOpen)
    return () => editorListeners.delete(setOpen)
  }, [])
  return open
}
