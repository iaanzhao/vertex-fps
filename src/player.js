import * as THREE from 'three';

const WALK_SPEED = 14;
const SPRINT_SPEED = 22;
const JUMP_FORCE = 10;
const GRAVITY = 24;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.35;

export function createPlayer(camera, colliders, spawnPoints) {
  const velocity = new THREE.Vector3();
  let onGround = false;
  const position = new THREE.Vector3(0, PLAYER_HEIGHT, 0);

  const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };

  function handleKey(e, down) {
    const map = {
      KeyW: 'w', KeyS: 's', KeyA: 'a', KeyD: 'd',
      ArrowUp: 'w', ArrowDown: 's', ArrowLeft: 'a', ArrowRight: 'd',
      Space: 'space', ShiftLeft: 'shift', ShiftRight: 'shift',
    };
    const k = map[e.code];
    if (k) keys[k] = down;
  }

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
      e.preventDefault();
    }
    handleKey(e, true);
  });
  window.addEventListener('keyup', (e) => handleKey(e, false));

  function collidesAABB(pos, { skipFloor = false } = {}) {
    const min = new THREE.Vector3(
      pos.x - PLAYER_RADIUS,
      pos.y - PLAYER_HEIGHT,
      pos.z - PLAYER_RADIUS
    );
    const max = new THREE.Vector3(
      pos.x + PLAYER_RADIUS,
      pos.y + 0.2,
      pos.z + PLAYER_RADIUS
    );

    for (const box of colliders) {
      if (skipFloor && box.isFloor) continue;
      if (
        min.x < box.max.x && max.x > box.min.x &&
        min.y < box.max.y && max.y > box.min.y &&
        min.z < box.max.z && max.z > box.min.z
      ) {
        return true;
      }
    }
    return false;
  }

  function resolveCollision(newPos) {
    const result = newPos.clone();

    if (collidesAABB(new THREE.Vector3(result.x, position.y, position.z), { skipFloor: true })) {
      result.x = position.x;
    }
    if (collidesAABB(new THREE.Vector3(position.x, result.y, position.z))) {
      if (result.y < position.y) onGround = true;
      result.y = position.y;
      velocity.y = 0;
    }
    if (collidesAABB(new THREE.Vector3(position.x, position.y, result.z), { skipFloor: true })) {
      result.z = position.z;
    }
    return result;
  }

  function update(dt, yaw) {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const speed = keys.shift ? SPRINT_SPEED : WALK_SPEED;

    const move = new THREE.Vector3();
    if (keys.w) move.add(forward);
    if (keys.s) move.sub(forward);
    if (keys.a) move.sub(right);
    if (keys.d) move.add(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);

    velocity.x = move.x;
    velocity.z = move.z;

    if (keys.space && onGround) {
      velocity.y = JUMP_FORCE;
      onGround = false;
    }

    velocity.y -= GRAVITY * dt;

    const newPos = position.clone();
    newPos.add(new THREE.Vector3(velocity.x, velocity.y * dt, velocity.z));

    onGround = false;
    position.copy(resolveCollision(newPos));

    if (position.y < PLAYER_HEIGHT) {
      position.y = PLAYER_HEIGHT;
      velocity.y = 0;
      onGround = true;
    }

    camera.position.copy(position);
  }

  function getPosition() {
    return position.clone();
  }

  function respawn() {
    const sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    position.set(sp[0], sp[1], sp[2]);
    velocity.set(0, 0, 0);
    onGround = true;
    camera.position.copy(position);
  }

  function reset() {
    position.set(0, PLAYER_HEIGHT, 0);
    velocity.set(0, 0, 0);
    onGround = true;
    camera.position.copy(position);
  }

  return { update, getPosition, reset, respawn, get sprinting() { return keys.shift; } };
}
