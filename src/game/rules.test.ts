/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFallPenalty,
  calculateGrowthFromScore,
  checkAndTriggerJumpPad,
  checkAndTriggerSpeedZone,
  checkCrownZoneCapture,
  checkSweeperBarCollision,
  computeLeaderboard,
  computeSlingshotLaunch,
  computeStarCollectPoints,
  getArenaGroundHeight,
  PhysicsBodyState,
  resolveBombPassOnCollision,
  resolveObstacleCollision,
  resolveSphereCollision,
  stepBodyKinematics,
} from './rules';
import {
  ARENA_JUMP_PADS,
  ARENA_OBSTACLES,
  ARENA_PLATFORMS,
  ARENA_SPEED_ZONES,
  DEFAULT_PHYSICS_CONFIG,
  UPPER_PLATFORM,
} from './config';

test('slingshot launch fires opposite to drag direction and clamps max power', () => {
  // Dragging straight down (+Y on screen) should launch straight forward (-Z in world)
  const launch = computeSlingshotLaunch(100, 100, 100, 200, DEFAULT_PHYSICS_CONFIG);
  assert.equal(launch.isValid, true);
  assert.ok(Math.abs(launch.dirX) < 1e-6);
  assert.ok(Math.abs(launch.dirZ - -1) < 1e-6);
  assert.ok(launch.powerRatio > 0.5 && launch.powerRatio < 1);

  // Dragging beyond maxPullPixels clamps powerRatio to 1.0 and speed to maxLaunchSpeed
  const maxLaunch = computeSlingshotLaunch(100, 100, 100, 500, DEFAULT_PHYSICS_CONFIG);
  assert.equal(maxLaunch.powerRatio, 1);
  assert.equal(maxLaunch.launchSpeed, DEFAULT_PHYSICS_CONFIG.maxLaunchSpeed);

  // Micro drag below minPullPixels is ignored
  const tinyDrag = computeSlingshotLaunch(100, 100, 103, 104, DEFAULT_PHYSICS_CONFIG);
  assert.equal(tinyDrag.isValid, false);
});

test('character decelerates after launch so next shot is available within 1-2 seconds', () => {
  const body: PhysicsBodyState = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: -DEFAULT_PHYSICS_CONFIG.maxLaunchSpeed,
    radius: DEFAULT_PHYSICS_CONFIG.baseRadius,
    mass: 1,
    isGrounded: true,
  };

  let elapsed = 0;
  const dt = 1 / 60;
  while (elapsed < 1.5) {
    stepBodyKinematics(body, dt, 0, DEFAULT_PHYSICS_CONFIG);
    elapsed += dt;
    const speed = Math.hypot(body.vx, body.vz);
    if (speed <= DEFAULT_PHYSICS_CONFIG.canAimSpeedThreshold) {
      break;
    }
  }

  const finalSpeed = Math.hypot(body.vx, body.vz);
  assert.ok(
    finalSpeed <= DEFAULT_PHYSICS_CONFIG.canAimSpeedThreshold,
    `Expected speed <= ${DEFAULT_PHYSICS_CONFIG.canAimSpeedThreshold} within 1.5s, got ${finalSpeed}`
  );
  assert.ok(elapsed >= 0.4 && elapsed <= 1.4, `Expected settle time between 0.4s and 1.4s, got ${elapsed}s`);
});

test('growth curve increases radius smoothly with score and respects maxRadius cap', () => {
  const g0 = calculateGrowthFromScore(0, DEFAULT_PHYSICS_CONFIG);
  const g500 = calculateGrowthFromScore(500, DEFAULT_PHYSICS_CONFIG);
  const g2000 = calculateGrowthFromScore(2000, DEFAULT_PHYSICS_CONFIG);
  const g99999 = calculateGrowthFromScore(99999, DEFAULT_PHYSICS_CONFIG);

  assert.equal(g0.radius, DEFAULT_PHYSICS_CONFIG.baseRadius);
  assert.equal(g0.level, 1);
  assert.ok(g500.radius > g0.radius);
  assert.ok(g2000.radius > g500.radius);
  assert.ok(g2000.level > g0.level);
  assert.ok(g99999.radius <= DEFAULT_PHYSICS_CONFIG.maxRadius);
});

