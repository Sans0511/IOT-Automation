# IOT-Automation

A farm automation dashboard for publishing visual farm layouts, watching live device state, and sending manual pump/valve commands.

The stack is Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 6 with MongoDB, Redis Pub/Sub, MQTT, and a standalone WebSocket server built with `ws`.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Repository map](#repository-map)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Running the application](#running-the-application)
- [Authentication and roles](#authentication-and-roles)
- [Pages and UI](#pages-and-ui)
- [API reference](#api-reference)
- [MQTT, Redis, and WebSocket contracts](#mqtt-redis-and-websocket-contracts)
- [Device state model](#device-state-model)
- [Farm layout data](#farm-layout-data)
- [Hardware simulator](#hardware-simulator)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Current implementation notes](#current-implementation-notes)

## Features

- JWT cookie-based authentication with `ADMIN` and `USER` roles.
- Admin UI for users, farms, and per-farm visual layouts.
- React Konva layout editor with devices, background items, ports, waypoints, branching flow lines, copy/paste, rotation, and scaling.
- Publish flow that promotes layout preset placeholders into real `Device` records.
- User dashboard that renders the published layout read-only.
- Live device status badges, pump/valve flow animation, soil moisture gauge, and rain overlay.
- Manual ON/OFF commands for pumps and valves through a confirmation dialog.
- MQTT ingestion worker with status caching and a 60-second telemetry watchdog.
- Standalone authenticated WebSocket server for farm-wide or per-device live updates.
- MQTT hardware simulator for moisture telemetry plus pump, valve, and rain status cycling.

## Architecture

```text
Admin browser
    |
    | HTTP
    v
Next.js App Router  <---- Prisma ----> MongoDB
    |                         |
    | command API             | users / farms / devices / layouts
    v
MQTT broker  <---- MQTT ----> hardware / simulator
    |
    | status + telemetry topics
    v
MQTT worker (server/mqttWorker.ts)
    |
    | Redis Pub/Sub + status snapshot cache
    v
WebSocket server (server/websocketServer.ts) ----> User dashboard
```

Command path:

```text
Dashboard click
  -> POST /api/devices/{deviceId}/command
  -> MQTT publish farm/{farmId}/device/{deviceId}/command
  -> optimistic status cached in Redis
  -> Redis status channel
  -> WebSocket broadcast
  -> dashboard badge updates
```

Telemetry is intentionally realtime-only. The MQTT worker publishes telemetry to Redis Pub/Sub but does not persist telemetry snapshots. Status snapshots are cached so they can be replayed on dashboard load and WebSocket connect.

## Repository map

```text
hardware-similator.js              MQTT-only device simulator
prisma/schema.prisma               MongoDB models and enums
server/
  mqttWorker.ts                    MQTT subscriber, status cache, stale watchdog
  websocketServer.ts               standalone authenticated WebSocket server
src/
  app/
    page.tsx                       user dashboard
    login/                         login page
    admin/                         admin overview, users, farms, layout editor
    api/                           route handlers
  components/
    farm-layout/                   editor, viewer, Konva canvas, palettes, helpers
    PublishedLayoutPanel.tsx       live dashboard panel
    DeviceControls.tsx             manual pump/valve buttons
    Admin*.tsx                     admin management UI
  lib/
    api-auth.ts                    JWT/cookie verification and ownership rules
    api-helpers.ts                 shared validation/error helpers
    device-control.ts              controllable device types and toggle logic
    farm-layout.ts                 layout types, validation, port geometry
    mqttClient.ts                  validated QoS 1 MQTT command publisher
    prisma.ts                      Prisma client singleton
    published-layout.ts            published layout hydration for dashboard
    redis.ts                       Redis client, status cache, channel publishers
    telemetry.ts                   envelopes, keys, channels, runtime state
  proxy.ts                         route protection for / and /login
```

## Prerequisites

- Node.js 20.9+; Node 22 is recommended.
- MongoDB, either local or Atlas.
- Redis, either local or hosted.
- An MQTT broker such as Mosquitto, HiveMQ, or another compatible broker.
- Git and npm.

Prisma is pinned to `6.19.3` because Prisma 7 does not include the MongoDB connector. Use the npm scripts instead of `npx prisma@latest`.

## Local setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`, then prepare the database:

```bash
npm run db:generate
npm run db:push
```

There is no seed script and no public registration page. Create the first `ADMIN` user directly in MongoDB with a bcrypt-hashed password, or use an existing admin account. To generate a hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('change-me', 12))"
```

Insert a document into the `User` collection with `name`, unique lowercase `email`, that hash in `password`, and `role: "ADMIN"`. After signing in, additional users can be created from `/admin/users`.

## Environment variables

Copy `.env.example` and set the following values.

| Variable | Used by | Required | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Next.js, WebSocket server | Yes | MongoDB connection string. |
| `REDIS_URL` | Next.js, worker, WebSocket server | Yes | Redis connection string for cache and Pub/Sub. |
| `JWT_ACCESS_SECRET` | Next.js, proxy, WebSocket server | Yes | Signs and verifies 15-minute access tokens. |
| `JWT_REFRESH_SECRET` | Next.js | Yes | Signs and verifies 7-day refresh tokens. |
| `MQTT_BROKER_URL` | Next.js, worker | Yes | Broker URL: `mqtt:`, `mqtts:`, `ws:`, or `wss:`. |
| `MQTT_CACHE_TTL_SECONDS` | MQTT worker | No | Status snapshot TTL. Default `86400`. |
| `WS_PORT` | WebSocket server | No | WebSocket port. Default `3001`. |
| `WEBSOCKET_ALLOWED_ORIGINS` | WebSocket server | No | Comma-separated exact browser origins. Defaults to localhost:3000. |
| `NEXT_PUBLIC_WS_URL` | Browser UI | No | Browser-visible WS base URL. Falls back to `ws(s)://{hostname}:3001`. |
| `INTERVAL_MS` | Simulator | No | Moisture publish interval. Default `1000`. |
| `FARM_ID` | Simulator | No | Demo farm ID override. |
| `DEVICE_ID` | Simulator | No | Moisture sensor ID override. |
| `PUMP_DEVICE_ID` | Simulator | No | Pump ID override. |
| `VALVE_1_DEVICE_ID` | Simulator | No | First valve ID override. |
| `VALVE_2_DEVICE_ID` | Simulator | No | Second valve ID override. |
| `RAIN_DEVICE_ID` | Simulator | No | Rain detector ID override. |

The simulator has hard-coded ObjectId defaults for the bundled demo farm and falls back to `mqtt://broker.hivemq.com:1883` when `MQTT_BROKER_URL` is unset. Set these override variables when using another farm or broker.

`NEXT_PUBLIC_WS_URL` is compiled into the client bundle. Never put secrets in any `NEXT_PUBLIC_*` variable.

## Running the application

Run these in separate terminals:

```bash
npm run dev
```

```bash
npm run mqtt:worker
```

```bash
npm run ws:server
```

```bash
npm run simulate:moisture
```

| Process | URL / port | Notes |
| --- | --- | --- |
| Next.js | `http://localhost:3000` | UI and API routes. |
| MQTT worker | none | Subscribes to MQTT and publishes to Redis. |
| WebSocket server | `ws://localhost:3001/ws`, `http://localhost:3001/health` | Requires the access-token cookie. |
| Simulator | none | Optional; publishes synthetic device messages. |

Production build:

```bash
npm run build
npm run start
```

The WebSocket and MQTT worker processes must still be started separately in production.

## Authentication and roles

- Login: `POST /api/auth/login`.
- Access token lifetime: 15 minutes, stored in the `access_token` HttpOnly cookie.
- Refresh token lifetime: 7 days, stored in the `refresh_token` HttpOnly cookie and in Redis at `refresh_token:{userId}`.
- Refresh: `POST /api/auth/refresh`; rotates both tokens and replaces the stored refresh token.
- `USER` accounts can access only farms they own.
- `ADMIN` accounts can access all farms, devices, and admin pages.
- `/` and `/login` are guarded by `src/proxy.ts`.
- `/admin/**` is guarded by `src/app/admin/layout.tsx`.
- API routes independently authenticate and authorize every request.
- The WebSocket server verifies the access cookie, origin, farm ownership, and optional device membership.

Cookies use `SameSite=Lax`, `HttpOnly`, `path=/`, and `secure` in production.

## Pages and UI

| Route | Purpose |
| --- | --- |
| `/login` | Sign in with email and password. |
| `/` | User dashboard with live published layout and device controls. |
| `/admin` | Counts and paginated farm overview. |
| `/admin/users` | Create, edit, and delete users. |
| `/admin/farms` | Create, edit, delete farms and open the layout editor. |
| `/admin/farms/{id}/layout` | Visual farm layout designer. |

The dashboard currently selects the published farm whose name is exactly `Pranithi Farms`. Change `src/app/page.tsx` to use a different selection rule.

The layout editor supports:

- Dragging devices and presets onto the canvas.
- Adding scenery from the background palette.
- Moving, rotating, copying, pasting, and resizing items.
- Drawing connections from device ports, background-item ports, or existing flow lines.
- Saving a draft or publishing the layout.
- Optimistic version checking; stale saves return `409 Conflict`.

Publishing materializes uncreated preset placements as real `Device` records and then makes the layout visible to the dashboard.

## API reference

All errors use `{ "error": string }`.

### Authentication

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | Validate credentials and set cookies. |
| POST | `/api/auth/register` | Admin | Create a user. No public registration page exists. |
| POST | `/api/auth/refresh` | Refresh cookie | Rotate access and refresh tokens. |

### Farms and devices

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/farms` | Auth | List owned farms; admins see all. |
| POST | `/api/farms` | Auth | Create a farm owned by the caller. |
| GET | `/api/farms/{id}` | Owner/admin | Read a farm with devices. |
| PATCH | `/api/farms/{id}` | Owner/admin | Update farm fields. |
| DELETE | `/api/farms/{id}` | Owner/admin | Delete a farm and cascading records. |
| GET | `/api/devices` | Auth | List devices; optional `farmId`. |
| POST | `/api/devices` | Owner/admin | Create a device. |
| GET | `/api/devices/{id}` | Owner/admin | Read a device. |
| PATCH | `/api/devices/{id}` | Owner/admin | Update a device or move it to another farm. |
| DELETE | `/api/devices/{id}` | Owner/admin | Delete a device. |
| POST | `/api/devices/{id}/command` | Owner/admin | Send `ON` or `OFF`. |

Command request:

```json
{ "command": "ON" }
```

Only `MOTOR_PUMP`, `PUMP`, `SOLENOID_VALVE`, and `VALVE` are controllable.

### Layout and telemetry

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/layout?email=` | Own email/admin | List published layouts and cached statuses. |
| GET | `/api/telemetry/stream?farmId=&deviceId=` | Owner/admin | Telemetry-only SSE stream. |

### Admin

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/admin/farms` | Create a farm for a chosen owner. |
| PATCH | `/api/admin/farms/{id}` | Update farm and owner. |
| DELETE | `/api/admin/farms/{id}` | Delete a farm. |
| GET | `/api/admin/farms/{id}/layout` | Load editable layout. |
| PUT | `/api/admin/farms/{id}/layout` | Save or publish layout. |
| PATCH | `/api/admin/users/{id}` | Update user and role. |
| DELETE | `/api/admin/users/{id}` | Delete user. |

## MQTT, Redis, and WebSocket contracts

### MQTT topics

| Direction | Topic | Payload examples |
| --- | --- | --- |
| Command in | `farm/{farmId}/device/{deviceId}/command` | `{"state":"ON"}`, `{"state":"OFF"}` |
| Status in | `farm/{farmId}/device/{deviceId}/status` | `{"state":"ONLINE","pumpOn":true}`, `{"state":"RAINING"}`, `{"state":"STALE"}` |
| Telemetry in | `farm/{farmId}/device/{deviceId}/telemetry` | `{"moisture":52}` |

The worker accepts JSON objects only. It wraps each valid message in an envelope:

```json
{
  "farmId": "...",
  "deviceId": "...",
  "kind": "status",
  "payload": {},
  "topic": "farm/.../device/.../status",
  "receivedAt": "2026-01-01T00:00:00.000Z"
}
```

### Redis keys and channels

| Pattern | Type | Purpose |
| --- | --- | --- |
| `device:{farmId}:{deviceId}:status` | string | Latest cached status envelope. |
| `status:{farmId}:{deviceId}` | Pub/Sub | Live status fanout. |
| `telemetry:{farmId}:{deviceId}` | Pub/Sub | Live telemetry fanout. |
| `refresh_token:{userId}` | string | Current refresh token. |

Telemetry snapshots are not written to Redis.

### WebSocket server

Connect to:

```text
ws://localhost:3001/ws?farmId={farmId}&deviceId=all
```

`deviceId` may be a specific device ID or `all`. The browser must send the `access_token` cookie on the upgrade request. Origin must match `WEBSOCKET_ALLOWED_ORIGINS` when an Origin header is present.

Server frames:

```json
{ "type": "ready", "farmId": "...", "deviceId": "all" }
{ "type": "status", "data": { "...envelope..." } }
{ "type": "telemetry", "data": { "...envelope..." } }
```

Cached status envelopes are replayed before `ready`. There is no telemetry replay. The server sends `ping` every 15 seconds and terminates sockets that do not respond with `pong`.

The SSE route `/api/telemetry/stream` is authenticated and streams telemetry frames only. The active dashboard uses WebSocket, not SSE.

## Device state model

`src/lib/telemetry.ts` derives runtime state from status and telemetry envelopes.

| State | Meaning |
| --- | --- |
| `RUNNING` | Pump/device actively running. |
| `RAINING` | Rain detector reports rain. |
| `OPEN` | Valve open. |
| `CLOSED` | Valve closed. |
| `STOPPED` | Pump/device stopped. |
| `ONLINE` | Reachable but no active state. |
| `OFFLINE` | Explicitly offline or disconnected. |
| `STALE` | No fresh message within the freshness window. |
| `NO DATA` | No envelope available. |

Freshness rules:

- Normal status/telemetry expires after 60 seconds.
- Optimistic command status remains fresh for 10 minutes.
- The worker emits `{ "state": "STALE" }` after 60 seconds without telemetry for telemetry devices.
- The first telemetry message after a stale period produces an `ONLINE` status.
- Rain devices use `RAINING` or `raining/rain: true`; `STALE` clears the rain overlay.

The dashboard shows green pulse rings for active pumps/valves, blue rain drops when a rain detector is `RAINING`, and a white-needle analog gauge for fresh moisture telemetry.

## Farm layout data

A farm has one `FarmLayout` record identified by `farmId`.

```json
{
  "width": 1200,
  "height": 800,
  "backgroundKey": "classic-farm",
  "placements": [],
  "backgroundItems": [],
  "connections": [],
  "version": 0
}
```

Limits enforced by the save API:

| Field | Limit |
| --- | --- |
| `placements` | 500 items |
| `backgroundItems` | 200 items |
| `connections` | 500 items |
| `waypoints` | 200 per connection |
| Coordinates | clamped to `0..1200` / `0..800` |
| Rotation | normalized to `0..359` |
| Background scale | `0.5..2` |

Connection endpoints may target a device, background item, another connection, or a free point. Device ports are type-specific and rotate with the placement.

Presets available in the palette:

- `MOTOR_PUMP`
- `SOLENOID_VALVE`
- `MOISTURE_SENSOR`
- `RAIN_DETECTION`
- `SMART_IRRIGATION_CONTROLLER`

## Hardware simulator

`hardware-similator.js` is an MQTT-only publisher. It does not connect to Prisma, Redis, or WebSocket.

Moisture behavior:

- Starts at `50`.
- Publishes every `INTERVAL_MS`.
- Changes by `+1` or `-1` each tick.
- Clamps to `0..100`.

Status cycle, repeated continuously:

| Offset | Device | Payload |
| --- | --- | --- |
| 0 s | Valve 1 | `{"state":"ONLINE","valveOpen":true}` |
| 1 s | Pump | `{"state":"ONLINE","pumpOn":true}` |
| 11 s | Valve 2 | `{"state":"ONLINE","valveOpen":true}` |
| 21 s | Valve 1 | `{"state":"ONLINE","valveOpen":false}` |
| 31 s | Pump | `{"state":"ONLINE","pumpOn":false}` |
| 31 s | Rain detector | `{"state":"RAINING"}` |
| 33 s | Valve 2 | `{"state":"ONLINE","valveOpen":false}` |
| 46 s | Rain detector | `{"state":"STALE"}` and next cycle starts |

Each publish is logged with an ISO timestamp and `SENT` at the actual local send time. Timers are started from that send time, not from MQTT PUBACK.

## Verification

Run all checks before committing:

```bash
npm run typecheck
npm run lint
git diff --check
```

Production build:

```bash
npm run build
```

Manual live checks:

1. Start `dev`, `mqtt:worker`, `ws:server`, and `simulate:moisture`.
2. Sign in and open `/`.
3. Confirm the moisture gauge updates and the sensor shows `RUNNING` with a green ring.
4. Stop the simulator for over 60 seconds and confirm the sensor becomes `STALE`.
5. Watch the pump/valve sequence and confirm valve 2 closes within 2 seconds after pump OFF.
6. Watch the rain detector and confirm the blue rain overlay appears at `RAINING` and disappears at `STALE`.
7. Double-click a controllable device and confirm the command dialog publishes `ON`/`OFF`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Redirected to `/login` repeatedly | Verify `JWT_ACCESS_SECRET` and that the access cookie is present. |
| `/admin` redirects to `/` | The signed-in user role is not `ADMIN`. |
| Dashboard says status reconnecting | Start `npm run ws:server`; check `WS_PORT`, `NEXT_PUBLIC_WS_URL`, and `WEBSOCKET_ALLOWED_ORIGINS`. |
| Moisture gauge stays empty | Start `npm run mqtt:worker` and `npm run simulate:moisture`; confirm the telemetry topic and sensor ID. |
| Device badges never update | Check the worker, Redis connectivity, and status topic payloads. |
| Commands do not reach hardware | Verify `MQTT_BROKER_URL`, device ID, device type, and broker connectivity. |
| No published layout is available | Publish a layout for `Pranithi Farms`, or change the farm selection in `src/app/page.tsx`. |
| Layout save returns `409` | Another save changed `version`; reload the editor before saving. |
| Prisma MongoDB errors | Ensure Prisma `6.19.3` is used and run `npm run db:generate` / `npm run db:push`. |
| Optimistic status turns stale | Command-derived status is fresh for 10 minutes; wait for hardware status or send another command. |

## Current implementation notes

- The MQTT worker caches only status snapshots. Telemetry is pub/sub only, so the SSE initial telemetry snapshot is normally empty and the dashboard gauge waits for the first live frame.
- SSE is available but is not an active fallback in the current UI. A WebSocket failure shows a reconnecting state without automatic retry.
- The telemetry watchdog applies to devices that publish telemetry. Status-only devices depend on their own status payloads and client-side freshness checks.
- The dashboard currently hard-codes the published farm name `Pranithi Farms`.
- There is no logout UI. Refresh-token rotation limits reuse, and access tokens expire after 15 minutes.
- Only one refresh token is stored per user; a new login invalidates the previous refresh session.
- The login API returns tokens in its JSON response as well as setting HttpOnly cookies. Clients should rely on the cookies.
- The layout editor retries once through `/api/auth/refresh` after a `401`; other client mutations do not.
- Delete or move a device does not rewrite layout JSON. If stale references remain, reopen and republish the layout.
