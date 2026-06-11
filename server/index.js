import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8765;
const MATCH_TIME = 180;
const KILL_LIMIT = 20;
const RESPAWN_TIME = 2.5;
const TICK_RATE = 20;
const MAX_PLAYERS = 8;
const HIT_RADIUS = 0.58;

const WEAPONS = {
  rifle: { damage: 28, fireRate: 0.1, range: 120 },
  smg: { damage: 14, fireRate: 0.055, range: 80 },
  sniper: { damage: 95, fireRate: 0.85, range: 200 },
};

const SPAWN_POINTS = [
  [0, 1.7, 28], [-28, 1.7, 0], [28, 1.7, 0], [0, 1.7, -28],
  [-20, 1.7, -20], [20, 1.7, 20],
];

const rooms = new Map();

function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function pickSpawn() {
  return SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
}

function shootDirection(yaw, pitch) {
  const cosP = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosP,
    y: -Math.sin(pitch),
    z: -Math.cos(yaw) * cosP,
  };
}

function rayHitPlayer(shooter, weaponId) {
  const weapon = WEAPONS[weaponId] || WEAPONS.rifle;
  const dir = shootDirection(shooter.yaw, shooter.pitch);
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  dir.x /= len;
  dir.y /= len;
  dir.z /= len;

  let best = null;
  let bestT = weapon.range;

  for (const target of shooter.room.players.values()) {
    if (target.id === shooter.id || target.dead) continue;
    const cx = target.x;
    const cy = target.y - 0.35;
    const cz = target.z;
    const vx = cx - shooter.x;
    const vy = cy - shooter.y;
    const vz = cz - shooter.z;
    const t = vx * dir.x + vy * dir.y + vz * dir.z;
    if (t < 0 || t > weapon.range) continue;
    const px = shooter.x + dir.x * t;
    const py = shooter.y + dir.y * t;
    const pz = shooter.z + dir.z * t;
    const dist = Math.hypot(cx - px, cy - py, cz - pz);
    if (dist <= HIT_RADIUS && t < bestT) {
      best = target;
      bestT = t;
    }
  }
  return best ? { target: best, weapon } : null;
}

class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map();
    this.matchTime = MATCH_TIME;
    this.running = false;
    this.ended = false;
  }

  broadcast(msg, exceptId) {
    const raw = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(raw);
    }
  }

  sendAll(msg) {
    const raw = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.ws.readyState === 1) p.ws.send(raw);
    }
  }

  playerSnapshot() {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      weapon: p.weapon,
      health: p.health,
      kills: p.kills,
      deaths: p.deaths,
      dead: p.dead,
    }));
  }

  startIfReady() {
    if (this.running || this.ended || this.players.size < 1) return;
    this.running = true;
    this.matchTime = MATCH_TIME;
    this.sendAll({ type: 'match_start', matchTime: this.matchTime });
  }

  tick(dt) {
    if (!this.running || this.ended) return;

    this.matchTime -= dt;
    for (const p of this.players.values()) {
      if (p.dead) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) this.respawnPlayer(p);
      }
    }

    if (this.matchTime <= 0) {
      this.endMatch();
      return;
    }

    this.sendAll({
      type: 'snapshot',
      matchTime: Math.max(0, this.matchTime),
      players: this.playerSnapshot(),
    });
  }

  respawnPlayer(p) {
    const [x, y, z] = pickSpawn();
    p.x = x;
    p.y = y;
    p.z = z;
    p.health = 100;
    p.dead = false;
    p.respawnTimer = 0;
    this.sendAll({ type: 'respawn', id: p.id, x, y, z });
  }

  killPlayer(victim, killer) {
    victim.dead = true;
    victim.deaths++;
    victim.respawnTimer = RESPAWN_TIME;
    if (killer) {
      killer.kills++;
      this.sendAll({
        type: 'kill',
        killerId: killer.id,
        victimId: victim.id,
        killerName: killer.name,
        victimName: victim.name,
        headshot: false,
      });
      if (killer.kills >= KILL_LIMIT) {
        this.endMatch(killer);
      }
    }
  }

  endMatch(winner) {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    const scores = [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths }))
      .sort((a, b) => b.kills - a.kills);
    this.sendAll({
      type: 'match_end',
      winnerId: winner?.id ?? scores[0]?.id ?? null,
      winnerName: winner?.name ?? scores[0]?.name ?? null,
      scores,
    });
  }

  removePlayer(id) {
    this.players.delete(id);
    this.broadcast({ type: 'player_left', id });
    if (this.players.size === 0) rooms.delete(this.code);
  }
}

