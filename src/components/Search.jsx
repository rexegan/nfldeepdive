export function SearchBox({ value, onChange }) {
  return (
    <input
      className="search"
      type="search"
      placeholder="Find a team"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export const matchesTeam = (team, query) => {
  const q = query.trim().toLowerCase()
  return !q || `${team.name} ${team.fullName} ${team.abbr ?? ''}`.toLowerCase().includes(q)
}
