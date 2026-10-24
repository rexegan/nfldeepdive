import { buildHash, useRoute } from './hooks.js'
import Home from './components/Home.jsx'
import Scoreboard from './components/Scoreboard.jsx'
import Standings from './components/Standings.jsx'
import TeamCard from './components/TeamCard.jsx'
import MyTeamsEditor from './components/MyTeamsEditor.jsx'

const VIEWS = [
  { id: '', label: 'Home' },
  { id: 'scores', label: 'Scores' },
  { id: 'standings', label: 'Standings' },
]

export default function App() {
  const route = useRoute()
  const view = VIEWS.some((v) => v.id === route.view) ? route.view : ''

  return (
    <div className="app">
      <header className="top">
        <a href="#/" className="brand">
          <span className="brand-mark">NFL</span>
          <span className="brand-name">Deep Dive</span>
        </a>
        <nav className="sports" aria-label="Views">
          {VIEWS.map((v) => (
            <a key={v.id} href={buildHash(v.id)} className={v.id === view ? 'on' : ''}>
              {v.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        {view === '' && <Home />}
        {view === 'scores' && <Scoreboard params={route.params} />}
        {view === 'standings' && <Standings params={route.params} />}
      </main>

      <TeamCard />
      <MyTeamsEditor />

      <footer className="foot">
        Data from ESPN's public scoreboard feeds. Followed teams are saved in this browser.
      </footer>
    </div>
  )
}
