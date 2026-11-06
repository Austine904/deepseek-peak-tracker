# DeepSeek Peak Tracker

A small installable web app (PWA) that shows whether the DeepSeek API is currently on **peak** or **off-peak** pricing, how long until it switches, and the current prices in **KES**. It has a minimized view (state and countdown only), an expanded view (prices, 7-day grid, usage log), light and dark themes, and a floating always-on-top card.

Live: https://austine904.github.io/deepseek-peak-tracker/

> **Unofficial.** This project is not affiliated with or endorsed by DeepSeek. The schedule and prices are read automatically from DeepSeek's public pricing page, and KES amounts use a free exchange-rate service. They can be wrong or out of date, so check DeepSeek's own pricing page before relying on them for billing decisions.

## How it works

- `index.html` is the whole app. It reads `data/schedule.json` and works out peak or off-peak in the browser. No server and no build step.
- `scripts/update.mjs` (Node 20+, no dependencies) fetches DeepSeek's pricing page, the USD to KES rate and Chinese public holidays, then writes `data/schedule.json`.
- `.github/workflows/update.yml` runs that script twice a day and commits the result. If parsing fails, the job fails and the last good data stays in place. The app shows "Data N days old" when the data is more than 3 days stale.
- `sw.js` and `manifest.webmanifest` make it installable and usable offline.

## Run your own copy

1. Fork this repo (or use it as a template).
2. Settings > Pages > Deploy from a branch > `main` / root.
3. Actions tab > "Update DeepSeek schedule" > Run workflow (enable workflows first if GitHub asks).
4. Open `https://<your-username>.github.io/<repo-name>/`, then in Edge or Chrome choose Install app.

Local test of the updater: `node scripts/update.mjs`. To test the parser offline, use `PRICING_FILE=fixtures/pricing.md node scripts/update.mjs`.

## Contributing

Pull requests are welcome. Please keep it dependency-free where possible. Changes to `scripts/update.mjs` or the workflow file get extra scrutiny, because the scheduled job has permission to push to the repo.

## Licence

MIT. See `LICENSE`.
