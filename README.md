# DeepSeek Peak Tracker
1. Create a GitHub repo (public, for free GitHub Pages) and push these files.
2. Settings > Pages > Deploy from branch > main / root.
3. Actions tab > "Update DeepSeek schedule" > Run workflow (fills the KES rate; it then runs twice a day).
4. Open https://<you>.github.io/<repo>/ in Edge or Chrome and install it as an app.
Local test: `node scripts/update.mjs` (Node 20+).
