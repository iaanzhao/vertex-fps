# VERTEX — Low Poly FPS

A browser low-poly FPS built with Three.js — flat-shaded meshes, outdoor arena, team deathmatch vs bots, destructible cover, and three weapons.

## Play

```bash
npm install
npm run dev
```

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| Shift | Sprint |
| Space | Jump |
| Left click (hold) | Shoot |
| Right click | Aim |
| 1 / 2 / 3 | AR-15 / VECTOR / HAWK |
| Esc | Pause menu |

## Features

- **Low-poly visuals** — flat-shaded geometry, stylized trees and rocks
- **Team Deathmatch** — 3-minute match, first to 20 kills wins
- **Destructible cover** — shoot crates to break them
- **3 weapons** — rifle, SMG, sniper with different damage and fire rate
- **Kill feed**, K/D, respawn, HUD

## Live demo

https://iaanzhao.github.io/vertex-fps/

Deploy updates with `npm run deploy`.

## Multiplayer

GitHub Pages only hosts the game client. Real-time multiplayer needs the WebSocket server in `server/`.

### Local (two browser tabs)

```bash
npm install
npm install --prefix server
npm run dev:all
```

1. Tab A: **HOST ONLINE** — copy the room code
2. Tab B: enter the code → **JOIN ONLINE**

### Deploy the server (free on Render)

1. Push this repo to GitHub
2. [Render](https://render.com) → New **Blueprint** → connect repo (uses `render.yaml`)
3. Copy your service URL (e.g. `vertex-fps-server.onrender.com`)
4. Rebuild the client with the WebSocket URL:

```bash
VITE_WS_URL=wss://YOUR-SERVICE.onrender.com npm run deploy
```

Share join links: `https://iaanzhao.github.io/vertex-fps/?room=ABCD`
