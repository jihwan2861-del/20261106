/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ARENA_BRIDGES,
  ARENA_PLATFORMS,
  BridgeDef,
  DEFAULT_PHYSICS_CONFIG,
  GamePhysicsConfig,
  JumpPadDef,
  ObstacleDef,
  PlatformDef,
  SpeedZoneDef,
} from './config';

export interface SlingshotVector {
  /** Normalized launch direction X in world XZ plane */
  dirX: number;
  /** Normalized launch direction Z in world XZ plane */
  dirZ: number;
  /** Power ratio in [0, 1] */
  powerRatio: number;
  /** Launch speed in world units/sec */
  launchSpeed: number;
  /** Whether the pull distance exceeds minPullPixels */
  isValid: boolean;
}

/**
 * Computes the slingshot launch vector from screen-space drag start and current coordinates.
 * Pulling back (+dy downward on screen) launches forward (-Z in world).
 */
export function computeSlingshotLaunch(
  dragStartX: number,
  dragStartY: number,
  dragCurrentX: number,
  dragCurrentY: number,
  config: GamePhysicsConfig = DEFAULT_PHYSICS_CONFIG
): SlingshotVector {
  const pullX = dragCurrentX - dragStartX;
  const pullY = dragCurrentY - dragStartY;
  const pullDist = Math.hypot(pullX, pullY);

  if (pullDist < config.minPullPixels) {
    return { dirX: 0, dirZ: -1, powerRatio: 0, launchSpeed: 0, isValid: false };
  }

  // Opposite of drag direction
  const dirX = -pullX / pullDist;
  const dirZ = -pullY / pullDist;

  const clampedPull = Math.min(pullDist, config.maxPullPixels);
  const powerRatio = Math.min(
    1,
    Math.max(0, (clampedPull - config.minPullPixels) / (config.maxPullPixels - config.minPullPixels))
  );

  const launchSpeed =
    config.minLaunchSpeed + powerRatio * (config.maxLaunchSpeed - config.minLaunchSpeed);

  return {
    dirX,
    dirZ,
    powerRatio,
    launchSpeed,
    isValid: true,
  };
}

/**
 * Calculates character target radius and level from current score.
 * Follows a smooth square-root growth curve with an explicit upper bound so large characters
 * feel rewarding without covering the mobile screen.
 */
export function calculateGrowthFromScore(
  score: number,
  config: GamePhysicsConfig = DEFAULT_PHYSICS_CONFIG
): {
  radius: number;
  scaleMultiplier: number;
  level: number;
  levelProgress: number;
  mass: number;
} {
  const safeScore = Math.max(0, score);
  // Smooth saturating curve: sqrt(score / (score + scale))
  const normalized = Math.sqrt(safeScore / (safeScore + config.growthScoreScale));
  const radius = config.baseRadius + normalized * (config.maxRadius - config.baseRadius);
  const scaleMultiplier = radius / config.baseRadius;

  // Level thresholds: every 300+ points
  let level = 1;
  let thresholdStart = 0;
  let step = 300;
  while (safeScore >= thresholdStart + step && level < 15) {
    thresholdStart += step;
    level += 1;
    step += 120;
  }
  const levelProgress = Math.min(1, Math.max(0, (safeScore - thresholdStart) / step));

  // Mass grows gently with radius so bigger animals push smaller ones slightly harder,
  // while still letting smaller animals knock big ones back with high speed!
  const mass = 1 + (scaleMultiplier - 1) * 0.85;

  return {
    radius,
    scaleMultiplier,
    level,
    levelProgress,
    mass,
  };
}

/**
 * Calculates points awarded for collecting a star item, applying the 2x Fever Time multiplier
 * during the final 15 seconds (`remainingSeconds <= config.feverThresholdSeconds`).
 */
