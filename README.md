# Brawl Stars Coach

Production-ready starter for a Brawl Stars coaching dashboard built with React, Vite, TypeScript, Supabase, and Netlify Functions.

The app keeps the official Brawl Stars API token on the server, persists every sync to Supabase before the battle log expires, and returns deterministic coaching analysis for brawler win rate and first-pass upgrade priorities.

## Features

- Player tag input and `Fetch Latest Battles` sync workflow.
- Defaults to `GQ0GRPCVQ` when the tag input is empty.
- Netlify Functions for `get-player`, `get-battlelog`, and `sync-battles`.
- Battle persistence with deduplication by player tag, battle time, mode, map, and normalized teams.
- Dashboard sections for player overview, recent battles, brawler performance, mode/map performance, upgrade recommendations, and manual match notes.
- Manual battle tags: `bad draft`, `carried`, `countered`, `felt controlled`, `tilted`, `teammates weak`.
- Auto-sync toggle that calls `sync-battles` every 5 minutes while the app is open.
- Error handling for invalid tags, API denial, rate limits, and missing environment variables.

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
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. Run locally with Netlify Functions:

   ```bash
   npm run netlify:dev
   ```

   Vite alone will render the frontend, but syncing requires Netlify Functions.

## Netlify Deployment

1. Create a Netlify site connected to this repo.
2. Add these environment variables in Netlify:
   - `BRAWL_STARS_API_TOKEN`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy with the included `netlify.toml`.

Netlify settings:

- Build command: `npm run build`
- Publish directory: `dist`

## API Routes

- `GET /api/get-player?tag=#PLAYER`
- `GET /api/get-battlelog?tag=#PLAYER`
- `POST /api/sync-battles` with `{ "tag": "#PLAYER" }`
- `GET /api/analyze-player?tag=#PLAYER`
- `POST /api/save-battle-note` with `{ "battleId": "...", "playerTag": "#PLAYER", "tags": [], "note": "" }`

Only `get-player`, `get-battlelog`, and `sync-battles` are required for the MVP. The note and analysis endpoints support saved-history UX without exposing service credentials.

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

- `BRAWL_STARS_API_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` are used only inside Netlify Functions.
- The browser never receives the official Brawl Stars token.
- Row Level Security is enabled in the schema. The app currently reads and writes through server functions using the service role key.
