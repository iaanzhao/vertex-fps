import * as THREE from 'three';

export function mat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export function mesh(geometry, color, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function box(w, h, d, color, x, y, z, parent) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
}

export function cone(r, h, color, x, y, z, parent, segments = 6) {
  const m = mesh(new THREE.ConeGeometry(r, h, segments), color, x, y, z, parent);
  return m;
}

export function cylinder(rTop, rBot, h, color, x, y, z, parent, segments = 6) {
  return mesh(new THREE.CylinderGeometry(rTop, rBot, h, segments), color, x, y, z, parent);
}

export function rock(size, color, x, y, z, parent) {
  const m = mesh(new THREE.IcosahedronGeometry(size, 0), color, x, y, z, parent);
  m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  m.scale.set(
    0.8 + Math.random() * 0.4,
    0.7 + Math.random() * 0.5,
    0.8 + Math.random() * 0.4,
  );
  return m;
}

export function createTree(x, z, parent) {
  const g = new THREE.Group();
  cylinder(0.25, 0.35, 2.2, 0x5d4037, 0, 1.1, 0, g, 5);
  cone(1.6, 2.8, 0x2e7d32, 0, 3.2, 0, g, 7);
  cone(1.2, 2.2, 0x43a047, 0, 4.6, 0, g, 7);
  g.position.set(x, 0, z);
  const rot = Math.random() * Math.PI * 2;
  g.rotation.y = rot;
  if (parent) parent.add(g);
  return g;
}

export function createLowPolyCharacter(skin, teamColor) {
  const group = new THREE.Group();
  const hitMeshes = [];

  const add = (w, h, d, color, x, y, z) => {
    const m = box(w, h, d, color, x, y, z, group);
    hitMeshes.push(m);
    return m;
  };

  const legL = add(0.35, 0.9, 0.35, skin.pants, -0.22, 0.45, 0);
  const legR = add(0.35, 0.9, 0.35, skin.pants, 0.22, 0.45, 0);
  const body = add(0.7, 0.85, 0.45, teamColor, 0, 1.35, 0);
  add(0.22, 0.75, 0.22, skin.shirt, -0.48, 1.35, 0);
  const armR = add(0.22, 0.75, 0.22, skin.shirt, 0.48, 1.35, 0);
  const head = add(0.55, 0.55, 0.55, skin.face, 0, 2.05, 0);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.14, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x111111 }),
  );
  visor.position.set(0, 2.05, 0.28);
  group.add(visor);

  box(0.12, 0.12, 0.55, 0x37474f, 0.55, 1.2, 0.25, group);

  return { group, body, head, hitMeshes, legL, legR, armR };
}

export const SKINS = [
  { face: 0xffcc80, shirt: 0x78909c, pants: 0x37474f },
  { face: 0xffab91, shirt: 0x66bb6a, pants: 0x3e2723 },
  { face: 0xd7ccc8, shirt: 0xef5350, pants: 0x263238 },
  { face: 0xffe0b2, shirt: 0xffca28, pants: 0x455a64 },
  { face: 0xbcaaa4, shirt: 0xab47bc, pants: 0x212121 },
];

export function randomSkin() {
  return SKINS[Math.floor(Math.random() * SKINS.length)];
}

export function spawnDebrisBurst(scene, pos, color, count = 6) {
  const hex = color?.getHex ? color.getHex() : color;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const size = 0.12 + Math.random() * 0.18;
    const part = mesh(new THREE.TetrahedronGeometry(size, 0), hex, pos.x, pos.y, pos.z);
    scene.add(part);
    parts.push({
      mesh: part,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 8,
      ),
      life: 0.4 + Math.random() * 0.3,
    });
  }
  return parts;
}
