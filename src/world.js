import * as THREE from 'three';
import { box, createTree, mat, mesh, rock, spawnDebrisBurst } from './lowpoly.js';

const C = {
  grass: 0x7cb342,
  grassDark: 0x689f38,
  dirt: 0x8d6e63,
  sand: 0xd7ccc8,
  stone: 0x90a4ae,
  stoneDark: 0x607d8b,
  concrete: 0xb0bec5,
  concreteDark: 0x78909c,
  crate: 0xff8f00,
  crateDark: 0xe65100,
  bunker: 0x546e7a,
  bunkerLight: 0x78909c,
  ramp: 0x9e9e9e,
};

function addSolid(scene, colliders, x, y, z, w, h, d, color) {
  const m = box(w, h, d, color, x, y + h / 2, z);
  scene.add(m);
  const col = {
    min: new THREE.Vector3(x - w / 2, y, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h, z + d / 2),
  };
  colliders.push(col);
  return { mesh: m, collider: col };
}

function addDestructible(scene, colliders, destructibles, x, y, z, w, h, d, color, hp = 4) {
  const entry = addSolid(scene, colliders, x, y, z, w, h, d, color);
  entry.mesh.userData.destructible = true;
  destructibles.push({ ...entry, health: hp, maxHealth: hp });
  return entry;
}

function scatterTrees(scene, count, radius) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * 0.55 + Math.random() * radius * 0.4;
    createTree(Math.cos(angle) * dist, Math.sin(angle) * dist, scene);
  }
}

function scatterRocks(scene, colliders, count) {
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 50;
    const z = (Math.random() - 0.5) * 50;
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    const size = 0.6 + Math.random() * 1.2;
    const color = Math.random() > 0.5 ? C.stone : C.stoneDark;
    const r = rock(size, color, x, size * 0.4, z, scene);
    const pad = size * 0.6;
    colliders.push({
      min: new THREE.Vector3(x - pad, 0, z - pad),
      max: new THREE.Vector3(x + pad, size * 0.9, z + pad),
    });
    r.userData.rock = true;
  }
}

export function buildWorld(scene) {
  const colliders = [];
  const destructibles = [];
  const size = 72;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 12, 12),
    mat(C.grass),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const pos = ground.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const bump = Math.sin(x * 0.15) * Math.cos(z * 0.12) * 0.35;
    pos.setY(i, bump);
  }
  pos.needsUpdate = true;
  ground.geometry.computeVertexNormals();

  colliders.push({
    min: new THREE.Vector3(-size / 2, -0.1, -size / 2),
    max: new THREE.Vector3(size / 2, 0.5, size / 2),
    isFloor: true,
  });

  const wall = (x, z, w, d) => addSolid(scene, colliders, x, 0, z, w, 3.5, d, C.concreteDark);

  wall(0, -34, 68, 2.5);
  wall(0, 34, 68, 2.5);
  wall(-34, 0, 2.5, 64);
  wall(34, 0, 2.5, 64);

  addSolid(scene, colliders, 0, 0, 0, 10, 2.5, 10, C.bunker);
  addSolid(scene, colliders, 0, 2.5, 0, 6, 1.8, 6, C.bunkerLight);

  const rampGeo = new THREE.BoxGeometry(6, 0.4, 3);
  const ramp = mesh(rampGeo, C.ramp, 0, 0.2, 7);
  ramp.rotation.x = -0.35;
  scene.add(ramp);
  colliders.push({
    min: new THREE.Vector3(-3, 0, 5.5),
    max: new THREE.Vector3(3, 1.2, 9.5),
  });

  const covers = [
    [-16, -10, 5, 2, 4, C.bunker],
    [14, 12, 4, 2.5, 3, C.bunkerLight],
    [-8, 18, 6, 2, 2, C.concrete],
    [20, -8, 3, 3, 5, C.concreteDark],
    [-22, 6, 4, 2, 6, C.stone],
    [8, -20, 7, 2, 2, C.stoneDark],
  ];
  covers.forEach(([x, z, w, h, d, color]) => {
    addSolid(scene, colliders, x, 0, z, w, h, d, color);
  });

  const crates = [
    [-10, -5], [10, -8], [6, 14], [-14, 8], [0, -22], [18, -4], [-18, -16],
  ];
  crates.forEach(([x, z]) => {
    addDestructible(scene, colliders, destructibles, x, 0, z, 1.6, 1.6, 1.6, C.crate, 5);
    addDestructible(scene, colliders, destructibles, x, 1.6, z, 1.6, 1.6, 1.6, C.crateDark, 4);
  });

  addDestructible(scene, colliders, destructibles, -5, 0, -24, 7, 2.2, 2, C.crate, 6);
  addDestructible(scene, colliders, destructibles, 14, 0, -16, 2, 4, 7, C.crateDark, 8);

  scatterTrees(scene, 28, 32);
  scatterRocks(scene, colliders, 18);

  const debris = [];

  function destroyBlock(entry) {
    scene.remove(entry.mesh);
    const i = colliders.indexOf(entry.collider);
    if (i >= 0) colliders.splice(i, 1);
    const di = destructibles.indexOf(entry);
    if (di >= 0) destructibles.splice(di, 1);
    debris.push(...spawnDebrisBurst(scene, entry.mesh.position, entry.mesh.material.color));
  }

  function updateDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.vel.y -= 18 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.life -= dt;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        debris.splice(i, 1);
      }
    }
  }

  function damageDestructible(hitMesh, damage) {
    const entry = destructibles.find((d) => d.mesh === hitMesh);
    if (!entry) return false;
    entry.health -= damage;
    entry.mesh.material.color.offsetHSL(0, 0, 0.08);
    if (entry.health <= 0) {
      destroyBlock(entry);
      return true;
    }
    return false;
  }

  return {
    colliders,
    destructibles,
    damageDestructible,
    getDestructibleMeshes: () => destructibles.map((d) => d.mesh),
    updateDebris,
    spawnPoints: [
      [0, 1.7, 28], [-28, 1.7, 0], [28, 1.7, 0], [0, 1.7, -28],
      [-20, 1.7, -20], [20, 1.7, 20],
    ],
  };
}

export function setupLighting(scene) {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 45, 95);

  scene.add(new THREE.HemisphereLight(0xb3e5fc, 0x558b2f, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const sun = new THREE.DirectionalLight(0xfff3e0, 1.1);
  sun.position.set(35, 55, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  scene.add(sun);
}
