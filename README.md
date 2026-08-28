# KIDO Backend

Node.js + TypeScript + Express API for the KIDO children's video platform.

The API uses PostgreSQL (database `kido`). On startup it creates tables if needed and seeds demo data when the catalog is empty.

## Requirements

- Node.js 18+
- PostgreSQL 14+ (a local `postgresql-x64-18` service is expected in development)

## Setup

```bash
cd kido-backend
cp .env.example .env
npm install
npm run dev
```

The API listens on `http://localhost:4000`.

Android emulator should use `http://10.0.2.2:4000/api`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Watch mode (`tsx`) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Interest, age, schedule, recommendation tests |

## Environment

See `.env.example`.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port |
| `NODE_ENV` | `development` | |
| `CORS_ORIGIN` | `*` | Restrict in production |
| `DATABASE_URL` | `postgres://kido:kido@127.0.0.1:5432/kido` | PostgreSQL connection |

Do not commit secrets. None are required for the demo.

## APIs

All routes are prefixed with `/api`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness |
| GET | `/videos` | Catalog |
| GET | `/videos/:id` | Single video |
| GET | `/categories` | Category counts |
| GET | `/recommendations/:childId` | Ranked feed (`?time=morning\|school\|after_school\|evening\|bedtime\|real`) |
| GET | `/children/:id` | Child + runtime |
| POST | `/children` | Create child |
| PUT | `/children/:id` | Update child |
| POST | `/events` | Viewing events |
| GET | `/reports/:childId` | Usage reports |
| GET | `/interests/:childId` | Interest scores |
| GET | `/parent/preferences/:childId` | Preferences |
| PUT | `/parent/preferences/:childId` | Preferences |
| GET | `/schedules/:childId` | Schedule |
| PUT | `/schedules/:childId` | Schedule |
| POST | `/parent/pin` | `{ "pin": "1234" }` |

Events example:

```json
{
  "childId": "child_001",
  "videoId": "video_001",
  "eventType": "video_completed",
  "watchDurationSeconds": 89,
  "percentageWatched": 95,
  "timestamp": "2026-08-24T12:00:00.000Z"
}
```

## PostgreSQL

Create the database and role (once):

```sql
CREATE ROLE kido LOGIN PASSWORD 'kido';
CREATE DATABASE kido OWNER kido;
GRANT ALL ON SCHEMA public TO kido;
```

The app connects as user `kido` to database `kido`. Tables:

- `videos`
- `parents`
- `children`
- `daily_usage`
- `viewing_events`

If `npm run dev` fails with `EADDRINUSE`, another process is already bound to port 4000. Stop it (or change `PORT` in `.env`) and start again.

## Seeded demo data

- Parent: Demo Parent, PIN `1234`
- Children: Sami (8), Hana (6)
- 28 openly licensed / sample MP4s
- Seven days of viewing history
- Sami today: 78 / 90 minutes

## Flutter connection

The Flutter app tries this API first and falls back to local demo repositories if the server is down. No ugly error is shown during a demo.

## Assumptions

- Data lives in PostgreSQL database `kido` and survives server restarts.
- Demo rows are inserted only when `videos` is empty.
- PIN verification is a demo stand-in, not production auth.
