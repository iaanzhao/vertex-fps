import * as THREE from 'three';
import { buildWorld, setupLighting } from './world.js';
import { createPlayer } from './player.js';
import { createEnemySystem } from './enemies.js';
import { createGun } from './gun.js';
import { mat } from './lowpoly.js';

const menu = document.getElementById('menu');
const pauseMenu = document.getElementById('pause-menu');
const gameOverEl = document.getElementById('game-over');
const playBtn = document.getElementById('play-btn');
const resumeBtn = document.getElementById('resume-btn');
const exitBtn = document.getElementById('exit-btn');
const restartBtn = document.getElementById('restart-btn');
const healthFill = document.getElementById('health-fill');
const healthNum = document.getElementById('health-num');
const killsEl = document.getElementById('kills');
const botKillsEl = document.getElementById('bot-kills');
const kdVal = document.getElementById('kd-val');
const timerEl = document.getElementById('timer');
const killFeed = document.getElementById('kill-feed');
const pauseKd = document.getElementById('pause-kd');
const pauseTime = document.getElementById('pause-time');
const finalKd = document.getElementById('final-kd');
const resultText = document.getElementById('result-text');
const hitMarker = document.getElementById('hit-marker');
const crosshair = document.getElementById('crosshair');
const respawnOverlay = document.getElementById('respawn-overlay');

const HIP_FOV = 80;
const MOUSE_SENS = 0.0022;
const ADS_SENS = 0.001;
const MATCH_TIME = 180;
const KILL_LIMIT = 20;
const RESPAWN_TIME = 2.5;

let playing = false;
let paused = false;
let aiming = false;
let firing = false;
let health = 100;
let kills = 0;
let deaths = 0;
let botKills = 0;
let matchTime = MATCH_TIME;
let yaw = 0;
let pitch = 0;
let currentFov = HIP_FOV;
let hadPointerLock = false;
let respawnTimer = 0;
let isDead = false;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
setupLighting(scene);
const world = buildWorld(scene);
const { colliders, damageDestructible, getDestructibleMeshes, updateDebris, spawnPoints } = world;

const camera = new THREE.PerspectiveCamera(
  HIP_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  150
);
camera.position.set(0, 1.7, 0);

const player = createPlayer(camera, colliders, spawnPoints);
const enemies = createEnemySystem(scene, () => player.getPosition());
const gun = createGun(camera);
scene.add(camera);

const raycaster = new THREE.Raycaster();
const bullets = [];
const blockParticles = [];

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateHUD() {
  healthFill.style.width = `${Math.max(0, health)}%`;
  healthNum.textContent = Math.max(0, Math.ceil(health));
  killsEl.textContent = kills;
  botKillsEl.textContent = botKills;
  kdVal.textContent = `${kills}/${deaths}`;
  timerEl.textContent = formatTime(matchTime);
}

function addKillFeed(text, headshot = false) {
  const el = document.createElement('div');
  el.className = 'kill-entry' + (headshot ? ' headshot' : '');
  el.textContent = text;
  killFeed.prepend(el);
  while (killFeed.children.length > 6) killFeed.lastChild.remove();
  setTimeout(() => el.remove(), 4000);
}

function setAiming(active) {
  aiming = active;
  gun.setAiming(active);
  crosshair.classList.toggle('aiming', active);
}

function isGameplayActive() {
  return playing && !paused && !isDead;
}

function spawnHitBurst(pos, color) {
  for (let i = 0; i < 5; i++) {
    const shard = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.08 + Math.random() * 0.06, 0),
      mat(color),
    );
    shard.position.copy(pos);
    scene.add(shard);
    blockParticles.push({
      mesh: shard,
      vel: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6),
      life: 0.35,
    });
  }
}

function tryShoot() {
  if (!isGameplayActive() || !gun.canShoot()) return;

  const weapon = gun.shoot();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const allMeshes = [...getDestructibleMeshes(), ...enemies.getAllHitMeshes()];
  const hits = raycaster.intersectObjects(allMeshes, false);

  let didHit = false;
  if (hits.length > 0) {
    const hit = hits[0];
    const isBlock = hit.object.userData.destructible;

    if (isBlock) {
      damageDestructible(hit.object, weapon.damage);
      spawnHitBurst(hit.point, 0xff6d00);
      didHit = true;
    } else {
      const result = enemies.damageAtMesh(hit.object, weapon.damage);
      if (result?.name && !result.wounded) {
        kills++;
        addKillFeed(`You eliminated ${result.name}`, weapon.damage >= 50);
        if (kills >= KILL_LIMIT) endMatch(true);
      }
      didHit = !!result;
    }

    if (didHit) {
      hitMarker.classList.add('show');
      setTimeout(() => hitMarker.classList.remove('show'), 90);
      updateHUD();
    }
  }

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const bullet = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.05, 0),
    new THREE.MeshBasicMaterial({ color: 0xffeb3b }),
  );
  bullet.position.copy(gun.muzzleWorldPosition());
  scene.add(bullet);
  bullets.push({ mesh: bullet, dir, life: 0.1, speed: weapon.range > 150 ? 140 : 100 });
}

function damagePlayer(amount) {
  if (!isGameplayActive()) return;
  health -= amount;
  updateHUD();
  document.body.style.boxShadow = 'inset 0 0 100px rgba(229, 57, 53, 0.45)';
  setTimeout(() => { document.body.style.boxShadow = ''; }, 120);
  if (health <= 0) playerDied();
}