export function computeStarCollectPoints(
  basePoints: number,
  remainingSeconds: number,
  config: GamePhysicsConfig = DEFAULT_PHYSICS_CONFIG
): { awardedPoints: number; isFeverTime: boolean } {
  const isFeverTime = remainingSeconds <= config.feverThresholdSeconds;
  const multiplier = isFeverTime ? config.feverScoreMultiplier : 1;
  return {
    awardedPoints: Math.round(basePoints * multiplier),
    isFeverTime,
  };
}

/**
 * Applies fall-off penalty: deducts 20% of current score (rounded to nearest 10) and returns new score.
 */
export function applyFallPenalty(
  currentScore: number,
  config: GamePhysicsConfig = DEFAULT_PHYSICS_CONFIG
): { newScore: number; lostScore: number } {
  const safeScore = Math.max(0, currentScore);
  const keptRatio = Math.max(0, Math.min(1, 1 - config.fallScorePenaltyRatio));
  const rawNew = safeScore * keptRatio;
  const newScore = Math.max(0, Math.round(rawNew / 10) * 10);
  return {
    newScore,
    lostScore: Math.max(0, safeScore - newScore),
  };
}

export interface PhysicsBodyState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  mass: number;
  isGrounded: boolean;
}

/**
 * Steps a single body's velocity and position with arcade exponential friction and gravity.
 * Guarantees that a launched character settles to a stop within ~1-2 seconds.
 */
export function stepBodyKinematics(
  body: PhysicsBodyState,
  dt: number,
  groundHeight: number | null,
  config: GamePhysicsConfig = DEFAULT_PHYSICS_CONFIG
): void {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);

  if (body.isGrounded && groundHeight !== null) {
    // Exponential friction + gentle linear stop assist at low speeds
    const damping = Math.exp(-config.groundFriction * clampedDt);
    body.vx *= damping;
    body.vz *= damping;

    const speed = Math.hypot(body.vx, body.vz);
    if (speed < config.stopSpeedThreshold) {
      body.vx = 0;
      body.vz = 0;
    } else if (speed < config.canAimSpeedThreshold * 1.4) {
      // Extra settle deceleration so tail-end sliding never drags on
      const extraDamp = Math.max(0, 1 - 2.2 * clampedDt);
      body.vx *= extraDamp;
      body.vz *= extraDamp;
      if (Math.hypot(body.vx, body.vz) < config.stopSpeedThreshold) {
        body.vx = 0;
        body.vz = 0;
      }
    }
  } else {
    // Airborne
    const airDamping = Math.exp(-config.airFriction * clampedDt);
    body.vx *= airDamping;
    body.vz *= airDamping;
    body.vy -= config.gravity * clampedDt;
  }

  body.x += body.vx * clampedDt;
  body.y += body.vy * clampedDt;
  body.z += body.vz * clampedDt;

  // Check landing on ground
  if (groundHeight !== null) {
    if (body.y <= groundHeight && body.vy <= 0) {
      body.y = groundHeight;
      body.vy = 0;
      body.isGrounded = true;
    } else if (body.y > groundHeight + 0.14) {
      body.isGrounded = false;
    } else if (body.isGrounded) {
      // Follow sloped bridge/ramp surfaces smoothly when grounded
      body.y = groundHeight;
    }
  } else {
    // Over the void outside the arena
    body.isGrounded = false;
  }
}

/**
 * Returns the floor height at (x, z), or null if (x, z) is over the abyss/water outside the multi-island arena.
 */
