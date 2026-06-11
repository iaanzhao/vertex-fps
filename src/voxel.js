import * as THREE from 'three';

export function voxelMaterial(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export function voxelBox(w, h, d, color, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), voxelMaterial(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (parent) parent.add(mesh);
  return mesh;
}

/** Minecraft-style block character (~1.8 units tall). */
export function createVoxelCharacter(skin, teamColor) {
  const group = new THREE.Group();
  const hitMeshes = [];
  const s = 0.42;

  const add = (w, h, d, color, x, y, z) => {
    const m = voxelBox(w, h, d, color, x, y, z, group);
    hitMeshes.push(m);
    return m;
  };

  const legL = add(s, s * 1.8, s, skin.pants, -s * 0.55, s * 0.9, 0);
  const legR = add(s, s * 1.8, s, skin.pants, s * 0.55, s * 0.9, 0);
  const body = add(s * 1.8, s * 2.2, s * 0.9, teamColor, 0, s * 2.5, 0);
  const armL = add(s * 0.7, s * 2, s * 0.7, skin.shirt, -s * 1.35, s * 2.5, 0);
  const armR = add(s * 0.7, s * 2, s * 0.7, skin.shirt, s * 1.35, s * 2.5, 0);
  const head = add(s * 1.6, s * 1.6, s * 1.6, skin.face, 0, s * 4.1, 0);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(s * 1.2, s * 0.35, s * 0.15),
    new THREE.MeshBasicMaterial({ color: 0x111111 })
  );
  visor.position.set(0, s * 4.05, s * 0.82);
  group.add(visor);

  voxelBox(s * 0.5, s * 0.5, s * 1.2, 0x333333, s * 1.1, s * 2.3, s * 0.5, group);

  return { group, body, head, hitMeshes };
}

export const SKINS = [
  { face: 0xffcc80, shirt: 0x42a5f5, pants: 0x37474f },
  { face: 0xffab91, shirt: 0x66bb6a, pants: 0x3e2723 },
  { face: 0xd7ccc8, shirt: 0xef5350, pants: 0x263238 },
  { face: 0xffe0b2, shirt: 0xffca28, pants: 0x455a64 },
  { face: 0xbcaaa4, shirt: 0xab47bc, pants: 0x212121 },
];

export function randomSkin() {
  return SKINS[Math.floor(Math.random() * SKINS.length)];
}
