import * as THREE from 'three';
import { createLowPolyCharacter, randomSkin } from './lowpoly.js';

const ENEMY_SPEED = 5.5;
const ENEMY_DAMAGE = 8;
const SPAWN_INTERVAL = 2.2;
const MAX_ENEMIES = 14;
const TEAM_COLOR = 0xe53935;

const BOT_NAMES = [
  'PolyShot', 'TriHunter', 'FlatFace', 'LowLag', 'VertexX',
  'MeshLord', 'ShadeBot', 'PrismKiller', 'EdgeRunner', 'FacetFPS',
];

export function createEnemySystem(scene, getPlayerPos) {
  const enemies = [];
  let spawnTimer = 0;
  let nameIdx = 0;

  function spawnEnemy() {
    if (enemies.length >= MAX_ENEMIES) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 10;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const { group, body, hitMeshes, legL, legR } = createLowPolyCharacter(randomSkin(), TEAM_COLOR);
    group.position.set(x, 0, z);
    scene.add(group);

    const name = `${BOT_NAMES[nameIdx % BOT_NAMES.length]}_${nameIdx++ % 99}`;
    enemies.push({
      mesh: group,
      body,
      hitMeshes,
      legL,
      legR,
      name,
      health: 100,
      attackCooldown: 0,
      bobPhase: Math.random() * Math.PI * 2,
      walkPhase: Math.random() * Math.PI * 2,
    });
  }

  function update(dt, onPlayerHit) {
    spawnTimer += dt;
    if (spawnTimer >= SPAWN_INTERVAL) {
      spawnTimer = 0;
      spawnEnemy();
    }

    const playerPos = getPlayerPos();

    for (const e of enemies) {
      const pos = e.mesh.position;
      const dir = new THREE.Vector3().subVectors(playerPos, pos).setY(0);
      const dist = dir.length();
      const moving = dist > 1.2;

      if (moving) {
        dir.normalize();
        pos.x += dir.x * ENEMY_SPEED * dt;
        pos.z += dir.z * ENEMY_SPEED * dt;
        e.mesh.lookAt(playerPos.x, pos.y, playerPos.z);
      }

      e.bobPhase += dt * (moving ? 12 : 3);
      e.walkPhase += dt * (moving ? 14 : 2);
      const bob = Math.sin(e.bobPhase) * (moving ? 0.04 : 0.015);
      e.body.position.y = 1.35 + bob;

      const legOff = Math.sin(e.walkPhase) * 0.12;
      e.legL.position.x = -0.22 - legOff;
      e.legR.position.x = 0.22 + legOff;

      e.attackCooldown -= dt;
      if (dist < 2.5 && e.attackCooldown <= 0) {
        e.attackCooldown = 0.9;
        onPlayerHit(ENEMY_DAMAGE);
      }
    }
  }

  function findEnemyFromMesh(mesh) {
    let obj = mesh;
    while (obj) {
      const hit = enemies.find((en) => en.mesh === obj);
      if (hit) return hit;
      if (enemies.some((en) => en.hitMeshes.includes(obj))) {
        return enemies.find((en) => en.hitMeshes.includes(obj));
      }
      obj = obj.parent;
    }
    return null;
  }

  function damageAtMesh(mesh, damage) {
    const enemy = findEnemyFromMesh(mesh);
    if (!enemy) return null;

    enemy.health -= damage;
    enemy.hitMeshes.forEach((m) => {
      if (m.material?.color) m.material.color.offsetHSL(0, 0, 0.12);
    });

    if (enemy.health <= 0) {
      const killed = { name: enemy.name };
      scene.remove(enemy.mesh);
      const idx = enemies.indexOf(enemy);
      if (idx >= 0) enemies.splice(idx, 1);
      return killed;
    }
    return { wounded: true, name: enemy.name };
  }

  function getAllHitMeshes() {
    return enemies.flatMap((e) => e.hitMeshes);
  }

  function clear() {
    enemies.forEach((e) => scene.remove(e.mesh));
    enemies.length = 0;
    spawnTimer = 0;
    nameIdx = 0;
  }

  function reset() {
    clear();
    for (let i = 0; i < 6; i++) spawnEnemy();
  }

  reset();
  return {
    update,
    damageAtMesh,
    getAllHitMeshes,
    reset,
    clear,
    get count() { return enemies.length; },
  };
}
