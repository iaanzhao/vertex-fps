import * as THREE from 'three';
import { createLowPolyCharacter, SKINS } from './lowpoly.js';

function skinForId(id) {
  const n = Number(id) || id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return SKINS[Math.abs(n) % SKINS.length];
}

export function createRemotePlayerSystem(scene) {
  const remotes = new Map();

  function ensure(id, name) {
    if (remotes.has(id)) return remotes.get(id);
    const skin = skinForId(id);
    const { group, body, legL, legR } = createLowPolyCharacter(skin, 0x1e88e5);
    scene.add(group);
    const entry = {
      mesh: group,
      body,
      legL,
      legR,
      name: name || 'Player',
      cur: { x: 0, y: 0, z: 0, yaw: 0 },
      target: { x: 0, y: 0, z: 0, yaw: 0, dead: false },
      walkPhase: Math.random() * Math.PI * 2,
    };
    remotes.set(id, entry);
    return entry;
  }

  function syncFromSnapshot(players, myId) {
    const seen = new Set();
    for (const p of players) {
      if (p.id === myId) continue;
      seen.add(p.id);
      const r = ensure(p.id, p.name);
      r.name = p.name;
      r.target.x = p.x;
      r.target.y = p.y;
      r.target.z = p.z;
      r.target.yaw = p.yaw;
      r.target.dead = p.dead;
      if (r.cur.x === 0 && r.cur.z === 0) {
        r.cur.x = p.x;
        r.cur.y = p.y;
        r.cur.z = p.z;
        r.cur.yaw = p.yaw;
      }
    }
    for (const id of remotes.keys()) {
      if (!seen.has(id)) remove(id);
    }
  }

  function remove(id) {
    const r = remotes.get(id);
    if (!r) return;
    scene.remove(r.mesh);
    remotes.delete(id);
  }

  function clear() {
    for (const id of [...remotes.keys()]) remove(id);
  }

  function update(dt) {
    for (const r of remotes.values()) {
      const t = 1 - Math.pow(0.001, dt);
      r.cur.x += (r.target.x - r.cur.x) * t;
      r.cur.y += (r.target.y - r.cur.y) * t;
      r.cur.z += (r.target.z - r.cur.z) * t;

      let dy = r.target.yaw - r.cur.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      r.cur.yaw += dy * t;

      r.mesh.visible = !r.target.dead;
      r.mesh.position.set(r.cur.x, r.cur.y - 1.7, r.cur.z);
      r.mesh.rotation.y = r.cur.yaw;

      const dx = r.target.x - r.cur.x;
      const dz = r.target.z - r.cur.z;
      const moving = (dx * dx + dz * dz) > 0.02;
      r.walkPhase += dt * (moving ? 14 : 2);
      const legOff = Math.sin(r.walkPhase) * 0.1;
      r.legL.position.x = -0.22 - legOff;
      r.legR.position.x = 0.22 + legOff;
      r.body.position.y = 1.35 + Math.sin(r.walkPhase * 0.5) * (moving ? 0.03 : 0.01);
    }
  }

  return { syncFromSnapshot, remove, clear, update };
}
