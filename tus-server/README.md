# TUS Node Server (Express + MinIO)

Production-ready TUS endpoint using Express with streaming finalization to MinIO.

## Quick start

```bash
cd tus-server
cp .env.example .env
npm install
npm run dev
```

The server listens on `PORT` (default 4000) and exposes the TUS path at `TUS_PATH` (default `/files`). Point Uppy/TUS clients to `http://localhost:4000/files`.

## Env vars

See `.env.example` for all options. Key settings:

- `TUS_STORAGE_DIR`: temp staging directory for uploads
- `MAX_UPLOAD_SIZE_BYTES`: max allowed upload size
- `MINIO_*`: MinIO connection and bucket settings

## MinIO behavior

- Completed uploads stream from the local staging file to MinIO using `putObject`.
- Object keys are `uploads/<uploadId>/<filename|uploadId>`.
- After a successful stream, the local temp file and its `.info` metadata are deleted to free disk space.
- If MinIO streaming fails, the TUS response still succeeds; add a retry worker later to re-stream.

## Important rules (from architecture doc)

- TUS server performs no database writes.
- Large file operations use streaming only.
- Future eventing/batching can hook into the completion event handler.

## Health + debug

- `GET /health` returns `{ status: 'ok' }`.
- `GET /debug/uploads` lists files currently in `TUS_STORAGE_DIR` (for local debugging only).

## Next steps (future work)

- Emit RabbitMQ events on `POST_FINISH` for orchestration.
- Add auth/tenant scoping and per-tenant buckets/prefixes.
- Add cleanup job for stale partial uploads.
- Add structured logging and metrics.
- Add tests for the TUS pipeline and MinIO streaming.