export function getArenaGroundHeight(
  x: number,
  z: number,
  currentY: number,
  arenaRadius: number,
  upperPlatformOrList: PlatformDef | PlatformDef[] = ARENA_PLATFORMS,
  bridges: BridgeDef[] = ARENA_BRIDGES
): number | null {
  const platforms = Array.isArray(upperPlatformOrList)
    ? upperPlatformOrList
    : [upperPlatformOrList, ...ARENA_PLATFORMS.filter((p) => p.id !== upperPlatformOrList.id)];

  // 1. Check all outer islands/platforms first
  for (const plat of platforms) {
    const distPlat = Math.hypot(x - plat.x, z - plat.z);
    if (distPlat <= plat.radius && currentY >= plat.height - 1.1) {
      return plat.height;
    }
  }

  // 2. Check connecting bridges & sloped ramps
  for (const bridge of bridges) {
    if (x >= bridge.minX && x <= bridge.maxX && z >= bridge.minZ && z <= bridge.maxZ) {
      let t = 0;
      if (bridge.slopeAxis === 'z_north') {
        t = (bridge.maxZ - z) / Math.max(0.01, bridge.maxZ - bridge.minZ);
      } else if (bridge.slopeAxis === 'z_south') {
        t = (z - bridge.minZ) / Math.max(0.01, bridge.maxZ - bridge.minZ);
      } else if (bridge.slopeAxis === 'x_west') {
        t = (bridge.maxX - x) / Math.max(0.01, bridge.maxX - bridge.minX);
      } else if (bridge.slopeAxis === 'x_east') {
        t = (x - bridge.minX) / Math.max(0.01, bridge.maxX - bridge.minX);
      }
      t = Math.min(1, Math.max(0, t));
      const bridgeY = bridge.startHeight + t * (bridge.endHeight - bridge.startHeight);
      if (currentY >= bridgeY - 1.1) {
        return bridgeY;
      }
    }
  }

  // 3. Check main central circular island
  const distMain = Math.hypot(x, z);
  if (distMain <= arenaRadius) {
    return 0;
  }

  return null;
}

/**
 * Resolves elastic arcade collision between two spherical characters in the XZ plane.
 * Returns collision intensity (0 if no collision) for triggering squash-and-stretch, hitstop, and particles.
 */
export function resolveSphereCollision(
  a: PhysicsBodyState,
  b: PhysicsBodyState,
  config: GamePhysicsConfig = DEFAULT_PHYSICS_CONFIG
): { collided: boolean; impactSpeed: number; contactX: number; contactZ: number; normalX: number; normalZ: number } {
  // Only collide if vertically overlapping
  const dy = Math.abs(a.y - b.y);
  const minDist = a.radius + b.radius;
  if (dy > minDist * 0.95) {
    return { collided: false, impactSpeed: 0, contactX: 0, contactZ: 0, normalX: 0, normalZ: 0 };
  }

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);

  if (dist >= minDist) {
    return { collided: false, impactSpeed: 0, contactX: 0, contactZ: 0, normalX: 0, normalZ: 0 };
  }

  const nx = dist > 0.0001 ? dx / dist : 1;
  const nz = dist > 0.0001 ? dz / dist : 0;

  // Separate overlapping spheres proportionally to inverse mass
  const overlap = minDist - dist;
  const invMassA = 1 / Math.max(0.1, a.mass);
  const invMassB = 1 / Math.max(0.1, b.mass);
  const totalInvMass = invMassA + invMassB;

  a.x -= nx * overlap * (invMassA / totalInvMass);
  a.z -= nz * overlap * (invMassA / totalInvMass);
  b.x += nx * overlap * (invMassB / totalInvMass);
  b.z += nz * overlap * (invMassB / totalInvMass);

  // Relative velocity along normal
  const rvx = b.vx - a.vx;
  const rvz = b.vz - a.vz;
  const velAlongNormal = rvx * nx + rvz * nz;

  const contactX = a.x + nx * a.radius;
  const contactZ = a.z + nz * a.radius;

  if (velAlongNormal > 0) {
    return {
      collided: true,
      impactSpeed: 0.5,
      contactX,
      contactZ,
      normalX: nx,
      normalZ: nz,
    };
  }

  const impactSpeed = Math.abs(velAlongNormal);
  // Speed-dependent restitution for snappy, chewy arcade bounce
  const speedFactor = Math.min(1.35, 1.0 + (impactSpeed / config.maxLaunchSpeed) * 0.35);
  const e = config.characterRestitution * config.collisionBoostMultiplier * speedFactor;

  const j = Math.max(4.5, (-(1 + e) * velAlongNormal) / totalInvMass);

  const impulseX = j * nx;
  const impulseZ = j * nz;

  a.vx -= impulseX * invMassA;
  a.vz -= impulseZ * invMassA;
  b.vx += impulseX * invMassB;
  b.vz += impulseZ * invMassB;

  // Clamp post-collision velocity so characters don't fly off into infinity
  const maxPostSpeed = config.maxLaunchSpeed * 1.25;
  const speedA = Math.hypot(a.vx, a.vz);
  if (speedA > maxPostSpeed) {
    a.vx = (a.vx / speedA) * maxPostSpeed;
    a.vz = (a.vz / speedA) * maxPostSpeed;
  }
  const speedB = Math.hypot(b.vx, b.vz);
  if (speedB > maxPostSpeed) {
    b.vx = (b.vx / speedB) * maxPostSpeed;
    b.vz = (b.vz / speedB) * maxPostSpeed;
  }

  return {
    collided: true,
    impactSpeed,
    contactX,
    contactZ,
    normalX: nx,
    normalZ: nz,
  };
}

