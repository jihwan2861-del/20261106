/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AI_BOT_PROFILES,
  AnimalType,
  ARENA_BRIDGES,
  ARENA_JUMP_PADS,
  ARENA_OBSTACLES,
  ARENA_PLATFORMS,
  ARENA_SPEED_ZONES,
  CROWN_ZONE_WAYPOINTS,
  GamePhysicsConfig,
  STAGE_PRESETS,
  StageId,
} from '../game/config';
import {
  CharacterModelHandle,
  createAnimalCharacterModel,
  createCrownZoneModel,
  createFantasyArena,
  createHotBombModel,
  createStarItemModel,
  createSweeperBeamModel,
} from '../game/models';
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
} from '../game/rules';
import { soundEngine } from '../game/sound';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';
export type CameraViewMode = 'follow' | 'overview';

export interface MiniMapStarSnapshot {
  id: number;
  x: number;
  z: number;
  isMega: boolean;
  active: boolean;
}

export interface StageRuntimeStatus {
  stageId: StageId;
  statusText: string;
  crownZone?: { x: number; z: number; radius: number; labelKo: string } | null;
  bombHolderName?: string | null;
  bombRemainingSec?: number | null;
}

export interface HudActorSnapshot {
  id: string;
  name: string;
  animal: AnimalType;
  score: number;
  level: number;
  levelProgress: number;
  rank: number;
  isPlayer: boolean;
  canAim: boolean;
  invincibleTimer: number;
  isBombHolder?: boolean;
  /** World XZ coordinates for live 2D mini-map */
  worldX: number;
  worldZ: number;
  /** Projected 2D viewport coordinates (0..1) for floating character tags */
  screenX: number;
  screenY: number;
  visibleOnScreen: boolean;
  /** Recent comic emote ('bang' | 'star' | 'fall' | null) */
  emote: 'bang' | 'star' | 'fall' | null;
  /** Last score delta popup */
  popupText: string | null;
}

export interface AimDragOverlayState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  powerRatio: number;
  dirX: number;
  dirZ: number;
}

export interface RoundSummary {
  rankings: Array<{
    id: string;
    name: string;
    animal: AnimalType;
    score: number;
    rank: number;
    isPlayer: boolean;
    starsCollected: number;
    collisionsCount: number;
    maxRadius: number;
  }>;
  playerRank: number;
  playerScore: number;
}

interface GameCanvasProps {
  gameState: GameState;
  stageId: StageId;
  cameraMode: CameraViewMode;
  playerAnimal: AnimalType;
  playerName: string;
  physicsConfig: GamePhysicsConfig;
  restartNonce: number;
  onHudUpdate: (
    actors: HudActorSnapshot[],
    stars: MiniMapStarSnapshot[],
    remainingSeconds: number,
    aimState: AimDragOverlayState,
    eventBanner: string | null,
    stageStatus: StageRuntimeStatus
  ) => void;
  onRoundEnd: (summary: RoundSummary) => void;
}

interface ActorRuntime {
  id: string;
  name: string;
  animal: AnimalType;
  isPlayer: boolean;
  personality: 'collector' | 'brawler' | 'platform_hunter';
  score: number;
  level: number;
  levelProgress: number;
  starsCollected: number;
  collisionsCount: number;
  maxRadiusReached: number;
  body: PhysicsBodyState;
  visualScale: number;
  squashX: number;
  squashY: number;
  squashZ: number;
  headingAngle: number;
  invincibleTimer: number;
  impactExprTimer: number;
  emote: 'bang' | 'star' | 'fall' | null;
  emoteTimer: number;
  popupText: string | null;
  popupTimer: number;
  aiThinkTimer: number;
  jumpPadCooldown: number;
  speedZoneCooldown: number;
  crownTickTimer: number;
  sweeperHitCooldown: number;
  model: CharacterModelHandle;
}

interface StarItemRuntime {
  id: number;
  x: number;
  y: number;
  z: number;
  isMega: boolean;
  points: number;
  active: boolean;
  respawnTimer: number;
  bobPhase: number;
  mesh: THREE.Group;
}

