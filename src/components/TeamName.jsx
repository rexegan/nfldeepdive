import { openTeam } from '../team.js'

// A team name that opens the team card when clicked.
export default function TeamName({ team, children, className = '' }) {
  if (!team?.id) return <span className={className}>{children ?? team?.name}</span>
  return (
    <button
      type="button"
      className={`team-link ${className}`}
      onClick={(e) => {
        e.stopPropagation()
        openTeam(team)
      }}
    >
      {children ?? team.name}
    </button>
  )
}