/**
 * Resolves reflection off a cylindrical obstacle (ruin pillar, bouncy mushroom bumper, or crystal spire).
 */
export function resolveObstacleCollision(
  body: PhysicsBodyState,
  obstacle: ObstacleDef,
  config: GamePhysicsConfig = DEFAULT_PHYSICS_CONFIG
): { collided: boolean; impactSpeed: number; normalX: number; normalZ: number; isBumper: boolean } {
  const baseY = obstacle.baseY ?? 0;
  if (body.y > baseY + obstacle.height + 0.35 || body.y + body.radius * 1.5 < baseY) {
    return { collided: false, impactSpeed: 0, normalX: 0, normalZ: 0, isBumper: false };
  }

  const dx = body.x - obstacle.x;
  const dz = body.z - obstacle.z;
  const dist = Math.hypot(dx, dz);
  const minDist = body.radius + obstacle.radius;

  if (dist >= minDist) {
    return { collided: false, impactSpeed: 0, normalX: 0, normalZ: 0, isBumper: false };
  }

  const nx = dist > 0.0001 ? dx / dist : 0;
  const nz = dist > 0.0001 ? dz / dist : 1;

  // Push outside obstacle cylinder
  const overlap = minDist - dist;
  body.x += nx * overlap;
  body.z += nz * overlap;

  const isBumper = obstacle.kind === 'bumper_mushroom';
  const mult = obstacle.restitutionMultiplier ?? 1.0;

  const dot = body.vx * nx + body.vz * nz;
  const impactSpeed = Math.abs(dot);
  if (dot < 0) {
    const restitution = config.obstacleRestitution * mult;
    body.vx = (body.vx - (1 + restitution) * dot * nx) * (isBumper ? 1.02 : 0.95);
    body.vz = (body.vz - (1 + restitution) * dot * nz) * (isBumper ? 1.02 : 0.95);

    if (isBumper) {
      // Ensure bouncy mushroom bumpers always give a juicy minimum rebound kick!
      const reboundSpeed = Math.hypot(body.vx, body.vz);
      if (reboundSpeed < 13.5) {
        const scale = 13.5 / Math.max(0.01, reboundSpeed);
        body.vx *= scale;
        body.vz *= scale;
      }
    }
  } else if (isBumper) {
    body.vx += nx * 9.5;
    body.vz += nz * 9.5;
  }

  return {
    collided: true,
    impactSpeed: Math.max(impactSpeed, isBumper ? 11.0 : 2.0),
    normalX: nx,
    normalZ: nz,
    isBumper,
  };
}

