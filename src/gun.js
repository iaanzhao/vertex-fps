import * as THREE from 'three';
import { box, cylinder, mat } from './lowpoly.js';

const C = {
  black: 0x1a1a1a,
  dark: 0x2d2d2d,
  metal: 0x607d8b,
  metalLight: 0x90a4ae,
  wood: 0x5d4037,
  grip: 0x4e342e,
  orange: 0xff6d00,
  yellow: 0xffca28,
  green: 0x00e676,
  scope: 0x37474f,
  lens: 0x4fc3f7,
};

function buildRifle(g) {
  const parts = {};
  box(0.08, 0.1, 0.55, C.wood, 0, 0.02, -0.3, g);
  parts.receiver = box(0.1, 0.12, 0.42, C.metal, 0, 0.04, -0.22, g);
  parts.bolt = box(0.04, 0.04, 0.1, C.metalLight, 0.06, 0.08, -0.14, g);
  box(0.06, 0.06, 0.38, C.dark, 0, 0.04, -0.58, g);
  cylinder(0.035, 0.035, 0.5, C.black, 0, 0.04, -0.88, g, 6);
  box(0.08, 0.22, 0.1, C.grip, 0, -0.14, -0.04, g);
  box(0.1, 0.04, 0.14, C.wood, 0, -0.26, -0.06, g);
  box(0.08, 0.12, 0.22, C.wood, 0, 0.04, 0.18, g);
  box(0.03, 0.05, 0.12, C.orange, -0.06, 0.04, -0.16, g);
  return { muzzleZ: -1.12, parts };
}

function buildSmg(g) {
  const parts = {};
  parts.receiver = box(0.12, 0.14, 0.32, C.dark, 0, 0.04, -0.18, g);
  parts.bolt = box(0.03, 0.03, 0.08, C.metalLight, 0.06, 0.08, -0.12, g);
  box(0.08, 0.08, 0.36, C.metalLight, 0, 0.04, -0.5, g);
  box(0.1, 0.18, 0.08, C.dark, 0, -0.1, -0.02, g);
  box(0.06, 0.1, 0.08, C.grip, 0, -0.06, 0.1, g);
  box(0.08, 0.06, 0.16, C.metal, 0, 0.06, 0.14, g);
  box(0.03, 0.06, 0.06, C.orange, -0.05, 0.02, -0.08, g);
  return { muzzleZ: -0.72, parts };
}

function buildSniper(g) {
  const parts = {};
  parts.receiver = box(0.1, 0.1, 0.48, C.metal, 0, 0.04, -0.3, g);
  parts.bolt = box(0.04, 0.03, 0.1, C.metalLight, 0.05, 0.07, -0.1, g);
  cylinder(0.03, 0.03, 0.72, C.dark, 0, 0.05, -0.82, g, 6);
  box(0.08, 0.14, 0.1, C.grip, 0, -0.1, -0.04, g);
  box(0.14, 0.08, 0.28, C.dark, 0, 0.06, 0.2, g);
  box(0.12, 0.1, 0.28, C.scope, 0, 0.2, -0.42, g);
  box(0.08, 0.06, 0.06, C.lens, 0, 0.2, -0.58, g);
  box(0.03, 0.08, 0.1, C.metal, -0.05, -0.05, -0.5, g);
  box(0.03, 0.08, 0.1, C.metal, 0.05, -0.05, -0.5, g);
  return { muzzleZ: -1.18, parts };
}

const WEAPONS = {
  rifle: {
    name: 'AR-15',
    damage: 28,
    fireRate: 0.1,
    recoil: 0.05,
    adsFov: 52,
    range: 120,
    build: buildRifle,
  },
  smg: {
    name: 'VECTOR',
    damage: 14,
    fireRate: 0.055,
    recoil: 0.03,
    adsFov: 58,
    range: 80,
    build: buildSmg,
  },
  sniper: {
    name: 'HAWK',
    damage: 95,
    fireRate: 0.85,
    recoil: 0.12,
    adsFov: 28,
    range: 200,
    build: buildSniper,
  },
};

