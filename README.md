# KIDO Backend

Node.js + TypeScript + Express API for the KIDO children's video platform.

The API uses PostgreSQL (database `kido`) and MinIO for uploaded videos. Startup verifies both services and FFmpeg/ffprobe before accepting requests. It creates tables, removes legacy demo records, and inserts starter activities. A new database has an empty video catalog until videos are uploaded.

## Requirements

- Node.js 18+
- PostgreSQL 14+ (a local `postgresql-x64-18` service is expected in development)
- FFmpeg/ffprobe on `PATH` when running without Docker
- MinIO when running without Docker

## Setup

```bash
cd kido-backend
cp .env.example .env
npm install
npm run dev
```

The API listens on `http://localhost:4000`.

Android emulator should use `http://10.0.2.2:4000/api`.

### Complete local media stack

The included Compose file starts PostgreSQL, MinIO, and the FFmpeg-enabled backend. MinIO data and PostgreSQL data use named persistent volumes.

```bash
docker compose up --build
```

If port 4000 is already used by a locally running backend, start Compose with `BACKEND_PORT=4001` and point KIDO Admin at `http://localhost:4001/api`.

- API: `http://localhost:4000/api`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`
- Bucket: `videos` (created automatically on first upload)

Run `docker compose exec backend ffmpeg -version` to verify FFmpeg. For an Android emulator, set `MINIO_PUBLIC_URL=http://10.0.2.2:9000` before starting Compose so returned playlists are reachable from the emulator.

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
| `ADMIN_API_KEY` | `kido-local-admin` | Required as `X-Admin-Key` for content mutations |
| `MINIO_ENDPOINT` / `MINIO_PORT` | `127.0.0.1` / `9000` | Backend connection to MinIO |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | local defaults | MinIO credentials; change outside local development |
| `MINIO_BUCKET` | `videos` | HLS object bucket |
| `MINIO_USE_SSL` | `false` | Enable for HTTPS MinIO |
| `MINIO_PUBLIC_URL` | `http://127.0.0.1:9000` | Client-reachable MinIO origin used in playlist URLs |
| `FFMPEG_PATH` / `FFPROBE_PATH` | command names | Override local binary paths if needed |
| `MAX_UPLOAD_MB` | `500` | Multipart upload size ceiling |

Do not commit secrets. None are required for the demo.

## Docker / EasyPanel deployment

For deployment to your existing Easypanel services, follow [the deployment guide](DEPLOYMENT.md) and copy the settings from `.env.production.example` into Easypanel Environment. Replace all placeholders there. The backend image connects to PostgreSQL and MinIO; it does not start those servers inside the API container.

The production image compiles TypeScript and starts the existing server with
`node dist/index.js` (the same entry point used by `npm start`). No separate
`app.js` entry point is needed.

When the Git repository is connected to EasyPanel, create a PostgreSQL service
and an App service with these settings:

- Build method: `Dockerfile`
- Build context / root directory: `/` for `hulet258-max/kido-backend` (`/kido-backend` only when that directory is inside a larger repository)
- Dockerfile: `Dockerfile`
- Container port: `4000`
- Health check path: `/api/health`
- Persistent volume: mount to `/app/media`

The complete production settings, including required MinIO configuration, are in `.env.production.example`. Database settings look like:

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
docker run --rm -p 4000:4000 --env-file .env.production \
  --network YOUR_EXISTING_NETWORK -v kido-media:/app/media kido-backend
```

Create `.env.production` from `.env.production.example`, replace every placeholder, and use hosts reachable from the container. See the deployment guide for the complete setup.

## APIs

All routes are prefixed with `/api`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness |
| GET | `/videos` | Catalog |
| GET | `/videos/:id` | Single video |
| GET | `/categories` | Category counts |
| GET | `/activities` | Age/category-filterable activity catalog |
| GET | `/admin/videos` | Admin catalog (`X-Admin-Key`) |
| POST | `/admin/videos` | Multipart video upload, HLS processing, and publishing |
| DELETE | `/admin/videos/:id` | Remove video metadata and its HLS objects |
| GET/POST | `/admin/activities` | List/create reviewed activities |
| PUT/DELETE | `/admin/activities/:id` | Update/delete an activity |
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
- `activities`
- `parents`
- `children`
- `daily_usage`
- `viewing_events`

If `npm run dev` fails with `EADDRINUSE`, another process is already bound to port 4000. Stop it (or change `PORT` in `.env`) and start again.

## Initial data

Startup inserts starter activities and removes the old demo parent, children, viewing history, and legacy demo video IDs. It does not seed demo accounts or videos. Register accounts through the app and upload videos through KIDO Admin.

## Flutter connection

The Flutter app tries this API first and falls back to local demo repositories if the server is down. No ugly error is shown during a demo.

## Assumptions

- Data lives in PostgreSQL database `kido` and survives server restarts.
- Starter activities are inserted if missing. Legacy demo IDs are removed at startup.
- PIN verification is a demo stand-in, not production auth.