/**
 * Checks if a character enters a jump pad and applies ballistic launch velocity toward the pad's target.
 */
export function checkAndTriggerJumpPad(
  body: PhysicsBodyState,
  pad: JumpPadDef,
  config: GamePhysicsConfig = DEFAULT_PHYSICS_CONFIG
): boolean {
  const padY = pad.baseY ?? 0;
  if (!body.isGrounded || Math.abs(body.y - padY) > 0.65) return false;

  const dist = Math.hypot(body.x - pad.x, body.z - pad.z);
  if (dist > pad.radius + body.radius * 0.45) return false;

  const dx = pad.targetX - body.x;
  const dz = pad.targetZ - body.z;
  const horizDist = Math.hypot(dx, dz) || 1;
  const dirX = dx / horizDist;
  const dirZ = dz / horizDist;

  // Calculate exact ballistic flight time so the character lands smoothly on the target platform!
  const deltaY = (pad.targetY ?? 0) - padY;
  const vy = Math.max(config.jumpPadUpVelocity, deltaY > 2 ? 16.5 : 14.2);
  const g = config.gravity;
  // y(t) = padY + vy * t - 0.5 * g * t^2 = targetY => 0.5*g*t^2 - vy*t + deltaY = 0
  const discriminant = Math.max(0.1, vy * vy - 2 * g * deltaY);
  const flightTime = (vy + Math.sqrt(discriminant)) / g;

  // Account for air friction over flightTime using analytical integral of exp(-k*t)
  const k = config.airFriction;
  const effectiveDistFactor =
    k > 0.001 ? (k * flightTime) / (1 - Math.exp(-k * flightTime)) : 1.0;
  const speed = (horizDist / Math.max(0.4, flightTime)) * effectiveDistFactor;

  body.vx = dirX * speed;
  body.vz = dirZ * speed;
  body.vy = vy;
  body.isGrounded = false;
  body.y = padY + 0.14;

  return true;
}

/**
 * Checks if a grounded character crosses a glowing floor speed dash zone and boosts their velocity.
 */
export function checkAndTriggerSpeedZone(
  body: PhysicsBodyState,
  zone: SpeedZoneDef,
  config: GamePhysicsConfig = DEFAULT_PHYSICS_CONFIG
): boolean {
  if (!body.isGrounded || Math.abs(body.y - zone.y) > 0.6) return false;
  const dist = Math.hypot(body.x - zone.x, body.z - zone.z);
  if (dist > zone.radius + body.radius * 0.35) return false;

  const currentSpeed = Math.hypot(body.vx, body.vz);
  const boostedSpeed = Math.min(
    config.maxLaunchSpeed * 1.22,
    Math.max(18.5, currentSpeed * zone.boostMultiplier)
  );

  // Blend current velocity direction toward the dash pad's arrow direction
  const curDirX = currentSpeed > 0.5 ? body.vx / currentSpeed : zone.dirX;
  const curDirZ = currentSpeed > 0.5 ? body.vz / currentSpeed : zone.dirZ;
  const blendX = curDirX * 0.45 + zone.dirX * 0.55;
  const blendZ = curDirZ * 0.45 + zone.dirZ * 0.55;
  const norm = Math.hypot(blendX, blendZ) || 1;

  body.vx = (blendX / norm) * boostedSpeed;
  body.vz = (blendZ / norm) * boostedSpeed;
  return true;
}

/**
 * Stage 2 (King of the Hill): Checks if a character is inside the active Golden Crown Zone.
 */
export function checkCrownZoneCapture(
  body: PhysicsBodyState,
  zoneX: number,
  zoneY: number,
  zoneZ: number,
  zoneRadius: number
): boolean {
  if (!body.isGrounded || Math.abs(body.y - zoneY) > 1.0) return false;
  const dist = Math.hypot(body.x - zoneX, body.z - zoneZ);
  return dist <= zoneRadius;
}