const MAX_PARTICLES = 140;
const MAX_TRAIL_GHOSTS = 48;

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  stageId,
  cameraMode,
  playerAnimal,
  playerName,
  physicsConfig,
  restartNonce,
  onHudUpdate,
  onRoundEnd,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in refs so React HUD re-renders never tear down the WebGL scene
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const stageIdRef = useRef(stageId);
  stageIdRef.current = stageId;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const configRef = useRef(physicsConfig);
  configRef.current = physicsConfig;

  const playerAnimalRef = useRef(playerAnimal);
  playerAnimalRef.current = playerAnimal;

  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  const onHudUpdateRef = useRef(onHudUpdate);
  onHudUpdateRef.current = onHudUpdate;

  const onRoundEndRef = useRef(onRoundEnd);
  onRoundEndRef.current = onRoundEnd;

  const resetMatchFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initRect = container.getBoundingClientRect();
    const initW = Math.max(320, initRect.width || window.innerWidth);
    const initH = Math.max(480, initRect.height || window.innerHeight);
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('data-testid', 'arena-canvas');
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene, Sky Background, Fog & Studio Environment Map
    const scene = new THREE.Scene();
    const skyHorizonColor = new THREE.Color(0x3ba6ff);
    scene.background = skyHorizonColor;
    // Use distant linear fog so the active 5-island archipelago stays 100% crisp and vibrant
    scene.fog = new THREE.Fog(0x3ba6ff, 95, 175);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.32;
    pmremGenerator.dispose();

    // 3. Camera: Smooth Player-Tracking Quarter-View + Full Archipelago Overview Mode
    const camera = new THREE.PerspectiveCamera(45, initW / initH, 0.5, 220);
    let currentPortraitScale = 1.0;
    const baseCamPos = new THREE.Vector3(0, 27.5, 23.0);
    const currentLookAt = new THREE.Vector3(0, 0.2, -1.6);

    const updateCameraFraming = (w: number, h: number) => {
      const aspect = w / Math.max(1, h);
      camera.aspect = aspect;
      currentPortraitScale = aspect < 0.7 ? (0.7 / Math.max(0.44, aspect)) * 0.92 : 1.0;
      baseCamPos.set(0, 26.5 * currentPortraitScale, 22.0 * currentPortraitScale);
      camera.updateProjectionMatrix();
    };
    updateCameraFraming(initW, initH);
    camera.position.copy(baseCamPos);
    camera.lookAt(currentLookAt);

    // 4. Warm Key Light + Cool Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0xdff4ff, 0x7da85b, 0.95);
    hemiLight.position.set(0, 35, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.55);
    sunLight.position.set(18, 36, 20);
    sunLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      const d = 32;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 95;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xa3e5ff, 0.45);
    rimLight.position.set(-16, 18, -20);
    scene.add(rimLight);

    // 5. Build 5-Island Fantasy Archipelago Arena
    const { jumpPadMeshes, obstacleMeshes } = createFantasyArena(scene);

    // 6. 3D Slingshot Aiming Arrow Group (white dashed trajectory + arrow tip on floor in front of player)
    const aimArrowGroup = new THREE.Group();
    aimArrowGroup.visible = false;
    scene.add(aimArrowGroup);

    const dashMeshes: THREE.Mesh[] = [];
    const dashGeo = new THREE.BoxGeometry(0.32, 0.08, 0.55);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    for (let i = 0; i < 6; i++) {
      const dMesh = new THREE.Mesh(dashGeo, dashMat);
      dMesh.position.set(0, 0.14, -(i * 0.95 + 1.4));
      aimArrowGroup.add(dMesh);
      dashMeshes.push(dMesh);
    }
    const arrowHeadShape = new THREE.Shape();
    arrowHeadShape.moveTo(0, 0.7);
    arrowHeadShape.lineTo(-0.58, -0.35);
    arrowHeadShape.lineTo(0.58, -0.35);
    arrowHeadShape.closePath();
    const arrowHeadGeo = new THREE.ShapeGeometry(arrowHeadShape);
    arrowHeadGeo.rotateX(-Math.PI / 2);
    const arrowHeadMesh = new THREE.Mesh(arrowHeadGeo, dashMat);
    arrowHeadMesh.position.set(0, 0.15, -7.2);
    aimArrowGroup.add(arrowHeadMesh);

    // 7. Zero-GC Pooled Particle System (InstancedMesh)
    const particleGeo = new THREE.DodecahedronGeometry(0.22, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, MAX_PARTICLES);
    particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleInstanced.frustumCulled = false;
    scene.add(particleInstanced);

    const pActive = new Uint8Array(MAX_PARTICLES);
    const pLife = new Float32Array(MAX_PARTICLES);
    const pMaxLife = new Float32Array(MAX_PARTICLES);
    const pPosX = new Float32Array(MAX_PARTICLES);
    const pPosY = new Float32Array(MAX_PARTICLES);
    const pPosZ = new Float32Array(MAX_PARTICLES);
    const pVelX = new Float32Array(MAX_PARTICLES);
    const pVelY = new Float32Array(MAX_PARTICLES);
    const pVelZ = new Float32Array(MAX_PARTICLES);
    const pScale = new Float32Array(MAX_PARTICLES);
    let particleCursor = 0;

    const _dummyMatrix = new THREE.Matrix4();
    const _dummyPos = new THREE.Vector3();
    const _dummyQuat = new THREE.Quaternion();
    const _dummyScale = new THREE.Vector3();
    const _dummyColor = new THREE.Color();

    // Initialize all particles hidden
    for (let i = 0; i < MAX_PARTICLES; i++) {
      _dummyScale.set(0, 0, 0);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
      particleInstanced.setMatrixAt(i, _dummyMatrix);
      particleInstanced.setColorAt(i, _dummyColor.setHex(0xffdf4d));
    }
    particleInstanced.instanceMatrix.needsUpdate = true;
    if (particleInstanced.instanceColor) particleInstanced.instanceColor.needsUpdate = true;

    const spawnParticles = (
      x: number,
      y: number,
      z: number,
      count: number,
      colorHex: number,
      speedMin: number,
      speedMax: number,
      scaleBase = 1.0
    ) => {
      for (let c = 0; c < count; c++) {
        const idx = particleCursor;
        particleCursor = (particleCursor + 1) % MAX_PARTICLES;
        pActive[idx] = 1;
        pMaxLife[idx] = 0.32 + Math.random() * 0.28;
        pLife[idx] = pMaxLife[idx];
        pPosX[idx] = x + (Math.random() - 0.5) * 0.4;
        pPosY[idx] = y + 0.3 + Math.random() * 0.4;
        pPosZ[idx] = z + (Math.random() - 0.5) * 0.4;

        const angle = Math.random() * Math.PI * 2;
        const spd = speedMin + Math.random() * (speedMax - speedMin);
        pVelX[idx] = Math.cos(angle) * spd;
        pVelY[idx] = 3.5 + Math.random() * 6.5;
        pVelZ[idx] = Math.sin(angle) * spd;
        pScale[idx] = scaleBase * (0.75 + Math.random() * 0.6);

        _dummyColor.setHex(colorHex);
        particleInstanced.setColorAt(idx, _dummyColor);
      }
      if (particleInstanced.instanceColor) particleInstanced.instanceColor.needsUpdate = true;
    };

    // 8. Zero-GC Pooled Speed Trail Ghosts (InstancedMesh)
    const trailGeo = new THREE.SphereGeometry(0.45, 10, 8);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const trailInstanced = new THREE.InstancedMesh(trailGeo, trailMat, MAX_TRAIL_GHOSTS);
    trailInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    trailInstanced.frustumCulled = false;
    scene.add(trailInstanced);

    const tLife = new Float32Array(MAX_TRAIL_GHOSTS);
    const tPosX = new Float32Array(MAX_TRAIL_GHOSTS);
    const tPosY = new Float32Array(MAX_TRAIL_GHOSTS);
    const tPosZ = new Float32Array(MAX_TRAIL_GHOSTS);
    const tScale = new Float32Array(MAX_TRAIL_GHOSTS);
    let trailCursor = 0;

    for (let i = 0; i < MAX_TRAIL_GHOSTS; i++) {
      _dummyScale.set(0, 0, 0);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
      trailInstanced.setMatrixAt(i, _dummyMatrix);
    }
    trailInstanced.instanceMatrix.needsUpdate = true;

    const spawnTrailGhost = (x: number, y: number, z: number, radius: number) => {
      const idx = trailCursor;
      trailCursor = (trailCursor + 1) % MAX_TRAIL_GHOSTS;
      tLife[idx] = 0.22;
      tPosX[idx] = x;
      tPosY[idx] = y + radius * 0.55;
      tPosZ[idx] = z;
      tScale[idx] = radius * 0.95;
    };

    // 9. Star Collectibles Pool (16 regular stars across Hub & Bridges + 4 Mega Stars on the 4 Outer Islands!)
    const starSpots: Array<{ x: number; y: number; z: number; isMega: boolean; points: number }> = [
      // Inner & Mid Hub Stars
      { x: -4.2, y: 0, z: -6.2, isMega: false, points: 140 },
      { x: 4.5, y: 0, z: -6.2, isMega: false, points: 140 },
      { x: -9.5, y: 0, z: -1.2, isMega: false, points: 140 },
      { x: 9.5, y: 0, z: 1.5, isMega: false, points: 140 },
      { x: -4.0, y: 0, z: 4.2, isMega: false, points: 140 },
      { x: 4.2, y: 0, z: 4.5, isMega: false, points: 140 },
      { x: 5.5, y: 0, z: 10.5, isMega: false, points: 160 },
      { x: -5.5, y: 0, z: 10.5, isMega: false, points: 160 },
      { x: 0, y: 0, z: -5.5, isMega: false, points: 180 },
      { x: -13.5, y: 0, z: -9.5, isMega: false, points: 160 },
      { x: 13.5, y: 0, z: -9.5, isMega: false, points: 160 },
      { x: -13.5, y: 0, z: 9.5, isMega: false, points: 160 },
      { x: 13.5, y: 0, z: 9.5, isMega: false, points: 160 },
      // Bridge & Outer Island Rim Stars
      { x: -20.2, y: 0.2, z: 0, isMega: false, points: 180 },
      { x: 20.2, y: 1.1, z: 0, isMega: false, points: 180 },
      { x: 0, y: 0, z: 20.0, isMega: false, points: 180 },
      // 4 Mega Stars on each of the 4 Outer Themed Islands!
      {
        x: ARENA_PLATFORMS[0].x,
        y: ARENA_PLATFORMS[0].height + 0.3,
        z: ARENA_PLATFORMS[0].z,
        isMega: true,
        points: 450,
      },
      {
        x: ARENA_PLATFORMS[1].x,
        y: ARENA_PLATFORMS[1].height + 0.3,
        z: ARENA_PLATFORMS[1].z,
        isMega: true,
        points: 380,
      },
      {
        x: ARENA_PLATFORMS[2].x,
        y: ARENA_PLATFORMS[2].height + 0.3,
        z: ARENA_PLATFORMS[2].z,
        isMega: true,
        points: 420,
      },
      {
        x: ARENA_PLATFORMS[3].x,
        y: ARENA_PLATFORMS[3].height + 0.3,
        z: ARENA_PLATFORMS[3].z,
        isMega: true,
        points: 380,
      },
    ];

    const starItems: StarItemRuntime[] = starSpots.map((spot, idx) => {
      const mesh = createStarItemModel(spot.isMega);
      mesh.position.set(spot.x, spot.y, spot.z);
      scene.add(mesh);
      return {
        id: idx,
        x: spot.x,
        y: spot.y,
        z: spot.z,
        isMega: spot.isMega,
        points: spot.points,
        active: true,
        respawnTimer: 0,
        bobPhase: idx * 0.7,
        mesh,
      };
    });

    // 10. Fall Guys Multi-Rule 3D Stage Gimmicks
    const CROWN_ZONE_RADIUS = 4.8;
    const crownZoneGroup = createCrownZoneModel(CROWN_ZONE_RADIUS);
    scene.add(crownZoneGroup);

    const SWEEPER_BAR_LENGTH = 17.5;
    const sweeperGroup = createSweeperBeamModel(SWEEPER_BAR_LENGTH);
    scene.add(sweeperGroup);

    const hotBombGroup = createHotBombModel();
    scene.add(hotBombGroup);

    let crownWaypointIdx = 0;
    let crownMoveTimer = 15.0;
    let crownX = CROWN_ZONE_WAYPOINTS[0].x;
    let crownY = CROWN_ZONE_WAYPOINTS[0].y;
    let crownZ = CROWN_ZONE_WAYPOINTS[0].z;

    let sweeperAngle = 0;
    let sweeperSurvivalTick = 1.0;

    let bombHolderId = 'bot_cat';
    let bombTimer = 10.0;
    let bombTransferCooldown = 0;

    // 11. Actor Entities (1 Player + 3 AI Bots)
    const actorsGroup = new THREE.Group();
    scene.add(actorsGroup);
    let actors: ActorRuntime[] = [];

    let roundRemainingSeconds = configRef.current.roundDurationSeconds;
    let roundEndedSent = false;
    let feverAnnounced = false;
    let cameraTrauma = 0;
    let hitstopTimer = 0;
    let eventBanner: string | null = null;
    let eventBannerTimer = 0;

    const setBanner = (msg: string, duration = 2.0) => {
      eventBanner = msg;
      eventBannerTimer = duration;
    };

    const spawnPoints = [
      { x: -0.6, z: 6.2, heading: Math.PI }, // Player starts in south hub facing north (-Z), showing cute back & tail to camera!
      { x: -7.5, z: -2.2, heading: Math.PI + 0.4 },
      { x: 7.5, z: -2.8, heading: Math.PI - 0.5 },
      { x: -8.2, z: 3.5, heading: Math.PI + 0.8 },
    ];

    const buildActors = () => {
      // Clear previous models
      while (actorsGroup.children.length > 0) {
        actorsGroup.remove(actorsGroup.children[0]);
      }

      const cfg = configRef.current;
      const pAnimal = playerAnimalRef.current;
      const pName = playerNameRef.current.trim() || '나';
      const currentStage = stageIdRef.current;
      const stagePreset = STAGE_PRESETS[currentStage];

      const initialScores = [0, 120, 80, 40]; // Slight staggered start so leaderboard is dynamic right away
      const definitions = [
        {
          id: 'player',
          name: pName,
          animal: pAnimal,
          isPlayer: true,
          personality: 'collector' as const,
          initialScore: initialScores[0],
        },
        ...AI_BOT_PROFILES.map((bot, idx) => ({
          id: bot.id,
          name: bot.name,
          animal: bot.animal,
          isPlayer: false,
          personality: bot.personality,
          initialScore: initialScores[idx + 1],
        })),
      ];

      actors = definitions.map((def, i) => {
        const sp = spawnPoints[i];
        const model = createAnimalCharacterModel(def.animal, def.isPlayer);
        model.root.position.set(sp.x, 0, sp.z);
        actorsGroup.add(model.root);

        const growth = calculateGrowthFromScore(def.initialScore, cfg);
        return {
          id: def.id,
          name: def.name,
          animal: def.animal,
          isPlayer: def.isPlayer,
          personality: def.personality,
          score: def.initialScore,
          level: growth.level,
          levelProgress: growth.levelProgress,
          starsCollected: 0,
          collisionsCount: 0,
          maxRadiusReached: growth.radius,
          body: {
            x: sp.x,
            y: 0,
            z: sp.z,
            vx: 0,
            vy: 0,
            vz: 0,
            radius: growth.radius,
            mass: growth.mass,
            isGrounded: true,
          },
          visualScale: growth.scaleMultiplier,
          squashX: 1,
          squashY: 1,
          squashZ: 1,
          headingAngle: sp.heading,
          invincibleTimer: 0,
          impactExprTimer: 0,
          emote: null,
          emoteTimer: 0,
          popupText: null,
          popupTimer: 0,
          aiThinkTimer: 0.35 + i * 0.25,
          jumpPadCooldown: 0,
          speedZoneCooldown: 0,
          crownTickTimer: 0.35,
          sweeperHitCooldown: 0,
          model,
        };
      });

      starItems.forEach((star) => {
        star.active = true;
        star.respawnTimer = 0;
        star.mesh.visible = true;
        star.mesh.scale.set(1, 1, 1);
      });

      // Reset stage-specific gimmicks
      crownWaypointIdx = 0;
      crownMoveTimer = 15.0;
      crownX = CROWN_ZONE_WAYPOINTS[0].x;
      crownY = CROWN_ZONE_WAYPOINTS[0].y;
      crownZ = CROWN_ZONE_WAYPOINTS[0].z;
      crownZoneGroup.visible = currentStage === 'king_of_hill';
      crownZoneGroup.position.set(crownX, crownY, crownZ);

      sweeperAngle = 0;
      sweeperSurvivalTick = 1.0;
      sweeperGroup.visible = currentStage === 'sweeper_survival';
      sweeperGroup.rotation.y = 0;

      // Start the bomb on an AI bot so the player has time to react
      bombHolderId = actors[1]?.id || 'bot_cat';
      bombTimer = 10.0;
      bombTransferCooldown = 0;
      hotBombGroup.visible = currentStage === 'hex_bomb_tag';

      roundRemainingSeconds = cfg.roundDurationSeconds;
      roundEndedSent = false;
      feverAnnounced = false;
      cameraTrauma = 0;
      hitstopTimer = 0;
      setBanner(`${stagePreset.roundBadgeKo} [${stagePreset.titleKo}] ${stagePreset.ruleSummaryKo}`, 3.5);
    };

    buildActors();
    resetMatchFnRef.current = buildActors;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 11. Slingshot Drag & Keyboard Input Handling
    const aimDrag: AimDragOverlayState = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      powerRatio: 0,
      dirX: 0,
      dirZ: -1,
    };

    let activePointerId: number | null = null;
    const keysHeld = new Set<string>();

    const canPlayerAimNow = (player: ActorRuntime | undefined): boolean => {
      if (!player || stateRef.current !== 'playing') return false;
      if (!player.body.isGrounded) return false;
      const speed = Math.hypot(player.body.vx, player.body.vz);
      return speed <= configRef.current.canAimSpeedThreshold;
    };

    const fireCharacterLaunch = (
      actor: ActorRuntime,
      dirX: number,
      dirZ: number,
      launchSpeed: number,
      powerRatio: number
    ) => {
      actor.body.vx = dirX * launchSpeed;
      actor.body.vz = dirZ * launchSpeed;
      actor.headingAngle = Math.atan2(dirX, dirZ);
      // Elastic launch stretch animation
      actor.squashX = 0.78;
      actor.squashY = 0.86;
      actor.squashZ = 1.34;

      spawnParticles(actor.body.x, actor.body.y, actor.body.z, 6, 0xfff3b0, 2.5, 6.0, 0.85);
      if (actor.isPlayer) {
        soundEngine.playLaunch(powerRatio);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (stateRef.current !== 'playing') return;
      const player = actors[0];
      if (!canPlayerAimNow(player)) return;

      activePointerId = e.pointerId;
      aimDrag.active = true;
      aimDrag.startX = e.clientX;
      aimDrag.startY = e.clientY;
      aimDrag.currentX = e.clientX;
      aimDrag.currentY = e.clientY;
      aimDrag.powerRatio = 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!aimDrag.active) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;

      aimDrag.currentX = e.clientX;
      aimDrag.currentY = e.clientY;

      const vec = computeSlingshotLaunch(
        aimDrag.startX,
        aimDrag.startY,
        aimDrag.currentX,
        aimDrag.currentY,
        configRef.current
      );
      aimDrag.powerRatio = vec.powerRatio;
      if (vec.isValid) {
        aimDrag.dirX = vec.dirX;
        aimDrag.dirZ = vec.dirZ;
        const player = actors[0];
        if (player) {
          player.headingAngle = Math.atan2(vec.dirX, vec.dirZ);
        }
      }
    };

    const finishDragLaunch = () => {
      if (!aimDrag.active) return;
      const vec = computeSlingshotLaunch(
        aimDrag.startX,
        aimDrag.startY,
        aimDrag.currentX,
        aimDrag.currentY,
        configRef.current
      );
      aimDrag.active = false;
      activePointerId = null;
      aimArrowGroup.visible = false;

      const player = actors[0];
      if (vec.isValid && canPlayerAimNow(player)) {
        fireCharacterLaunch(player, vec.dirX, vec.dirZ, vec.launchSpeed, vec.powerRatio);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keysHeld.add(e.code);
      if (stateRef.current !== 'playing') return;
      const player = actors[0];
      if (!canPlayerAimNow(player)) return;

      // Allow instant keyboard slingshot via WASD / Arrow keys for desktop accessibility & quick testing
      let kx = 0;
      let kz = 0;
      if (keysHeld.has('ArrowUp') || keysHeld.has('KeyW')) kz -= 1;
      if (keysHeld.has('ArrowDown') || keysHeld.has('KeyS')) kz += 1;
      if (keysHeld.has('ArrowLeft') || keysHeld.has('KeyA')) kx -= 1;
      if (keysHeld.has('ArrowRight') || keysHeld.has('KeyD')) kx += 1;

      if ((kx !== 0 || kz !== 0) && (e.code === 'Space' || e.code === 'Enter' || e.code.startsWith('Arrow') || e.code.startsWith('Key'))) {
        const len = Math.hypot(kx, kz);
        const cfg = configRef.current;
        fireCharacterLaunch(player, kx / len, kz / len, cfg.maxLaunchSpeed * 0.85, 0.85);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };

    const clearHeldInputs = () => {
      keysHeld.clear();
      aimDrag.active = false;
      activePointerId = null;
      aimArrowGroup.visible = false;
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishDragLaunch);
    window.addEventListener('pointercancel', clearHeldInputs);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeldInputs);

    // 12. ResizeObserver for responsive viewport adaptation
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          renderer.setSize(width, height);
          updateCameraFraming(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    // 13. Main Simulation & Render Loop (with Software-WebGL afterDraw pacing)
    let frameId = 0;
    let isUnmounted = false;
    let lastTime = performance.now();
    let hudSyncAccumulator = 0;
    let trailSpawnAccumulator = 0;
    const _projVec = new THREE.Vector3();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isUnmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepSimulation(rawDt: number) {
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const cfg = configRef.current;
      const mode = stateRef.current;

      // Update event banner timer
      if (eventBannerTimer > 0) {
        eventBannerTimer = Math.max(0, eventBannerTimer - dt);
        if (eventBannerTimer === 0) eventBanner = null;
      }

      // Spin & bob star items even on title screen
      starItems.forEach((star) => {
        if (!star.active) {
          if (mode === 'playing') {
            star.respawnTimer -= dt;
            if (star.respawnTimer <= 0) {
              star.active = true;
              star.mesh.visible = true;
              star.mesh.scale.set(0.1, 0.1, 0.1);
            }
          }
          return;
        }
        star.bobPhase += dt * 3.2;
        const spinner = star.mesh.getObjectByName('spinner');
        if (spinner) {
          spinner.rotation.y += dt * 2.6;
          spinner.position.y = (star.isMega ? 1.05 : 0.72) + Math.sin(star.bobPhase) * 0.14;
        }
        // Smooth spawn scale-in
        const s = THREE.MathUtils.damp(star.mesh.scale.x, 1, 10, dt);
        star.mesh.scale.set(s, s, s);
      });

      // Pulse jump pads subtly
      const pulseTime = performance.now() * 0.004;
      jumpPadMeshes.forEach((padMesh, idx) => {
        const s = 1 + Math.sin(pulseTime + idx) * 0.04;
        padMesh.scale.set(s, 1, s);
      });

      // Camera orbit on Title screen vs Dynamic Follow / Full Overview gameplay framing + trauma shake
      if (mode === 'title') {
        const t = performance.now() * 0.00035;
        camera.position.set(
          Math.sin(t) * 11.5,
          baseCamPos.y * 1.15,
          baseCamPos.z * 1.15 + Math.cos(t) * 4.5
        );
        camera.lookAt(0, 0.5, -2.0);
      } else {
        cameraTrauma = Math.max(0, cameraTrauma - dt * 2.4);
        const shakeAmt = cameraTrauma * cameraTrauma * 0.65;
        const shakeX = (Math.random() - 0.5) * 2 * shakeAmt;
        const shakeY = (Math.random() - 0.5) * 2 * shakeAmt;

        const player = actors[0];
        if (cameraModeRef.current === 'overview') {
          // Wide archipelago overview framing all 5 islands at once
          const targetX = 0 + shakeX;
          const targetY = 55.0 * currentPortraitScale + shakeY;
          const targetZ = 44.0 * currentPortraitScale;
          camera.position.set(
            THREE.MathUtils.damp(camera.position.x, targetX, 7, dt),
            THREE.MathUtils.damp(camera.position.y, targetY, 7, dt),
            THREE.MathUtils.damp(camera.position.z, targetZ, 7, dt)
          );
          currentLookAt.set(
            THREE.MathUtils.damp(currentLookAt.x, 0, 7, dt),
            THREE.MathUtils.damp(currentLookAt.y, 0.5, 7, dt),
            THREE.MathUtils.damp(currentLookAt.z, -2.2, 7, dt)
          );
          camera.lookAt(currentLookAt);
        } else {
          // Smooth player-tracking quarter-view camera across the central hub and outer islands
          const px = player ? player.body.x : 0;
          const py = player ? Math.max(0, player.body.y) : 0;
          const pz = player ? player.body.z : 0;

          const targetX = px * 0.82 + shakeX;
          const targetY = (24.5 + py * 0.7) * currentPortraitScale + shakeY;
          const targetZ = pz * 0.82 + 20.5 * currentPortraitScale;

          camera.position.set(
            THREE.MathUtils.damp(camera.position.x, targetX, 8.5, dt),
            THREE.MathUtils.damp(camera.position.y, targetY, 8.5, dt),
            THREE.MathUtils.damp(camera.position.z, targetZ, 8.5, dt)
          );

          currentLookAt.set(
            THREE.MathUtils.damp(currentLookAt.x, px * 0.86, 10, dt),
            THREE.MathUtils.damp(currentLookAt.y, py * 0.6 + 0.25, 10, dt),
            THREE.MathUtils.damp(currentLookAt.z, pz * 0.86 - 1.5, 10, dt)
          );
          camera.lookAt(currentLookAt);
        }
      }

      // Update pooled particles in-place
      let anyParticleUpdated = false;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (!pActive[i]) continue;
        anyParticleUpdated = true;
        pLife[i] -= dt;
        if (pLife[i] <= 0) {
          pActive[i] = 0;
          _dummyScale.set(0, 0, 0);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          particleInstanced.setMatrixAt(i, _dummyMatrix);
          continue;
        }
        pVelY[i] -= 18.0 * dt;
        pPosX[i] += pVelX[i] * dt;
        pPosY[i] += pVelY[i] * dt;
        pPosZ[i] += pVelZ[i] * dt;

        const lifeRatio = Math.max(0, pLife[i] / pMaxLife[i]);
        const sc = pScale[i] * lifeRatio;
        _dummyPos.set(pPosX[i], pPosY[i], pPosZ[i]);
        _dummyScale.set(sc, sc, sc);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        particleInstanced.setMatrixAt(i, _dummyMatrix);
      }
      if (anyParticleUpdated) {
        particleInstanced.instanceMatrix.needsUpdate = true;
      }

      // Update pooled speed trail ghosts
      let anyTrailUpdated = false;
      for (let i = 0; i < MAX_TRAIL_GHOSTS; i++) {
        if (tLife[i] <= 0) continue;
        anyTrailUpdated = true;
        tLife[i] -= dt;
        if (tLife[i] <= 0) {
          _dummyScale.set(0, 0, 0);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          trailInstanced.setMatrixAt(i, _dummyMatrix);
          continue;
        }
        const ratio = tLife[i] / 0.22;
        const sc = tScale[i] * ratio * 0.85;
        _dummyPos.set(tPosX[i], tPosY[i], tPosZ[i]);
        _dummyScale.set(sc, sc * 0.65, sc);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        trailInstanced.setMatrixAt(i, _dummyMatrix);
      }
      if (anyTrailUpdated) {
        trailInstanced.instanceMatrix.needsUpdate = true;
      }

      // Animate 3D Stage Gimmicks on both Title Screen & Active Gameplay
      const currentStage = stageIdRef.current;
      crownZoneGroup.visible = currentStage === 'king_of_hill';
      sweeperGroup.visible = currentStage === 'sweeper_survival';
      hotBombGroup.visible = currentStage === 'hex_bomb_tag';

      if (currentStage === 'king_of_hill') {
        const crownFloat = crownZoneGroup.getObjectByName('crownFloat');
        if (crownFloat) {
          crownFloat.rotation.y += dt * 2.2;
          crownFloat.position.y = 2.2 + Math.sin(pulseTime * 1.4) * 0.18;
        }
      } else if (currentStage === 'sweeper_survival' && mode === 'title') {
        sweeperAngle = (sweeperAngle + 1.15 * dt) % (Math.PI * 2);
        sweeperGroup.rotation.y = -sweeperAngle;
      }

      if (mode !== 'playing') {
        return;
      }

      // Round Timer & Final 15s Fever Time (2x Score) Trigger
      const prevRemaining = roundRemainingSeconds;
      roundRemainingSeconds = Math.max(0, roundRemainingSeconds - dt);
      const isFeverNow = roundRemainingSeconds <= cfg.feverThresholdSeconds;
      const feverMult = isFeverNow ? cfg.feverScoreMultiplier : 1;

      if (
        !feverAnnounced &&
        prevRemaining > cfg.feverThresholdSeconds &&
        roundRemainingSeconds <= cfg.feverThresholdSeconds &&
        roundRemainingSeconds > 0
      ) {
        feverAnnounced = true;
        soundEngine.playStarCollect(true);
        setBanner('🔥 마지막 15초 피버 타임! 모든 획득 점수 2배 (x2)!', 3.5);
      }

      if (roundRemainingSeconds <= 0 && !roundEndedSent) {
        roundEndedSent = true;
        clearHeldInputs();
        soundEngine.playVictory();
        const ranked = computeLeaderboard(actors);
        const playerEntry = ranked.find((a) => a.isPlayer) || ranked[0];
        onRoundEndRef.current({
          rankings: ranked.map((r) => ({
            id: r.id,
            name: r.name,
            animal: r.animal,
            score: r.score,
            rank: r.rank,
            isPlayer: r.isPlayer,
            starsCollected: r.starsCollected,
            collisionsCount: r.collisionsCount,
            maxRadius: r.maxRadiusReached,
          })),
          playerRank: playerEntry.rank,
          playerScore: playerEntry.score,
        });
        return;
      }

      // Sim-level Hitstop on heavy collisions
      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
        return;
      }

      // Stage-specific global gimmick updates
      if (currentStage === 'king_of_hill') {
        crownMoveTimer -= dt;
        if (crownMoveTimer <= 0) {
          crownMoveTimer = 15.0;
          crownWaypointIdx = (crownWaypointIdx + 1) % CROWN_ZONE_WAYPOINTS.length;
          const nextWp = CROWN_ZONE_WAYPOINTS[crownWaypointIdx];
          soundEngine.playStarCollect(false);
          setBanner(`👑 왕관 구역 이동! [${nextWp.labelKo}] 구역을 점령하세요!`, 2.6);
        }
        const targetWp = CROWN_ZONE_WAYPOINTS[crownWaypointIdx];
        crownX = THREE.MathUtils.damp(crownX, targetWp.x, 6, dt);
        crownY = THREE.MathUtils.damp(crownY, targetWp.y, 6, dt);
        crownZ = THREE.MathUtils.damp(crownZ, targetWp.z, 6, dt);
        crownZoneGroup.position.set(crownX, crownY, crownZ);
      } else if (currentStage === 'sweeper_survival') {
        const sweeperSpeed = isFeverNow ? 2.35 : 1.48;
        sweeperAngle = (sweeperAngle + sweeperSpeed * dt) % (Math.PI * 2);
        sweeperGroup.rotation.y = -sweeperAngle;

        sweeperSurvivalTick -= dt;
        if (sweeperSurvivalTick <= 0) {
          sweeperSurvivalTick = 1.0;
          const survivalBonus = 45 * feverMult;
          actors.forEach((act) => {
            if (act.body.isGrounded && Math.hypot(act.body.x, act.body.z) <= cfg.arenaRadius - 0.5) {
              act.score += survivalBonus;
              if (!act.popupText) {
                act.popupText = isFeverNow ? `+${survivalBonus} 🌀(x2)` : `+${survivalBonus} 🌀`;
                act.popupTimer = 0.65;
              }
            }
          });
        }
      } else if (currentStage === 'hex_bomb_tag') {
        if (bombTransferCooldown > 0) {
          bombTransferCooldown = Math.max(0, bombTransferCooldown - dt);
        }
        bombTimer -= dt;
        if (bombTimer <= 0) {
          // Detonate bomb on current holder!
          const holder = actors.find((a) => a.id === bombHolderId) || actors[0];
          if (holder) {
            const penaltyPts = Math.min(holder.score, 220);
            holder.score = Math.max(0, holder.score - penaltyPts);
            holder.body.vy = 13.5;
            holder.body.isGrounded = false;
            holder.squashX = 1.45;
            holder.squashY = 0.55;
            holder.squashZ = 1.45;
            holder.emote = 'bang';
            holder.emoteTimer = 1.2;
            holder.popupText = `-${penaltyPts} 💥폭발!`;
            holder.popupTimer = 1.3;

            spawnParticles(holder.body.x, holder.body.y + 0.8, holder.body.z, 28, 0xff4d00, 4.5, 13.5, 1.45);
          }

          // Award survival bonus to all other actors who avoided holding the bomb
          const survivalPts = 180 * feverMult;
          actors.forEach((act) => {
            if (act.id !== bombHolderId) {
              act.score += survivalPts;
              act.popupText = isFeverNow ? `+${survivalPts} 🛡️(x2)` : `+${survivalPts} 🛡️`;
              act.popupTimer = 1.2;
            }
          });

          soundEngine.playBounce(24, true);
          cameraTrauma = Math.min(1.0, cameraTrauma + 0.75);

          if (holder?.isPlayer) {
            setBanner('💥 시한폭탄 폭발! 점수 -220점! 다음 폭탄을 조심하세요!', 2.6);
          } else {
            setBanner(
              `💥 ${holder?.name || '봇'} 폭탄 폭발! 생존 보너스 +${survivalPts}점 획득!`,
              2.6
            );
          }

          // Assign new bomb to a different actor
          const candidates = actors.filter((a) => a.id !== bombHolderId);
          const nextHolder =
            candidates[Math.floor(Math.random() * candidates.length)] || actors[0];
          bombHolderId = nextHolder.id;
          bombTimer = isFeverNow ? 8.0 : 10.0;
          bombTransferCooldown = 1.0;
        }
      }

      trailSpawnAccumulator += dt;
      const shouldSpawnTrail = trailSpawnAccumulator >= 0.045;
      if (shouldSpawnTrail) trailSpawnAccumulator = 0;

      // Smoothly restore any pulsed obstacle meshes (e.g., bouncy mushrooms)
      obstacleMeshes.forEach((mesh) => {
        mesh.scale.x = THREE.MathUtils.damp(mesh.scale.x, 1, 10, dt);
        mesh.scale.y = THREE.MathUtils.damp(mesh.scale.y, 1, 10, dt);
        mesh.scale.z = THREE.MathUtils.damp(mesh.scale.z, 1, 10, dt);
      });

      // Update each Actor (Kinematics, AI Slingshot Decision, Stage Gimmicks, Jump Pads, Speed Dash Zones, Star Pickups, Fall-Off)
      actors.forEach((actor) => {
        if (actor.invincibleTimer > 0) actor.invincibleTimer = Math.max(0, actor.invincibleTimer - dt);
        if (actor.jumpPadCooldown > 0) actor.jumpPadCooldown = Math.max(0, actor.jumpPadCooldown - dt);
        if (actor.speedZoneCooldown > 0) actor.speedZoneCooldown = Math.max(0, actor.speedZoneCooldown - dt);
        if (actor.sweeperHitCooldown > 0) actor.sweeperHitCooldown = Math.max(0, actor.sweeperHitCooldown - dt);
        if (actor.emoteTimer > 0) {
          actor.emoteTimer = Math.max(0, actor.emoteTimer - dt);
          if (actor.emoteTimer === 0) actor.emote = null;
        }
        if (actor.popupTimer > 0) {
          actor.popupTimer = Math.max(0, actor.popupTimer - dt);
          if (actor.popupTimer === 0) actor.popupText = null;
        }
        if (actor.impactExprTimer > 0) {
          actor.impactExprTimer = Math.max(0, actor.impactExprTimer - dt);
          if (actor.impactExprTimer === 0) {
            actor.model.setExpression('normal');
          }
        }

        // Update growth target from score
        const growth = calculateGrowthFromScore(actor.score, cfg);
        actor.body.radius = THREE.MathUtils.damp(actor.body.radius, growth.radius, 8, dt);
        actor.body.mass = growth.mass;
        actor.level = growth.level;
        actor.levelProgress = growth.levelProgress;
        if (actor.body.radius > actor.maxRadiusReached) {
          actor.maxRadiusReached = actor.body.radius;
        }
        actor.visualScale = THREE.MathUtils.damp(actor.visualScale, growth.scaleMultiplier, 8, dt);

        // Step physics kinematics across the Central Hub, 4 Outer Islands, and 4 Bridges
        const groundH = getArenaGroundHeight(
          actor.body.x,
          actor.body.z,
          actor.body.y,
          cfg.arenaRadius,
          ARENA_PLATFORMS,
          ARENA_BRIDGES
        );
        const wasGrounded = actor.body.isGrounded;
        stepBodyKinematics(actor.body, dt, groundH, cfg);

        // Landing squash when touching down from a jump pad flight
        if (!wasGrounded && actor.body.isGrounded) {
          actor.squashX = 1.28;
          actor.squashY = 0.72;
          actor.squashZ = 1.28;
          spawnParticles(actor.body.x, actor.body.y, actor.body.z, 8, 0xffffff, 2, 5, 0.8);
        }

        const horizSpeed = Math.hypot(actor.body.vx, actor.body.vz);

        // Speed trail ghosts when moving fast
        if (shouldSpawnTrail && horizSpeed > cfg.maxLaunchSpeed * 0.42) {
          spawnTrailGhost(actor.body.x, actor.body.y, actor.body.z, actor.body.radius);
        }

        // Smooth visual heading (separated from rolling so the face never flips upside down!)
        if (horizSpeed > 0.8 && !(actor.isPlayer && aimDrag.active)) {
          const targetHeading = Math.atan2(actor.body.vx, actor.body.vz);
          let diff = targetHeading - actor.headingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          actor.headingAngle += diff * Math.min(1, dt * 12);
        }

        // Stage Gimmick 1: King of the Hill (Golden Crown Zone Capture)
        if (currentStage === 'king_of_hill') {
          if (checkCrownZoneCapture(actor.body, crownX, crownY, crownZ, CROWN_ZONE_RADIUS)) {
            actor.crownTickTimer -= dt;
            if (actor.crownTickTimer <= 0) {
              actor.crownTickTimer = 0.5;
              const pts = 45 * feverMult;
              actor.score += pts;
              actor.popupText = isFeverNow ? `+${pts} 👑(x2)` : `+${pts} 👑`;
              actor.popupTimer = 0.65;
              spawnParticles(actor.body.x, actor.body.y + 0.5, actor.body.z, 4, 0xffe144, 1.5, 4.5, 0.7);
            }
          }
        }

        // Stage Gimmick 2: Sweeper Survival (Rotating Sweeper Beam Hazard)
        if (currentStage === 'sweeper_survival' && actor.sweeperHitCooldown <= 0) {
          const sweeperSpeed = isFeverNow ? 2.35 : 1.48;
          const barHit = checkSweeperBarCollision(
            actor.body,
            sweeperAngle,
            SWEEPER_BAR_LENGTH,
            0.68,
            sweeperSpeed
          );
          if (barHit.collided) {
            actor.sweeperHitCooldown = 0.55;
            actor.collisionsCount += 1;
            actor.squashX = 1.42;
            actor.squashY = 0.66;
            actor.squashZ = 1.42;
            actor.model.setExpression('impact');
            actor.impactExprTimer = 0.55;
            actor.emote = 'bang';
            actor.emoteTimer = 0.85;
            spawnParticles(actor.body.x, actor.body.y + 0.6, actor.body.z, 18, 0xff2a85, 4, 11, 1.2);
            soundEngine.playBounce(20, true);
            if (actor.isPlayer) {
              cameraTrauma = Math.min(1.0, cameraTrauma + 0.6);
              setBanner('🌀 회전 해머에 강타당했어요! 점프 패드로 뛰어넘으세요!', 1.8);
            }
          }
        }

        // Check Speed Dash Zones (`ARENA_SPEED_ZONES`)
        if (actor.speedZoneCooldown <= 0 && actor.body.isGrounded && horizSpeed > 1.2) {
          for (const zone of ARENA_SPEED_ZONES) {
            if (checkAndTriggerSpeedZone(actor.body, zone, cfg)) {
              actor.speedZoneCooldown = 0.9;
              actor.squashX = 0.74;
              actor.squashY = 0.88;
              actor.squashZ = 1.38;
              spawnParticles(zone.x, zone.y + 0.2, zone.z, 12, 0x00f5d4, 4, 9, 1.0);
              if (actor.isPlayer) {
                soundEngine.playLaunch(0.95);
                setBanner('스피드 발판 가속! 초고속 슬라이딩!', 1.6);
              }
              break;
            }
          }
        }

        // Check Jump Pads
        if (actor.jumpPadCooldown <= 0 && actor.body.isGrounded) {
          for (const pad of ARENA_JUMP_PADS) {
            if (checkAndTriggerJumpPad(actor.body, pad, cfg)) {
              actor.jumpPadCooldown = 1.2;
              actor.squashX = 0.76;
              actor.squashY = 1.38;
              actor.squashZ = 0.76;
              spawnParticles(pad.x, (pad.baseY ?? 0) + 0.2, pad.z, 14, 0xff9f43, 3, 8, 1.1);
              soundEngine.playJumpPad();
              if (actor.isPlayer) {
                setBanner('점프 패드 발동! 공중 점프!', 1.8);
              }
              break;
            }
          }
        }

        // Check Obstacle Collisions (including Bouncy Mushroom Bumpers & Crystal Spires)
        for (const obs of ARENA_OBSTACLES) {
          const obsHit = resolveObstacleCollision(actor.body, obs, cfg);
          if (obsHit.collided) {
            actor.squashX = obsHit.isBumper ? 1.38 : 1.25;
            actor.squashY = obsHit.isBumper ? 0.74 : 0.84;
            actor.squashZ = obsHit.isBumper ? 0.72 : 0.78;

            const obsMesh = obstacleMeshes.get(obs.id);
            if (obsMesh && obsHit.isBumper) {
              obsMesh.scale.set(1.32, 0.78, 1.32);
            }

            spawnParticles(
              actor.body.x - obsHit.normalX * actor.body.radius,
              actor.body.y + 0.4,
              actor.body.z - obsHit.normalZ * actor.body.radius,
              obsHit.isBumper ? 14 : 6,
              obsHit.isBumper ? 0xff70a6 : obs.kind === 'crystal_spire' ? 0x72efdd : 0xe2d9e0,
              2.5,
              obsHit.isBumper ? 9.5 : 6,
              obsHit.isBumper ? 1.1 : 0.75
            );
            if (obsHit.impactSpeed > 5 || obsHit.isBumper) {
              soundEngine.playBounce(obsHit.impactSpeed, obsHit.isBumper);
              if (actor.isPlayer && obsHit.isBumper) {
                setBanner('통통 버섯 범퍼! 슈퍼 바운스!', 1.5);
              }
            }
          }
        }

        // Check Star Item Collection
        for (const star of starItems) {
          if (!star.active) continue;
          const dy = Math.abs(actor.body.y - star.y);
          if (dy > 1.8) continue;
          const dist = Math.hypot(actor.body.x - star.x, actor.body.z - star.z);
          if (dist <= actor.body.radius + (star.isMega ? 1.15 : 0.78)) {
            star.active = false;
            star.respawnTimer = star.isMega ? 8.0 : 4.2;
            star.mesh.visible = false;

            const { awardedPoints, isFeverTime } = computeStarCollectPoints(
              star.points,
              roundRemainingSeconds,
              cfg
            );
            actor.score += awardedPoints;
            actor.starsCollected += 1;
            actor.squashX = 1.32;
            actor.squashY = 1.32;
            actor.squashZ = 1.32;
            actor.emote = 'star';
            actor.emoteTimer = 0.9;
            actor.popupText = isFeverTime ? `+${awardedPoints} (x2!)` : `+${awardedPoints}`;
            actor.popupTimer = 1.05;

            spawnParticles(
              star.x,
              star.y + 0.5,
              star.z,
              star.isMega || isFeverTime ? 22 : 12,
              isFeverTime ? 0xff9f1c : 0xffdf4d,
              3.5,
              9.5,
              star.isMega ? 1.3 : 1.0
            );

            if (actor.isPlayer) {
              soundEngine.playStarCollect(star.isMega || isFeverTime);
              if (star.isMega) {
                setBanner(
                  isFeverTime
                    ? `🔥 피버 2배 슈퍼 스타 획득! (+${awardedPoints}점!)`
                    : `테마 섬 슈퍼 스타 획득! (+${awardedPoints}점 & 폭풍 성장!)`,
                  2.2
                );
              }
            }
          }
        }

        // Check Fall-off into Water Moat
        if (actor.body.y < -1.85) {
          const penalty = applyFallPenalty(actor.score, cfg);
          actor.score = penalty.newScore;
          const afterGrowth = calculateGrowthFromScore(actor.score, cfg);
          actor.body.radius = afterGrowth.radius;
          actor.body.mass = afterGrowth.mass;

          spawnParticles(actor.body.x, -1.8, actor.body.z, 18, 0x7ce8ff, 3, 8, 1.15);

          const safeAngle = Math.random() * Math.PI * 2;
          actor.body.x = Math.cos(safeAngle) * 3.5;
          actor.body.z = Math.sin(safeAngle) * 3.5 + 1.5;
          actor.body.y = 1.6;
          actor.body.vx = 0;
          actor.body.vy = 0;
          actor.body.vz = 0;
          actor.body.isGrounded = false;
          actor.invincibleTimer = cfg.respawnInvincibleSeconds;
          actor.emote = 'fall';
          actor.emoteTimer = 1.3;
          actor.popupText = penalty.lostScore > 0 ? `-${penalty.lostScore}` : '풍덩!';
          actor.popupTimer = 1.3;

          if (actor.isPlayer) {
            soundEngine.playFallOff();
            setBanner(`물에 빠졌어요! 점수 -20% (-${penalty.lostScore}점) · 2초 무적`, 2.4);
          } else {
            soundEngine.playRespawn();
          }
        }

        // Stage-Aware AI Bot Slingshot Decision Logic
        if (!actor.isPlayer && actor.body.isGrounded && horizSpeed <= cfg.canAimSpeedThreshold * 0.75) {
          actor.aiThinkTimer -= dt;
          if (actor.aiThinkTimer <= 0) {
            actor.aiThinkTimer = 0.42 + Math.random() * 0.5;

            let targetX = 0;
            let targetZ = 0;
            let bestScore = -Infinity;

            // 1. In Hex Bomb Tag: If this bot holds the bomb, chase the nearest rival to pass it!
            if (currentStage === 'hex_bomb_tag' && actor.id === bombHolderId) {
              let nearestDist = Infinity;
              for (const other of actors) {
                if (other.id === actor.id) continue;
                const d = Math.hypot(other.body.x - actor.body.x, other.body.z - actor.body.z);
                if (d < nearestDist) {
                  nearestDist = d;
                  targetX = other.body.x;
                  targetZ = other.body.z;
                  bestScore = 2000;
                }
              }
            } else if (currentStage === 'hex_bomb_tag') {
              // If bomb holder is very close, flee away from the bomb holder!
              const holder = actors.find((a) => a.id === bombHolderId);
              if (holder) {
                const distToHolder = Math.hypot(holder.body.x - actor.body.x, holder.body.z - actor.body.z);
                if (distToHolder < 8.5) {
                  targetX = actor.body.x - (holder.body.x - actor.body.x) * 1.4;
                  targetZ = actor.body.z - (holder.body.z - actor.body.z) * 1.4;
                  bestScore = 1500;
                }
              }
            }

            // 2. In King of the Hill: Strongly prioritize moving into the Golden Crown Zone
            if (currentStage === 'king_of_hill' && bestScore < 1000) {
              const distToCrown = Math.hypot(crownX - actor.body.x, crownZ - actor.body.z);
              if (distToCrown > CROWN_ZONE_RADIUS * 0.72) {
                targetX = crownX + (Math.random() - 0.5) * 2.2;
                targetZ = crownZ + (Math.random() - 0.5) * 2.2;
                bestScore = 1200;
              } else {
                // Already inside Crown Zone: try bumping a rival inside the zone!
                const rivalInZone = actors.find(
                  (o) =>
                    o.id !== actor.id &&
                    Math.hypot(o.body.x - crownX, o.body.z - crownZ) <= CROWN_ZONE_RADIUS
                );
                if (rivalInZone) {
                  targetX = rivalInZone.body.x;
                  targetZ = rivalInZone.body.z;
                  bestScore = 1100;
                }
              }
            }

            // 3. Standard Star / Platform Hunter / Brawler heuristics
            const activeMegaStars = starItems.filter((s) => s.isMega && s.active);
            if (
              bestScore < 500 &&
              activeMegaStars.length > 0 &&
              Math.hypot(actor.body.x, actor.body.z) < cfg.arenaRadius &&
              actor.personality === 'platform_hunter'
            ) {
              const pad = ARENA_JUMP_PADS[Math.floor(Math.random() * 3)];
              targetX = pad.x;
              targetZ = pad.z;
              bestScore = 999;
            }

            if (bestScore < 500) {
              for (const star of starItems) {
                if (!star.active) continue;
                if (star.y > 2.0 && actor.body.y < 1.2) continue;
                const d = Math.hypot(star.x - actor.body.x, star.z - actor.body.z);
                const val = star.points - d * 9.5;
                if (val > bestScore) {
                  bestScore = val;
                  targetX = star.x;
                  targetZ = star.z;
                }
              }
            }

            if (bestScore < 1000 && actor.personality === 'brawler' && Math.random() < 0.42) {
              const others = actors.filter(
                (other) => other.id !== actor.id && Math.abs(other.body.y - actor.body.y) < 1.5
              );
              if (others.length > 0) {
                const victim = others[Math.floor(Math.random() * others.length)];
                targetX = victim.body.x;
                targetZ = victim.body.z;
              }
            }

            const distFromCenter = Math.hypot(actor.body.x, actor.body.z);
            if (distFromCenter > cfg.arenaRadius * 1.05 && bestScore < 80) {
              targetX = 0;
              targetZ = 0;
            } else if (
              actor.body.y < 1.0 &&
              distFromCenter > cfg.arenaRadius * 0.85 &&
              distFromCenter < cfg.arenaRadius &&
              Math.random() < 0.55
            ) {
              targetX = (Math.random() - 0.5) * 6;
              targetZ = (Math.random() - 0.5) * 6;
            }

            const dx = targetX - actor.body.x;
            const dz = targetZ - actor.body.z;
            const dLen = Math.hypot(dx, dz) || 1;
            const dirX = dx / dLen;
            const dirZ = dz / dLen;

            const desiredPower = Math.min(0.94, Math.max(0.38, dLen / 14.5));
            const launchSpd =
              cfg.minLaunchSpeed + desiredPower * (cfg.maxLaunchSpeed - cfg.minLaunchSpeed);

            fireCharacterLaunch(actor, dirX, dirZ, launchSpd, desiredPower);
          }
        }
      });

      // Pairwise Character-to-Character Collisions (+ Bomb Tag Passing!)
      for (let i = 0; i < actors.length; i++) {
        for (let j = i + 1; j < actors.length; j++) {
          const a = actors[i];
          const b = actors[j];
          const hit = resolveSphereCollision(a.body, b.body, cfg);
          if (hit.collided) {
            a.collisionsCount += 1;
            b.collisionsCount += 1;

            // Check Bomb Pass in Hex Bomb Tag stage
            if (currentStage === 'hex_bomb_tag') {
              const passResult = resolveBombPassOnCollision(
                bombHolderId,
                a.id,
                b.id,
                bombTransferCooldown
              );
              if (passResult.transferred && passResult.nextHolderId) {
                bombHolderId = passResult.nextHolderId;
                bombTransferCooldown = 0.85;
                const receiver = a.id === bombHolderId ? a : b;
                const passer = a.id === bombHolderId ? b : a;
                receiver.popupText = '💣 폭탄 인수!';
                receiver.popupTimer = 1.1;
                passer.popupText = '💣 패스 성공!';
                passer.popupTimer = 1.1;
                if (receiver.isPlayer) {
                  setBanner('💣 시한폭탄을 넘겨받았어요! 빨리 다른 동물에게 박치기하세요!', 2.2);
                } else if (passer.isPlayer) {
                  setBanner(`💣 나이스! ${receiver.name}에게 시한폭탄을 넘겼어요!`, 2.2);
                }
              }
            }

            // Instant squishy deformation along impact axis
            const squashIntensity = Math.min(0.38, 0.16 + (hit.impactSpeed / cfg.maxLaunchSpeed) * 0.25);
            a.squashX = 1 + squashIntensity;
            a.squashY = 1 - squashIntensity * 0.55;
            a.squashZ = 1 - squashIntensity;

            b.squashX = 1 + squashIntensity;
            b.squashY = 1 - squashIntensity * 0.55;
            b.squashZ = 1 - squashIntensity;

            a.model.setExpression('impact');
            b.model.setExpression('impact');
            a.impactExprTimer = 0.45;
            b.impactExprTimer = 0.45;

            a.emote = 'bang';
            a.emoteTimer = 0.65;
            b.emote = 'bang';
            b.emoteTimer = 0.65;

            const isHeavy = hit.impactSpeed >= cfg.maxLaunchSpeed * 0.55;
            spawnParticles(
              hit.contactX,
              Math.max(a.body.y, b.body.y) + 0.5,
              hit.contactZ,
              isHeavy ? 20 : 10,
              isHeavy ? 0xffbe0b : 0xffffff,
              3.5,
              isHeavy ? 11.0 : 7.0,
              isHeavy ? 1.25 : 0.9
            );

            soundEngine.playBounce(hit.impactSpeed, isHeavy);

            if (isHeavy) {
              cameraTrauma = Math.min(1.0, cameraTrauma + 0.55);
              hitstopTimer = 0.045;
            } else if (a.isPlayer || b.isPlayer) {
              cameraTrauma = Math.min(0.6, cameraTrauma + 0.25);
            }
          }
        }
      }

      // Sync 3D Visual Meshes for all Actors
      const nowSec = performance.now() * 0.001;
      actors.forEach((actor) => {
        actor.squashX = THREE.MathUtils.damp(actor.squashX, 1, 11, dt);
        actor.squashY = THREE.MathUtils.damp(actor.squashY, 1, 11, dt);
        actor.squashZ = THREE.MathUtils.damp(actor.squashZ, 1, 11, dt);

        const s = actor.visualScale;
        actor.model.root.position.set(actor.body.x, actor.body.y, actor.body.z);

        const speed = Math.hypot(actor.body.vx, actor.body.vz);
        const waddleBob = actor.body.isGrounded && speed > 0.5 ? Math.abs(Math.sin(nowSec * 14)) * 0.08 : 0;

        actor.model.bodyVisual.position.y = 0.92 * s * actor.squashY + waddleBob;
        actor.model.bodyVisual.scale.set(
          s * actor.squashX,
          s * actor.squashY,
          s * actor.squashZ
        );
        actor.model.bodyVisual.rotation.y = actor.headingAngle;

        actor.model.tailMesh.rotation.z = Math.sin(nowSec * (speed > 2 ? 18 : 7)) * 0.25;
        actor.model.shadowDisc.scale.set(s * actor.squashX, s * actor.squashZ, 1);

        if (actor.isPlayer) {
          const ready = canPlayerAimNow(actor);
          const ringMat = actor.model.aimRing.material as THREE.MeshBasicMaterial;
          ringMat.opacity = ready ? 0.75 + Math.sin(nowSec * 6) * 0.2 : 0.2;
          actor.model.aimRing.scale.set(s * 1.08, s * 1.08, 1);
        }

        const haloMat = actor.model.invincibleHalo.material as THREE.MeshBasicMaterial;
        if (actor.invincibleTimer > 0) {
          haloMat.opacity = 0.35 + Math.sin(nowSec * 16) * 0.2;
          actor.model.invincibleHalo.position.y = 0.92 * s;
          actor.model.invincibleHalo.scale.set(s * 1.15, s * 1.15, s * 1.15);
          actor.model.invincibleHalo.rotation.y += dt * 3.0;
        } else {
          haloMat.opacity = 0;
        }
      });

      // Sync 3D Hot Bomb above current bomb holder's head
      if (currentStage === 'hex_bomb_tag') {
        const holder = actors.find((a) => a.id === bombHolderId) || actors[0];
        if (holder) {
          hotBombGroup.position.set(
            holder.body.x,
            holder.body.y + holder.body.radius * 2.25 + 0.55 + Math.sin(nowSec * 10) * 0.12,
            holder.body.z
          );
          const urgency = Math.max(1, (10 - bombTimer) * 2.2);
          const pulse = 1 + Math.sin(nowSec * (6 + urgency * 1.8)) * 0.16;
          hotBombGroup.scale.set(pulse, pulse, pulse);
          hotBombGroup.rotation.y += dt * 3.5;
        }
      }

      // Update 3D Slingshot Aiming Arrow in front of Player
      const player = actors[0];
      if (player && aimDrag.active && aimDrag.powerRatio > 0.02 && canPlayerAimNow(player)) {
        aimArrowGroup.visible = true;
        aimArrowGroup.position.set(player.body.x, player.body.y + 0.06, player.body.z);
        aimArrowGroup.rotation.y = Math.atan2(-aimDrag.dirX, -aimDrag.dirZ);

        const arrowLengthScale = 0.45 + aimDrag.powerRatio * 0.85;
        aimArrowGroup.scale.set(1, 1, arrowLengthScale);

        dashMat.color.setHex(aimDrag.powerRatio > 0.85 ? 0xffe047 : 0xffffff);
      } else {
        aimArrowGroup.visible = false;
      }
    }

    function syncHudSnapshots() {
      const currentStage = stageIdRef.current;
      const ranked = computeLeaderboard(actors);
      const snapshots: HudActorSnapshot[] = ranked.map((actor) => {
        _projVec.set(
          actor.body.x,
          actor.body.y + actor.body.radius * 2.15 + 0.45,
          actor.body.z
        );
        _projVec.project(camera);
        const visibleOnScreen = _projVec.z >= -1 && _projVec.z <= 1;
        const screenX = (_projVec.x + 1) * 0.5;
        const screenY = (1 - _projVec.y) * 0.5;

        return {
          id: actor.id,
          name: actor.name,
          animal: actor.animal,
          score: actor.score,
          level: actor.level,
          levelProgress: actor.levelProgress,
          rank: actor.rank,
          isPlayer: actor.isPlayer,
          canAim: actor.isPlayer ? canPlayerAimNow(actor) : false,
          invincibleTimer: actor.invincibleTimer,
          isBombHolder: currentStage === 'hex_bomb_tag' && actor.id === bombHolderId,
          worldX: actor.body.x,
          worldZ: actor.body.z,
          screenX,
          screenY,
          visibleOnScreen,
          emote: actor.emote,
          popupText: actor.popupText,
        };
      });

      const miniMapStars: MiniMapStarSnapshot[] = starItems.map((s) => ({
        id: s.id,
        x: s.x,
        z: s.z,
        isMega: s.isMega,
        active: s.active,
      }));

      let statusText = STAGE_PRESETS[currentStage].ruleSummaryKo;
      let crownZoneSnap: StageRuntimeStatus['crownZone'] = null;
      let bombHolderName: string | null = null;
      let bombRemainingSec: number | null = null;

      if (currentStage === 'king_of_hill') {
        const wp = CROWN_ZONE_WAYPOINTS[crownWaypointIdx];
        statusText = `현재 왕관 구역: ${wp.labelKo} (${Math.ceil(crownMoveTimer)}초 후 이동)`;
        crownZoneSnap = {
          x: crownX,
          z: crownZ,
          radius: CROWN_ZONE_RADIUS,
          labelKo: wp.labelKo,
        };
      } else if (currentStage === 'sweeper_survival') {
        const isFever = roundRemainingSeconds <= configRef.current.feverThresholdSeconds;
        statusText = isFever
          ? '🔥 피버 초고속 해머 가동 중! 생존 점수 초당 +90점!'
          : '회전 해머 점프 회피! 중앙 섬 생존 시 초당 +45점!';
      } else if (currentStage === 'hex_bomb_tag') {
        const holder = actors.find((a) => a.id === bombHolderId);
        bombHolderName = holder ? holder.name : '없음';
        bombRemainingSec = Math.max(0, bombTimer);
        statusText = `💣 폭탄 보유: ${bombHolderName} (${bombRemainingSec.toFixed(1)}초 전 폭발!)`;
      }

      onHudUpdateRef.current(
        snapshots,
        miniMapStars,
        roundRemainingSeconds,
        { ...aimDrag },
        eventBanner,
        {
          stageId: currentStage,
          statusText,
          crownZone: crownZoneSnap,
          bombHolderName,
          bombRemainingSec,
        }
      );
    }

    function tick() {
      if (isUnmounted) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      stepSimulation(rawDt);
      renderer.render(scene, camera);

      hudSyncAccumulator += rawDt;
      if (hudSyncAccumulator >= 0.08 || aimDrag.active) {
        hudSyncAccumulator = 0;
        syncHudSnapshots();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    syncHudSnapshots();
    frameId = requestAnimationFrame(tick);

    return () => {
      isUnmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDragLaunch);
      window.removeEventListener('pointercancel', clearHeldInputs);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldInputs);
      renderer.dispose();
    };
  }, []);

  // Trigger match reset when restartNonce, stageId, or player customization changes
  useEffect(() => {
    if (resetMatchFnRef.current) {
      resetMatchFnRef.current();
    }
  }, [restartNonce, stageId, playerAnimal, playerName]);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-full overflow-hidden select-none"
      aria-label="3D 아레나 게임 화면"
    />
  );
};
