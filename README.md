# NFL Deep Dive

One place to follow the NFL: live scores, weekly schedules, playoff-seed and division standings, and team cards.

- **Home** shows your followed teams first, then live games and the current week's slate (with bye teams).
- **Scores** by week (preseason, regular season, playoffs), filterable by My Teams, Live, or team name. Live games auto-refresh every 30 seconds. Upcoming games show the spread and over/under.
- **Standings** by division or by conference with playoff seeds, plus PF/PA/differential and streaks.
- **Yesterday's Upsets** on Scores: finished games where the betting underdog won (falls back to the latest game day this week).
- **Team cards** with Roster (player profiles and stats), Fun Facts (franchise history, Super Bowl titles, major award winners, draft picks), Coaching Staff, and links to the team page and website.
- **Follow divisions and conferences** (AFC, NFC, or any of the eight divisions) and filter Scores and Standings by them.
- **Close-game alerts** (🔔 in the header): get notified when any game is within a field goal, one score, or 10 points in the 4th quarter or overtime. Works while the page is open.
- **Game details**: tap any game card for the score, game leaders, scoring summary, odds, full box score for both teams, team stats and play-by-play (live games refresh every 15 seconds). Tap a player or team name for their page.
- **Follow teams** with the ☆ next to any team. Favorites are saved in your browser.

Data comes from ESPN's public site API, called directly from the browser (no backend, no API key).

## Development

```sh
npm install
npm run dev
```

`scripts/build-data.mjs` builds the award and draft data (`public/data/nfl.json`) from ESPN; CI runs it before the Vite build, and locally run `node scripts/build-data.mjs` once to see Fun Facts data.

Pushing to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
