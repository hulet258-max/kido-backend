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
| `DB_HOST` | `127.0.0.1` | PostgreSQL host or EasyPanel service name |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `kido` | PostgreSQL database |
| `DB_USER` | `kido` | PostgreSQL username |
| `DB_PASSWORD` | `kido` | PostgreSQL password; change in production |
| `DATABASE_URL` | unset | Optional connection URL; used when no `DB_*` values are configured |
| `CACHE_REMOTE_MEDIA` | `false` | Download remote videos into `/app/media` at startup |

Do not commit secrets. None are required for the demo.

## Docker / EasyPanel deployment

The production image compiles TypeScript and starts the existing server with
`node dist/index.js` (the same entry point used by `npm start`). No separate
`app.js` entry point is needed.

When the Git repository is connected to EasyPanel, create a PostgreSQL service
and an App service with these settings:

- Build method: `Dockerfile`
- Build context / root directory: `/kido-backend`
- Dockerfile: `Dockerfile`
- Container port: `4000`
- Health check path: `/api/health`
- Persistent volume: mount to `/app/media`

Set these App environment variables in EasyPanel:

```env
NODE_ENV=production
PORT=4000
DB_HOST=POSTGRES_SERVICE
DB_PORT=5432
DB_NAME=kido
DB_USER=kido
DB_PASSWORD=YOUR_SECURE_KIDO_PASSWORD
CACHE_REMOTE_MEDIA=false
CORS_ORIGIN=https://your-frontend-domain.example
```

Use the internal hostname and credentials shown by the EasyPanel PostgreSQL
service. The application creates its tables at startup. If public media should
survive redeployments, keep the `/app/media` volume mounted.

To build and run the image locally:

```bash
docker build -t kido-backend .
docker run --rm -p 4000:4000 \
  -e DB_HOST=host.docker.internal \
  -e DB_NAME=kido -e DB_USER=kido -e DB_PASSWORD=kido \
  kido-backend
```

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
