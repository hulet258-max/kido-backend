# Deploy the backend to existing Easypanel services

## Configure services and environment

1. Keep the existing PostgreSQL and MinIO services running. The backend must have internal network access to both.
2. In MinIO Domains, add an HTTPS domain with internal protocol HTTP, target port **9000**, and path `/`. The supplied `console-mgnot-minio.v3rao3.easypanel.host` address targets the management console on **9001** and cannot be used for playback.
3. Create the backend App service from GitHub `hulet258-max/kido-backend`, branch `main`, Build Path `/`. Choose the Dockerfile builder and path `Dockerfile`. Leave the command override empty.
4. Copy `.env.production.example` into the backend's Environment editor. Supply your actual PostgreSQL password, admin key, and MinIO password there. Do not put secrets into the Dockerfile or commit them.
5. Keep `DB_HOST=mgnot_kidodb`, `DB_PORT=5432`, `DB_NAME=kido`, and `DB_USER=postgres` if these match the database Credentials page. For this deployment use `MINIO_ENDPOINT=mgnot-minio.v3rao3.easypanel.host`, `MINIO_PORT=443`, and `MINIO_USE_SSL=true`. The endpoint has no scheme or port suffix. Verify this domain routes to the MinIO API before deploying. MinIO can reject underscore-containing internal hostnames such as `mgnot_minio` even when Docker resolves them.
6. Set `MINIO_PUBLIC_URL=https://mgnot-minio.v3rao3.easypanel.host`. Set `MINIO_SECRET_KEY` to the real value corresponding to `MINIO_ACCESS_KEY=kido-storage-admin`. The backend connects over HTTPS on port 443; Easypanel forwards to internal HTTP port 9000. Do not use port 9000 with the public hostname unless it is separately published. A private connection is also possible using a reachable internal DNS alias without underscores, port 9000, and SSL false.
7. Set `CORS_ORIGIN` to the exact admin browser origin, such as `http://localhost:5173`. The current implementation supports a single origin, not a comma-separated list.
8. Mount a named backend volume at `/app/media`. Keep MinIO's persistent `/data` volume and PostgreSQL's existing data storage. Video objects live in MinIO, separately from database metadata.
9. Route the backend domain to HTTP port `4000`, path `/`, with public HTTPS. Save and Deploy after changing settings.

No database or video migration is performed by deployment. Startup retains the application's existing removal of legacy demo IDs; use a fresh database or back up existing data before reusing it.

## Startup logs

Successful startup logs these stages before opening the HTTP listener:

```text
[PostgreSQL] Connected: host=mgnot_kidodb port=5432 database=kido
[PostgreSQL] Database initialized
[MinIO] Connecting: protocol=https host=mgnot-minio.v3rao3.easypanel.host port=443 bucket=videos
[MinIO] Connected: host=mgnot-minio.v3rao3.easypanel.host port=443
[MinIO] Bucket ready: videos
[Media] FFmpeg and ffprobe available
[HTTP] Listening on 0.0.0.0:4000
```

Connection checks get five attempts separated by five seconds. PostgreSQL connection acquisition and its probe query have five-second timeouts. Each MinIO startup HTTP request has a five-second deadline; normal uploads do not have this short deadline. MinIO initialization checks bucket access, creates the bucket if absent, and applies the existing public object-read policy. The credentials must allow these operations.

Every failed attempt is logged with its service and sanitized error. After exhaustion the process exits with code 1 so the container manager can restart it. Database schema initialization errors and missing FFmpeg/ffprobe fail startup separately. Configuration errors fail immediately, including missing production settings or unreplaced placeholders. Passwords, access keys, and credential URLs are redacted; request headers and bodies are not logged.

The Docker health check allows 120 seconds for startup. `/api/health` is **liveness only** and keeps its existing response; it does not continuously probe PostgreSQL or MinIO. Runtime database pool errors, storage failures, and failed HTTP requests appear in container logs.

## Verify

1. Open `https://YOUR-BACKEND-DOMAIN/api/health` and check `data.status` is `ok`.
2. Open `/api/videos`; a fresh empty catalog is expected.
3. In KIDO Admin set the API URL to `https://YOUR-BACKEND-DOMAIN/api` and enter your runtime `ADMIN_API_KEY`.
4. Upload a small H.264/AAC MP4. Confirm the returned playlist uses the public MinIO API domain and playback works. The current HLS processor copies codecs rather than transcoding them.
5. Redeploy the backend and confirm the catalog, playlist, and video segments remain available.
6. Configure database backups and a separate backup of MinIO data.

`ECONNREFUSED` indicates an unavailable service or wrong port; `ENOTFOUND` indicates an invalid/unreachable internal hostname. PostgreSQL `28P01` indicates incorrect credentials. MinIO `AccessDenied` or `InvalidAccessKeyId` indicates credentials or permissions. Public playback failures with healthy internal storage usually indicate the wrong API domain/port or unsupported video codecs.

## Run the same image outside Easypanel

Build from the backend directory:

```sh
docker build -t kido-backend .
docker run --rm --env-file .env.production --network YOUR_EXISTING_NETWORK -p 4000:4000 -v kido-media:/app/media kido-backend
```

Create the ignored `.env.production` locally from the example and fill in actual values first. Easypanel internal hostnames only resolve on the appropriate server/network; they are not addresses for a Docker container on an unrelated laptop.

For the existing complete local stack, use `docker compose up --build`. Its internal hostnames are `postgres` and `minio`; it creates separate persistent services and does not connect to your Easypanel database. Local development defaults are not production credentials.

## Docker integration test

After building `docker build -t kido-backend:startup-check .`, run `powershell.exe -NoProfile -File tests/docker-smoke.ps1` on Windows with Docker Desktop running. The test creates a uniquely named private network and disposable services, verifies delayed MinIO recovery, upload, public HLS decoding, persistence after recreating the API, and configuration/connection failures. It removes its containers and anonymous volumes afterward. It never uses the production credentials or Easypanel services.