test('fall penalty deducts 20% of score and reduces character size', () => {
  const before = calculateGrowthFromScore(1000, DEFAULT_PHYSICS_CONFIG);
  const penalty = applyFallPenalty(1000, DEFAULT_PHYSICS_CONFIG);
  assert.equal(penalty.newScore, 800);
  assert.equal(penalty.lostScore, 200);

  const after = calculateGrowthFromScore(penalty.newScore, DEFAULT_PHYSICS_CONFIG);
  assert.ok(after.radius < before.radius);
});

test('sphere-to-sphere collision bounces characters apart with elastic impulse', () => {
  const a: PhysicsBodyState = {
    x: -0.8,
    y: 0,
    z: 0,
    vx: 18,
    vy: 0,
    vz: 0,
    radius: 1.0,
    mass: 1.0,
    isGrounded: true,
  };
  const b: PhysicsBodyState = {
    x: 0.8,
    y: 0,
    z: 0,
    vx: -4,
    vy: 0,
    vz: 0,
    radius: 1.0,
    mass: 1.0,
    isGrounded: true,
  };

  const res = resolveSphereCollision(a, b, DEFAULT_PHYSICS_CONFIG);
  assert.equal(res.collided, true);
  assert.ok(res.impactSpeed > 15);
  assert.ok(a.vx < 0, 'Body A should bounce backward');
  assert.ok(b.vx > 10, 'Body B should be knocked forward');
  assert.ok(Math.hypot(b.x - a.x, b.z - a.z) >= a.radius + b.radius - 1e-5);
});

test('obstacle collision reflects character velocity off pillar and gives super-bounce on mushroom bumper', () => {
  const pillar = ARENA_OBSTACLES[0];
  const body: PhysicsBodyState = {
    x: pillar.x,
    y: 0,
    z: pillar.z + pillar.radius + 0.5,
    vx: 0,
    vy: 0,
    vz: -15,
    radius: 1.0,
    mass: 1.0,
    isGrounded: true,
  };

  const res = resolveObstacleCollision(body, pillar, DEFAULT_PHYSICS_CONFIG);
  assert.equal(res.collided, true);
  assert.ok(body.vz > 0, 'Velocity should reflect outward in +Z');

  // Test bouncy mushroom bumper
  const mushroom = ARENA_OBSTACLES.find((o) => o.kind === 'bumper_mushroom')!;
  const body2: PhysicsBodyState = {
    x: mushroom.x,
    y: mushroom.baseY ?? 0,
    z: mushroom.z + mushroom.radius + 0.4,
    vx: 0,
    vy: 0,
    vz: -6,
    radius: 1.0,
    mass: 1.0,
    isGrounded: true,
  };
  const resMushroom = resolveObstacleCollision(body2, mushroom, DEFAULT_PHYSICS_CONFIG);
  assert.equal(resMushroom.collided, true);
  assert.equal(resMushroom.isBumper, true);
  assert.ok(body2.vz >= 13.0, 'Bouncy mushroom should impart a strong rebound >= 13.0');
});

test('jump pad launches grounded character onto the raised north sanctuary platform', () => {
  const pad = ARENA_JUMP_PADS[0]; // NE pad targeting North Sanctuary
  const body: PhysicsBodyState = {
    x: pad.x,
    y: 0,
    z: pad.z,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 1.0,
    mass: 1.0,
    isGrounded: true,
  };

  const triggered = checkAndTriggerJumpPad(body, pad, DEFAULT_PHYSICS_CONFIG);
  assert.equal(triggered, true);
  assert.equal(body.isGrounded, false);
  assert.ok(body.vy > 10);

  // Simulate flight until landing on North Sanctuary platform
  let landedOnUpper = false;
  for (let i = 0; i < 140; i++) {
    const gh = getArenaGroundHeight(body.x, body.z, body.y, DEFAULT_PHYSICS_CONFIG.arenaRadius, ARENA_PLATFORMS);
    stepBodyKinematics(body, 1 / 60, gh, DEFAULT_PHYSICS_CONFIG);
    if (body.isGrounded && Math.abs(body.y - UPPER_PLATFORM.height) < 0.08) {
      landedOnUpper = true;
      break;
    }
  }
  assert.equal(landedOnUpper, true, 'Character launched from jump pad should land on the raised platform');
});

