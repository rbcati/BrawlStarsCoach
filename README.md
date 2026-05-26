# Brawl Stars Coach

Production-ready starter for a Brawl Stars coaching dashboard built with React, Vite, TypeScript, Supabase, and Netlify Functions.

The app keeps the official Brawl Stars API token on the server, persists every sync to Supabase before the battle log expires, and returns deterministic coaching analysis for brawler win rate and first-pass upgrade priorities. It can run with Netlify Functions or the included Express API for an Oracle VPS.

## Features

- Player tag input and `Fetch Latest Battles` sync workflow.
- Defaults to `GQ0GRPCVQ` when the tag input is empty.
- Oracle VPS Express API integration for player lookup, battlelog, sync, and analysis.
- Battle persistence with deduplication by player tag, battle time, mode, map, and normalized teams.
- Dashboard sections for player overview, recent battles, brawler performance, mode/map performance, upgrade recommendations, and manual match notes.
- Manual battle tags: `bad draft`, `carried`, `countered`, `felt controlled`, `tilted`, `teammates weak`.
- Auto-sync toggle that calls the VPS `/api/sync/:tag` route every 5 minutes while the app is open.
- Error handling for invalid tags, API denial, rate limits, and missing environment variables.
- Express backend for VPS deployment with `/health`, `/api/player/:tag`, `/api/battlelog/:tag`, `/api/sync/:tag`, and `/api/analyze/:tag`.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.

   The schema creates:
   - `players`
   - `battles`
   - `battle_participants`
   - `manual_match_notes`
   - `brawler_snapshots`
   - `recommendations`

3. Create `.env` from `.env.example`:

   ```bash
   BRAWL_STARS_API_TOKEN=your_official_brawl_stars_api_token
   PORT=3001
   CORS_ORIGIN=https://your-netlify-site.netlify.app
   SUPABASE_URL=https://your-project.supabase.co
   VITE_API_BASE_URL=http://161.153.75.96:3001
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. Run locally with Netlify Functions:

   ```bash
   npm run netlify:dev
   ```

   Vite alone will render the frontend, but syncing requires Netlify Functions.

5. Run the Express backend locally:

   ```bash
   npm run server
   ```

   The API listens on `process.env.PORT || 3001`.

## Netlify Deployment

1. Create a Netlify site connected to this repo.
2. Add these environment variables in Netlify:
   - `VITE_API_BASE_URL=http://161.153.75.96:3001`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy with the included `netlify.toml`.

The Netlify frontend calls the Oracle VPS Express API for Brawl Stars data. Do not configure the frontend to call Netlify Functions for Brawl Stars requests.

Netlify settings:

- Build command: `npm run build`
- Publish directory: `dist`

## Frontend API Configuration

The deployed Netlify frontend must be configured with:

```bash
VITE_API_BASE_URL=http://161.153.75.96:3001
```

Frontend Brawl Stars data requests use:

- `GET ${VITE_API_BASE_URL}/api/player/:tag`
- `GET ${VITE_API_BASE_URL}/api/battlelog/:tag`
- `POST ${VITE_API_BASE_URL}/api/sync/:tag`
- `GET ${VITE_API_BASE_URL}/api/analyze/:tag`

The browser never calls the official Brawl Stars API directly and no longer calls Netlify Functions for Brawl Stars data.

## Oracle VPS Deployment

The VPS backend is a standard Express server in `server/index.js`.

1. SSH into the Oracle VPS and enter the cloned repo:

   ```bash
   ssh opc@your-vps-ip
   cd ~/BrawlStarsCoach
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env` on the VPS:

   ```bash
   BRAWL_STARS_API_TOKEN=your_official_brawl_stars_api_token
   PORT=3001
   CORS_ORIGIN=https://your-netlify-site.netlify.app
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `BRAWL_STARS_API_TOKEN` are server-only. Do not prefix them with `VITE_` or expose them in the frontend.

4. Start the API:

   ```bash
   npm run server
   ```

5. Check health from the VPS:

   ```bash
   curl http://localhost:3001/health
   ```

   Expected response:

   ```json
   { "ok": true }
   ```

6. Keep it running with a process manager such as `pm2`:

   ```bash
   npm install -g pm2
   pm2 start npm --name brawl-stars-coach-api -- run server
   pm2 save
   pm2 startup
   ```

7. Set `VITE_API_BASE_URL=http://161.153.75.96:3001` in Netlify so the deployed frontend calls the VPS backend instead of Netlify Functions.

Oracle ports `22` and `3001` must be open in the subnet security list and instance firewall. The Brawl Stars API battlelog only returns recent battles, so keep syncing regularly if you want long-term history.

### Express API Routes

- `GET /health`
- `GET /api/player/:tag`
- `GET /api/battlelog/:tag`
- `POST /api/sync/:tag`
- `GET /api/analyze/:tag`

Tags can be sent with or without `#`, for example `/api/player/GQ0GRPCVQ` or `/api/player/%23GQ0GRPCVQ`.

## Coaching Logic

Analysis is deterministic and intentionally AI-free in this first pass. It calculates:

- Win rate by brawler, mode, and map.
- Star player rate.
- Recent form from the latest saved battles.
- Survival score as a proxy from result and duration when available.
- Versatility from brawler and mode spread.
- Role/archetype fit from a local brawler role map.
- Teammate dependency from star-player share of wins.
- Counter notes from enemy brawlers appearing in losses.

Upgrade recommendations score brawlers by win rate, recent form, role/mode coverage, star-player rate, survival proxy, and current power level. Small samples are penalized, and each recommendation is marked `Low`, `Medium`, or `High` confidence.

## Security Notes

- `BRAWL_STARS_API_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` are used only inside Netlify Functions or the Express backend.
- The browser never receives the official Brawl Stars token.
- Row Level Security is enabled in the schema. The app currently reads and writes through server functions using the service role key.