function playerDied() {
  isDead = true;
  deaths++;
  botKills++;
  setAiming(false);
  firing = false;
  addKillFeed('You were eliminated', false);
  updateHUD();
  respawnOverlay.classList.remove('hidden');
  respawnTimer = RESPAWN_TIME;
}

function endMatch(victory) {
  playing = false;
  paused = false;
  setAiming(false);
  document.exitPointerLock?.();
  resultText.textContent = victory ? 'VICTORY!' : 'DEFEAT';
  resultText.style.color = victory ? '#42a5f5' : '#ef5350';
  finalKd.textContent = `${kills}/${deaths}`;
  gameOverEl.classList.remove('hidden');
  pauseMenu.classList.add('hidden');
}

function exitToMenu() {
  playing = false;
  paused = false;
  isDead = false;
  hadPointerLock = false;
  setAiming(false);
  document.exitPointerLock?.();
  pauseMenu.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  respawnOverlay.classList.add('hidden');
  menu.classList.remove('hidden');
  currentFov = HIP_FOV;
  camera.fov = HIP_FOV;
  camera.updateProjectionMatrix();
}

function openPauseMenu() {
  if (!playing || !gameOverEl.classList.contains('hidden')) return;
  paused = true;
  setAiming(false);
  firing = false;
  document.exitPointerLock?.();
  pauseKd.textContent = `${kills}/${deaths}`;
  pauseTime.textContent = formatTime(matchTime);
  pauseMenu.classList.remove('hidden');
}

function closePauseMenu() {
  paused = false;
  pauseMenu.classList.add('hidden');
  if (playing && !isDead) renderer.domElement.requestPointerLock();
}

function startGame() {
  health = 100;
  kills = 0;
  deaths = 0;
  botKills = 0;
  matchTime = MATCH_TIME;
  yaw = 0;
  pitch = 0;
  playing = true;
  paused = false;
  isDead = false;
  respawnTimer = 0;
  setAiming(false);
  killFeed.innerHTML = '';
  menu.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  respawnOverlay.classList.add('hidden');
  player.reset();
  enemies.reset();
  updateHUD();
  currentFov = HIP_FOV;
  camera.fov = HIP_FOV;
  camera.updateProjectionMatrix();
  hadPointerLock = false;
  renderer.domElement.requestPointerLock();
}

document.addEventListener('mousemove', (e) => {
  if (!isGameplayActive() || document.pointerLockElement !== renderer.domElement) return;
  const sens = aiming ? ADS_SENS : MOUSE_SENS;
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
});

document.addEventListener('mousedown', (e) => {
  if (!playing || paused || isDead) return;
  if (e.button === 0 && isGameplayActive() && document.pointerLockElement === renderer.domElement) {
    firing = true;
    tryShoot();
  }
  if (e.button === 2 && isGameplayActive() && document.pointerLockElement === renderer.domElement) {
    setAiming(true);
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.button === 0) firing = false;
  if (e.button === 2) setAiming(false);
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (playing && !paused) openPauseMenu();
    else if (playing && paused) closePauseMenu();
    return;
  }
  if (!isGameplayActive()) return;
  if (e.code === 'Digit1') gun.setWeapon('rifle');
  if (e.code === 'Digit2') gun.setWeapon('smg');
  if (e.code === 'Digit3') gun.setWeapon('sniper');
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer.domElement) {
    hadPointerLock = true;
    return;
  }
  if (playing && !paused && hadPointerLock && gameOverEl.classList.contains('hidden')) {
    openPauseMenu();
  }
});

playBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
resumeBtn.addEventListener('click', closePauseMenu);
exitBtn.addEventListener('click', exitToMenu);

document.querySelectorAll('.weapon-slot').forEach((el) => {
  el.addEventListener('click', () => {
    if (playing) gun.setWeapon(el.dataset.weapon);
  });
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (playing && !paused) {
    if (isDead) {
      respawnTimer -= dt;
      respawnOverlay.textContent = `RESPAWNING ${Math.ceil(respawnTimer)}`;
      if (respawnTimer <= 0) {
        isDead = false;
        health = 100;
        respawnOverlay.classList.add('hidden');
        player.respawn();
        updateHUD();
      }
    } else {
      matchTime -= dt;
      if (matchTime <= 0) {
        matchTime = 0;
        endMatch(kills >= botKills);
        updateHUD();
      }

      if (firing && isGameplayActive()) tryShoot();

      const targetFov = aiming ? gun.adsFov : HIP_FOV;
      currentFov += (targetFov - currentFov) * Math.min(1, dt * 14);
      camera.fov = currentFov;
      camera.updateProjectionMatrix();

      camera.rotation.order = 'YXZ';
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      player.update(dt, yaw);
      enemies.update(dt, damagePlayer);
      updateDebris(dt);

      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.addScaledVector(b.dir, b.speed * dt);
        b.life -= dt;
        if (b.life <= 0) {
          scene.remove(b.mesh);
          bullets.splice(i, 1);
        }
      }

      for (let i = blockParticles.length - 1; i >= 0; i--) {
        const p = blockParticles[i];
        p.vel.y -= 15 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.life -= dt;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          blockParticles.splice(i, 1);
        }
      }

      gun.update(dt, clock.elapsedTime);
      updateHUD();
    }
  } else if (playing && paused) {
    gun.update(dt, clock.elapsedTime);
    currentFov += (HIP_FOV - currentFov) * Math.min(1, dt * 12);
    camera.fov = currentFov;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