test('multi-island ground height and bridges connect all 4 outer zones', () => {
  const r = DEFAULT_PHYSICS_CONFIG.arenaRadius;
  // Center hub
  assert.equal(getArenaGroundHeight(0, 0, 0, r), 0);
  // North Sanctuary
  assert.equal(getArenaGroundHeight(0, -26.5, 3.4, r), 3.4);
  // West Blossom Island
  assert.equal(getArenaGroundHeight(-27.5, 0, 0.4, r), 0.4);
  // East Crystal Island
  assert.equal(getArenaGroundHeight(27.5, 0, 2.2, r), 2.2);
  // South Oasis Island
  assert.equal(getArenaGroundHeight(0, 26.5, 0, r), 0);
  // West wooden bridge midpoint
  const westBridgeH = getArenaGroundHeight(-20.2, 0, 0.3, r);
  assert.ok(westBridgeH !== null && westBridgeH >= 0 && westBridgeH <= 0.4);

  // Speed zone boost test
  const dash = ARENA_SPEED_ZONES[0];
  const runner: PhysicsBodyState = {
    x: dash.x,
    y: dash.y,
    z: dash.z,
    vx: 0,
    vy: 0,
    vz: -8,
    radius: 1,
    mass: 1,
    isGrounded: true,
  };
  const boosted = checkAndTriggerSpeedZone(runner, dash, DEFAULT_PHYSICS_CONFIG);
  assert.equal(boosted, true);
  assert.ok(Math.hypot(runner.vx, runner.vz) >= 18.0);
});

test('round duration is 60 seconds and final 15 seconds grant 2x star points', () => {
  assert.equal(DEFAULT_PHYSICS_CONFIG.roundDurationSeconds, 60);
  assert.equal(DEFAULT_PHYSICS_CONFIG.feverThresholdSeconds, 15);
  assert.equal(DEFAULT_PHYSICS_CONFIG.feverScoreMultiplier, 2);

  const normal = computeStarCollectPoints(140, 32, DEFAULT_PHYSICS_CONFIG);
  assert.equal(normal.isFeverTime, false);
  assert.equal(normal.awardedPoints, 140);

  const feverEdge = computeStarCollectPoints(140, 15.0, DEFAULT_PHYSICS_CONFIG);
  assert.equal(feverEdge.isFeverTime, true);
  assert.equal(feverEdge.awardedPoints, 280);

  const feverMega = computeStarCollectPoints(450, 8.5, DEFAULT_PHYSICS_CONFIG);
  assert.equal(feverMega.isFeverTime, true);
  assert.equal(feverMega.awardedPoints, 900);
});

test('Fall Guys stage rules: Crown Zone capture, Sweeper Beam knockback, and Hot Bomb pass work accurately', () => {
  // 1. Crown Zone capture
  const actorInZone: PhysicsBodyState = {
    x: 1.5,
    y: 0,
    z: -5.0,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 1,
    mass: 1,
    isGrounded: true,
  };
  assert.equal(checkCrownZoneCapture(actorInZone, 0, 0, -6.2, 4.8), true);
  assert.equal(checkCrownZoneCapture(actorInZone, 12, 0, 12, 4.8), false);

  // 2. Rotating Sweeper Beam collision
  const targetOnBar: PhysicsBodyState = {
    x: 8.0,
    y: 0,
    z: -0.2,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 1.0,
    mass: 1.0,
    isGrounded: true,
  };
  const sweepHit = checkSweeperBarCollision(targetOnBar, 0, 17.5, 0.68, 1.8);
  assert.equal(sweepHit.collided, true);
  assert.ok(Math.hypot(targetOnBar.vx, targetOnBar.vz) >= 14.0, 'Sweeper beam should knock actor away');
  assert.equal(targetOnBar.isGrounded, false);

  // 3. Hot Bomb Tag pass on collision
  const pass1 = resolveBombPassOnCollision('player', 'player', 'bot-1', 0);
  assert.equal(pass1.transferred, true);
  assert.equal(pass1.nextHolderId, 'bot-1');

  const passOnCooldown = resolveBombPassOnCollision('bot-1', 'player', 'bot-1', 0.8);
  assert.equal(passOnCooldown.transferred, false);
  assert.equal(passOnCooldown.nextHolderId, 'bot-1');
});

test('leaderboard sorts actors by score descending and assigns 1-based ranks', () => {
  const ranked = computeLeaderboard([
    { id: 'player', name: '나', score: 1120, isPlayer: true },
    { id: 'bot-1', name: '멍멍이왕', score: 2460, isPlayer: false },
    { id: 'bot-2', name: '치즈냥이', score: 1980, isPlayer: false },
    { id: 'bot-3', name: '꿀꿀이', score: 1420, isPlayer: false },
  ]);

  assert.equal(ranked[0].name, '멍멍이왕');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[3].name, '나');
  assert.equal(ranked[3].rank, 4);
});