/**
 * Stage 3 (Jump Club Sweeper): Checks if a character collides with the rotating sweeper beam
 * centered at (0, -0.5) with angle `barAngle` and applies tangential + outward knockback!
 */
export function checkSweeperBarCollision(
  body: PhysicsBodyState,
  barAngle: number,
  barLength = 17.5,
  barRadius = 0.68,
  angularSpeed = 1.65
): { collided: boolean; hitX: number; hitZ: number } {
  // Character jumping high enough clears the sweeper beam!
  if (body.y > 1.35 || body.y < -0.5) {
    return { collided: false, hitX: 0, hitZ: 0 };
  }

  const pivotX = 0;
  const pivotZ = -0.5;
  const cosA = Math.cos(barAngle);
  const sinA = Math.sin(barAngle);

  // Project body position onto the bar line segment [-barLength, +barLength]
  const relX = body.x - pivotX;
  const relZ = body.z - pivotZ;
  const proj = Math.max(-barLength, Math.min(barLength, relX * cosA + relZ * sinA));

  // Ignore the central hub pillar radius (already handled by center-ruin obstacle)
  if (Math.abs(proj) < 1.8) {
    return { collided: false, hitX: 0, hitZ: 0 };
  }

  const closestX = pivotX + cosA * proj;
  const closestZ = pivotZ + sinA * proj;
  const dx = body.x - closestX;
  const dz = body.z - closestZ;
  const dist = Math.hypot(dx, dz);
  const minDist = body.radius + barRadius;

  if (dist >= minDist) {
    return { collided: false, hitX: 0, hitZ: 0 };
  }

  const nx = dist > 0.0001 ? dx / dist : -sinA;
  const nz = dist > 0.0001 ? dz / dist : cosA;

  // Push character outside bar
  const overlap = minDist - dist;
  body.x += nx * (overlap + 0.12);
  body.z += nz * (overlap + 0.12);

  // Apply sweeping knockback + slight upward pop
  const sweepSpeed = Math.min(28.0, Math.max(15.5, Math.abs(proj) * Math.abs(angularSpeed) * 1.15));
  const outX = relX / (Math.hypot(relX, relZ) || 1);
  const outZ = relZ / (Math.hypot(relX, relZ) || 1);

  body.vx = nx * sweepSpeed * 0.72 + outX * sweepSpeed * 0.48;
  body.vz = nz * sweepSpeed * 0.72 + outZ * sweepSpeed * 0.48;
  body.vy = 6.2;
  body.isGrounded = false;
  body.y = Math.max(body.y, 0.12);

  return {
    collided: true,
    hitX: closestX,
    hitZ: closestZ,
  };
}

/**
 * Stage 4 (Hot Bomb Tag): Resolves passing the ticking bomb between two colliding characters
 * if the transfer cooldown has expired.
 */
export function resolveBombPassOnCollision(
  currentHolderId: string | null,
  actorAId: string,
  actorBId: string,
  transferCooldown: number
): { nextHolderId: string | null; transferred: boolean } {
  if (!currentHolderId || transferCooldown > 0) {
    return { nextHolderId: currentHolderId, transferred: false };
  }
  if (currentHolderId === actorAId) {
    return { nextHolderId: actorBId, transferred: true };
  }
  if (currentHolderId === actorBId) {
    return { nextHolderId: actorAId, transferred: true };
  }
  return { nextHolderId: currentHolderId, transferred: false };
}

export interface RankEntry {
  id: string;
  name: string;
  score: number;
  isPlayer: boolean;
  rank: number;
}

/**
 * Sorts participants by score descending and assigns 1-based ranks.
 */
export function computeLeaderboard<T extends { id: string; name: string; score: number; isPlayer: boolean }>(
  actors: T[]
): Array<T & { rank: number }> {
  return [...actors]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
      return a.id.localeCompare(b.id);
    })
    .map((actor, index) => ({
      ...actor,
      rank: index + 1,
    }));
}
