# IOT-Automation

Next.js (App Router, TypeScript), Tailwind CSS, and Prisma with MongoDB.

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Set `DATABASE_URL` in `.env` to your MongoDB connection string. Open http://localhost:3000.

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` / `npm run typecheck`
- `npm run db:generate` / `npm run db:push` / `npm run db:studio`

Prisma is pinned to v6.19.3 because Prisma 7 has no MongoDB connector. `.vscode/settings.json` pins the editor language server to v6; use the npm scripts rather than `npx prisma@latest`.