let nextId = 1;

function getOrCreateRoom(code) {
  const upper = code.toUpperCase();
  if (!rooms.has(upper)) rooms.set(upper, new Room(upper));
  return rooms.get(upper);
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('VERTEX multiplayer server\n');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  let player = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'ping') {
      const code = String(msg.room || '').toUpperCase();
      const room = rooms.get(code);
      ws.send(JSON.stringify({
        type: 'pong',
        exists: !!(room && !room.ended),
        players: room?.players.size ?? 0,
      }));
      return;
    }

    if (msg.type === 'create') {
      if (player) return;
      let code = randomRoomCode();
      while (rooms.has(code)) code = randomRoomCode();
      const room = getOrCreateRoom(code);
      if (room.players.size >= MAX_PLAYERS) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
      }
      const [x, y, z] = pickSpawn();
      const id = String(nextId++);
      player = {
        id,
        name: String(msg.name || 'Player').slice(0, 16),
        ws,
        room,
        x, y, z,
        yaw: 0,
        pitch: 0,
        weapon: 'rifle',
        health: 100,
        kills: 0,
        deaths: 0,
        dead: false,
        respawnTimer: 0,
        lastShoot: 0,
      };
      room.players.set(id, player);
      ws.send(JSON.stringify({
        type: 'welcome',
        id,
        room: room.code,
        players: room.playerSnapshot(),
        matchTime: room.matchTime,
        running: room.running,
      }));
      room.broadcast({ type: 'player_joined', player: room.playerSnapshot().find((p) => p.id === id) }, id);
      room.startIfReady();
      return;
    }

    if (msg.type === 'join') {
      if (player) return;
      const code = String(msg.room || '').toUpperCase();
      if (!code) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room code required' }));
        return;
      }
      const room = rooms.get(code);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
      }
      if (room.ended) {
        ws.send(JSON.stringify({ type: 'error', message: 'Match already ended' }));
        return;
      }
      if (room.players.size >= MAX_PLAYERS) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
      }
      const [x, y, z] = pickSpawn();
      const id = String(nextId++);
      player = {
        id,
        name: String(msg.name || 'Player').slice(0, 16),
        ws,
        room,
        x, y, z,
        yaw: 0,
        pitch: 0,
        weapon: 'rifle',
        health: 100,
        kills: 0,
        deaths: 0,
        dead: false,
        respawnTimer: 0,
        lastShoot: 0,
      };
      room.players.set(id, player);
      ws.send(JSON.stringify({
        type: 'welcome',
        id,
        room: room.code,
        players: room.playerSnapshot(),
        matchTime: room.matchTime,
        running: room.running,
      }));
      room.broadcast({ type: 'player_joined', player: room.playerSnapshot().find((p) => p.id === id) }, id);
      room.startIfReady();
      return;
    }

    if (!player) return;

    if (msg.type === 'state') {
      if (player.dead) return;
      player.x = Number(msg.x) || player.x;
      player.y = Number(msg.y) || player.y;
      player.z = Number(msg.z) || player.z;
      player.yaw = Number(msg.yaw) || 0;
      player.pitch = Number(msg.pitch) || 0;
      if (WEAPONS[msg.weapon]) player.weapon = msg.weapon;
      return;
    }

    if (msg.type === 'shoot') {
      if (player.dead || !player.room.running) return;
      const weapon = WEAPONS[msg.weapon] || WEAPONS.rifle;
      const now = Date.now() / 1000;
      if (now - player.lastShoot < weapon.fireRate) return;
      player.lastShoot = now;

      const hit = rayHitPlayer(player, msg.weapon);
      if (!hit) {
        player.ws.send(JSON.stringify({ type: 'shot', hit: false }));
        return;
      }

      hit.target.health -= hit.weapon.damage;
      player.ws.send(JSON.stringify({ type: 'shot', hit: true }));
      hit.target.ws.send(JSON.stringify({ type: 'damaged', amount: hit.weapon.damage, health: hit.target.health }));

      if (hit.target.health <= 0) {
        player.room.killPlayer(hit.target, player);
      }
      return;
    }
  });

  ws.on('close', () => {
    if (player) player.room.removePlayer(player.id);
  });
});

setInterval(() => {
  const dt = 1 / TICK_RATE;
  for (const room of rooms.values()) room.tick(dt);
}, 1000 / TICK_RATE);

httpServer.listen(PORT, () => {
  console.log(`VERTEX server on port ${PORT}`);
});
