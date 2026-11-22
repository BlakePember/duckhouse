# Duckhouse — Bughouse × Duck Chess

Online 2v2 multiplayer chess variant combining **Bughouse Chess** and **Duck Chess**, built with **React + TypeScript + Vite** on the frontend and **Cloudflare Workers + Durable Objects** (SQLite storage, Hibernation WebSockets, and Alarms) on the backend.

## Architecture
- **Frontend (`src/`):** React 19 + TypeScript + Vite SPA communicating over native WebSockets ([src/services/realtime.ts](./src/services/realtime.ts)). Also includes offline Practice Mode (**Solo vs 3 Bots** and **4-Seat Sandbox**).
- **Shared Engine (`shared/`):** Pure TypeScript Duckhouse rules engine ([shared/engine.ts](./shared/engine.ts)), wire protocol ([shared/protocol.ts](./shared/protocol.ts)), and AI bot ([shared/bot.ts](./shared/bot.ts)), shared identically between the browser and Cloudflare Durable Objects.
- **Cloudflare Workers + Durable Objects (`worker/`):**
  - `LobbyDO` ([worker/lobbyDO.ts](./worker/lobbyDO.ts)) — SQLite-backed public room directory, live online player presence, room creation, and 4-player random matchmaking queues using the WebSocket Hibernation API.
  - `RoomDO` ([worker/roomDO.ts](./worker/roomDO.ts)) — One isolated SQLite-backed Durable Object per room code (`getByName(code)`), handling authoritative move/drop/duck validation, Hibernation WebSockets, team-isolated chat, and Durable Object Alarms for live game clocks and AI bot turns.

## Rules Summary
- **Two Boards, Two Teams (2v2):** Team Emerald (`Board A White` + `Board B Black`) vs Team Amber (`Board A Black` + `Board B White`).
- **Bughouse Pockets & Drops:** Captured pieces transfer to your partner's pocket in their color (promoted pieces revert to pawns). On your turn, move a piece or drop a pocket piece onto any empty square (pawns cannot drop on ranks 1 or 8; nothing can drop on the duck).
- **Duck on Both Boards:** After every chess move or pocket drop, the active player must move their board's Duck to a different empty square. Pieces cannot land on or slide through the duck (Knights can jump over it).
- **Win Condition:** Official Duck Chess rules — no check restrictions. Capture either enemy King, flag an opponent on time, or win by resignation.

## Running Locally
```bash
npm install
npm run dev
```

`@cloudflare/vite-plugin` runs both the React frontend (with HMR) and the local Cloudflare Workers + Durable Objects runtime (`workerd`) together on **http://localhost:5173**.

Run unit tests and production build:
```bash
npm test
npm run build
```

## Production Deployment
- **Frontend + Backend (Cloudflare Workers + Durable Objects):** Hosted together on Cloudflare Workers at `https://duckhouse.blakepember.net` (Worker `duckhouse-api`, configured in [cloudflare.config.ts](./cloudflare.config.ts)).
- **Manual deploy:** Sign in once with `npx cf auth login` and run `npm run deploy`.
- **Automatic deploy:** [.github/workflows/ci.yml](./.github/workflows/ci.yml) runs unit tests and builds on every PR/push, and deploys to Cloudflare Workers on pushes to `main` when `CLOUDFLARE_API_TOKEN` is configured in GitHub repository secrets.
