# IOT-Automation

Next.js (App Router, TypeScript), Tailwind CSS, and Prisma with MongoDB.

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Set `DATABASE_URL`, `REDIS_URL`, the JWT secrets, and `MQTT_BROKER_URL` in `.env`. Open http://localhost:3000.

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` / `npm run typecheck`
- `npm run db:generate` / `npm run db:push` / `npm run db:studio`
- `npm run mqtt:worker` — subscribes to device status/telemetry and caches the latest payload in Redis

## MQTT topics

- Commands: `farm/{farmId}/device/{deviceId}/command` (QoS 1)
- Status: `farm/{farmId}/device/{deviceId}/status`
- Telemetry: `farm/{farmId}/device/{deviceId}/telemetry`

The worker caches snapshots under `device:{farmId}:{deviceId}:status` and `device:{farmId}:{deviceId}:telemetry` with `MQTT_CACHE_TTL_SECONDS`.

## Real-time telemetry

Telemetry is also published to the Redis channel `telemetry:{farmId}:{deviceId}`. The authenticated SSE route `GET /api/telemetry/stream?farmId={farmId}&deviceId={deviceId}` streams those messages to the dashboard, starting with the cached snapshot when one exists.

Prisma is pinned to v6.19.3 because Prisma 7 has no MongoDB connector. `.vscode/settings.json` pins the editor language server to v6; use the npm scripts rather than `npx prisma@latest`.