export function createGun(camera) {
  const root = new THREE.Group();
  root.position.set(0.28, -0.3, -0.32);
  camera.add(root);

  const muzzleFlash = new THREE.PointLight(0xffaa00, 5, 6);
  muzzleFlash.visible = false;
  root.add(muzzleFlash);

  const flashMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.08, 0),
    new THREE.MeshBasicMaterial({ color: 0xffff88 }),
  );
  flashMesh.visible = false;
  root.add(flashMesh);

  const shellEject = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.04, 4),
    mat(0xffd54f),
  );
  shellEject.visible = false;
  root.add(shellEject);

  let currentId = 'rifle';
  let weaponGroup = new THREE.Group();
  root.add(weaponGroup);
  let muzzleZ = -1.12;
  let aimFactor = 0;
  let aimTarget = 0;
  let recoilZ = 0;
  let recoilKick = 0;
  let fireCooldown = 0;
  let boltMesh = null;
  let boltRestX = 0.06;

  const hipPos = { x: 0.28, y: -0.3, z: -0.32 };
  const adsPos = { x: 0.04, y: -0.16, z: -0.15 };

  function rebuildWeapon(id) {
    while (weaponGroup.children.length) weaponGroup.remove(weaponGroup.children[0]);
    weaponGroup = new THREE.Group();
    root.add(weaponGroup);
    const built = WEAPONS[id].build(weaponGroup);
    muzzleZ = built.muzzleZ;
    boltMesh = built.parts.bolt ?? null;
    boltRestX = boltMesh?.position.x ?? 0.06;
    currentId = id;
  }

  rebuildWeapon('rifle');

  function setWeapon(id) {
    if (!WEAPONS[id] || id === currentId) return;
    rebuildWeapon(id);
    document.querySelectorAll('.weapon-slot').forEach((el) => {
      el.classList.toggle('active', el.dataset.weapon === id);
    });
    const nameEl = document.getElementById('weapon-name');
    if (nameEl) nameEl.textContent = WEAPONS[id].name;
  }

  function getWeapon() {
    return WEAPONS[currentId];
  }

  function canShoot() {
    return fireCooldown <= 0;
  }

  function shoot() {
    const w = getWeapon();
    fireCooldown = w.fireRate;
    muzzleFlash.visible = true;
    flashMesh.visible = true;
    flashMesh.position.set(0, 0.03, muzzleZ);
    muzzleFlash.position.set(0, 0.03, muzzleZ);
    recoilKick = aimFactor > 0.5 ? w.recoil * 0.5 : w.recoil;

    if (boltMesh) {
      boltMesh.position.x = boltRestX + 0.04;
      setTimeout(() => {
        if (boltMesh) boltMesh.position.x = boltRestX;
      }, 80);
    }

    shellEject.position.set(0.1, 0.05, -0.18);
    shellEject.visible = currentId !== 'sniper';
    setTimeout(() => { shellEject.visible = false; }, 60);

    setTimeout(() => {
      muzzleFlash.visible = false;
      flashMesh.visible = false;
    }, 50);
    return w;
  }

  function setAiming(aiming) {
    aimTarget = aiming ? 1 : 0;
  }

  function update(dt, time) {
    fireCooldown = Math.max(0, fireCooldown - dt);
    aimFactor += (aimTarget - aimFactor) * Math.min(1, dt * 16);
    recoilKick *= 0.8;
    recoilZ += (recoilKick - recoilZ) * 0.4;

    const swayScale = 1 - aimFactor * 0.9;
    const sway = Math.sin(time * 2) * 0.01 * swayScale;
    const bob = Math.sin(time * 10) * 0.015 * swayScale;

    root.position.set(
      hipPos.x + (adsPos.x - hipPos.x) * aimFactor + sway,
      hipPos.y + (adsPos.y - hipPos.y) * aimFactor + bob,
      hipPos.z + (adsPos.z - hipPos.z) * aimFactor + recoilZ,
    );
    root.rotation.x = -recoilZ * 3;
    weaponGroup.position.y = Math.sin(time * 12) * 0.003 * swayScale;
  }

  return {
    group: root,
    get aimFactor() { return aimFactor; },
    get adsFov() { return getWeapon().adsFov; },
    setWeapon,
    getWeapon,
    canShoot,
    shoot,
    setAiming,
    update,
    muzzleWorldPosition: () => {
      const v = new THREE.Vector3(0, 0.03, muzzleZ);
      root.localToWorld(v);
      return v;
    },
    weaponIds: Object.keys(WEAPONS),
  };
}
