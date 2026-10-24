# NFL Deep Dive

One place to follow the NFL: live scores, weekly schedules, playoff-seed and division standings, and team cards.

- **Home** shows your followed teams first, then live games and the current week's slate (with bye teams).
- **Scores** by week (preseason, regular season, playoffs), filterable by My Teams, Live, or team name. Live games auto-refresh every 30 seconds. Upcoming games show the spread and over/under.
- **Standings** by division or by conference with playoff seeds, plus PF/PA/differential and streaks.
- **Follow teams** with the ☆ next to any team. Favorites are saved in your browser.

Data comes from ESPN's public site API, called directly from the browser (no backend, no API key).

## Development

```sh
npm install
npm run dev
```

Pushing to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
