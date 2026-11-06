/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AnimalType = 'puppy' | 'cat' | 'pig';

export interface GamePhysicsConfig {
  /** Maximum pull distance in screen pixels for 100% launch power */
  maxPullPixels: number;
  /** Minimum pull distance in screen pixels to register a launch */
  minPullPixels: number;
  /** Maximum initial launch speed (units/sec) */
  maxLaunchSpeed: number;
  /** Minimum initial launch speed (units/sec) */
  minLaunchSpeed: number;
  /** Ground damping / friction coefficient (higher = stops faster, tuned so a shot settles in ~1.2s) */
  groundFriction: number;
  /** Air drag coefficient when jumping */
  airFriction: number;
  /** Velocity threshold below which the character snaps to a stop and can aim again */
  stopSpeedThreshold: number;
  /** Speed threshold below which the player is already allowed to start aiming their next shot */
  canAimSpeedThreshold: number;
  /** Base restitution (bounciness) between characters */
  characterRestitution: number;
  /** Extra impulse multiplier on high-speed character collisions for chewy arcade feel */
  collisionBoostMultiplier: number;
  /** Restitution when bouncing off stone obstacles or walls */
  obstacleRestitution: number;
  /** Gravity acceleration (units/sec^2) when airborne / jumping */
  gravity: number;
  /** Base character radius at 0 score */
  baseRadius: number;
  /** Maximum character radius cap so it never blocks the mobile screen */
  maxRadius: number;
  /** Score scaling factor for logarithmic/root growth curve */
  growthScoreScale: number;
  /** Fraction of score lost when falling off the arena (0.2 = 20%) */
  fallScorePenaltyRatio: number;
  /** Invulnerability duration in seconds after respawning */
  respawnInvincibleSeconds: number;
  /** Round duration in seconds (default 60s = 1 minute) */
  roundDurationSeconds: number;
  /** Remaining seconds threshold at which Fever Time (2x score) activates */
  feverThresholdSeconds: number;
  /** Score multiplier during the final Fever Time window */
  feverScoreMultiplier: number;
  /** Arena main circular hub radius */
  arenaRadius: number;
  /** Jump pad upward velocity */
  jumpPadUpVelocity: number;
  /** Jump pad forward velocity toward the upper platform */
  jumpPadForwardSpeed: number;
}

export const DEFAULT_PHYSICS_CONFIG: GamePhysicsConfig = {
  maxPullPixels: 135,
  minPullPixels: 12,
  maxLaunchSpeed: 31.0,
  minLaunchSpeed: 6.8,
  groundFriction: 3.1, // Decelerates from 31 to <2.8 in ~0.85s-1.35s!
  airFriction: 0.35,
  stopSpeedThreshold: 0.65,
  canAimSpeedThreshold: 2.8, // Responsive re-aiming within 1~1.5s
  characterRestitution: 0.92,
  collisionBoostMultiplier: 1.22,
  obstacleRestitution: 0.85,
  gravity: 34.0,
  baseRadius: 0.92,
  maxRadius: 2.15,
  growthScoreScale: 2400,
  fallScorePenaltyRatio: 0.2,
  respawnInvincibleSeconds: 2.0,
  roundDurationSeconds: 60, // 1 minute fast-paced arcade round!
  feverThresholdSeconds: 15, // Final 15 seconds = 2x score!
  feverScoreMultiplier: 2,
  arenaRadius: 20.0, // Expanded central hub (radius 20.0 + 4 outer islands extending to +/-34 units!)
  jumpPadUpVelocity: 16.5,
  jumpPadForwardSpeed: 14.5,
};

export type ObstacleKind = 'central_ruin' | 'pillar' | 'bumper_mushroom' | 'crystal_spire';

export interface ObstacleDef {
  id: string;
  x: number;
  z: number;
  /** Base ground elevation where this obstacle sits */
  baseY?: number;
  radius: number;
  height: number;
  kind: ObstacleKind;
  /** Optional custom restitution multiplier (e.g., 1.48 for bouncy mushrooms) */
  restitutionMultiplier?: number;
}

export interface JumpPadDef {
  id: string;
  x: number;
  z: number;
  baseY?: number;
  radius: number;
  targetX: number;
  targetZ: number;
  targetY: number;
}

export interface PlatformDef {
  id: string;
  nameKo: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  theme: 'sanctuary' | 'blossom' | 'crystal' | 'oasis';
}

export interface BridgeDef {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Axis along which height interpolates from startHeight to endHeight */
  slopeAxis: 'z_north' | 'z_south' | 'x_west' | 'x_east';
  startHeight: number;
  endHeight: number;
  style: 'stone_ramp' | 'wood_bridge' | 'crystal_bridge' | 'oasis_bridge';
}

export interface SpeedZoneDef {
  id: string;
  x: number;
  z: number;
  y: number;
  radius: number;
  dirX: number;
  dirZ: number;
  boostMultiplier: number;
}

/**
 * 4 Outer Themed Islands surrounding the expanded Central Hub (radius 20.0):
 * 1. North Ancient Sanctuary (북쪽 고대 신전 고원, height 3.4)
 * 2. West Blossom & Mushroom Island (서쪽 벚꽃 버섯섬, height 0.4)
 * 3. East Crystal Ruins Terrace (동쪽 마법 수정 고원, height 2.2)
 * 4. South Golden Oasis Islet (남쪽 황금 보물섬, height 0.0)
 */
export const ARENA_PLATFORMS: PlatformDef[] = [
  {
    id: 'north-sanctuary',
    nameKo: '북쪽 고대 신전',
    x: 0,
    z: -26.5,
    radius: 6.5,
    height: 3.4,
    theme: 'sanctuary',
  },
  {
    id: 'west-blossom',
    nameKo: '서쪽 벚꽃 버섯섬',
    x: -27.5,
    z: 0,
    radius: 6.2,
    height: 0.4,
    theme: 'blossom',
  },
  {
    id: 'east-crystal',
    nameKo: '동쪽 마법 수정섬',
    x: 27.5,
    z: 0,
    radius: 6.2,
    height: 2.2,
    theme: 'crystal',
  },
  {
    id: 'south-oasis',
    nameKo: '남쪽 황금 보물섬',
    x: 0,
    z: 26.5,
    radius: 5.6,
    height: 0.0,
    theme: 'oasis',
  },
];

/** Primary raised north platform reference kept for backward compatibility */
export const UPPER_PLATFORM: PlatformDef = ARENA_PLATFORMS[0];

/**
 * Walkable bridges & ramps connecting the Central Hub (radius 20) to all 4 outer islands.
 */
export const ARENA_BRIDGES: BridgeDef[] = [
  {
    id: 'bridge-north-ramp',
    minX: -2.8,
    maxX: 2.8,
    minZ: -21.2,
    maxZ: -17.5,
    slopeAxis: 'z_north',
    startHeight: 0,
    endHeight: 3.4,
    style: 'stone_ramp',
  },
  {
    id: 'bridge-west-wood',
    minX: -22.2,
    maxX: -18.2,
    minZ: -2.6,
    maxZ: 2.6,
    slopeAxis: 'x_west',
    startHeight: 0,
    endHeight: 0.4,
    style: 'wood_bridge',
  },
  {
    id: 'bridge-east-crystal',
    minX: 18.2,
    maxX: 22.2,
    minZ: -2.6,
    maxZ: 2.6,
    slopeAxis: 'x_east',
    startHeight: 0,
    endHeight: 2.2,
    style: 'crystal_bridge',
  },
  {
    id: 'bridge-south-oasis',
    minX: -2.6,
    maxX: 2.6,
    minZ: 18.2,
    maxZ: 21.8,
    slopeAxis: 'z_south',
    startHeight: 0,
    endHeight: 0.0,
    style: 'oasis_bridge',
  },
];

/**
 * Diverse Obstacles across the Central Hub and 4 Outer Islands:
 * - Central mossy ruin
 * - Stone cylindrical pillars
 * - Giant Bouncy Mushrooms (`bumper_mushroom`) with 1.48x super-elastic bounce
 * - Glowing Arcane Crystal Spires (`crystal_spire`) with 1.18x bounce
 */
export const ARENA_OBSTACLES: ObstacleDef[] = [
  // Central Hub Obstacles
  { id: 'center-ruin', x: 0, z: -0.5, baseY: 0, radius: 1.75, height: 1.6, kind: 'central_ruin' },
  { id: 'pillar-nw', x: -7.5, z: -6.8, baseY: 0, radius: 1.1, height: 2.0, kind: 'pillar' },
  { id: 'pillar-ne', x: 7.5, z: -6.8, baseY: 0, radius: 1.1, height: 2.0, kind: 'pillar' },
  { id: 'pillar-sw', x: -7.5, z: 6.8, baseY: 0, radius: 1.1, height: 2.0, kind: 'pillar' },
  { id: 'pillar-se', x: 7.5, z: 6.8, baseY: 0, radius: 1.1, height: 2.0, kind: 'pillar' },

  // Bouncy Mushroom Bumpers on Central Hub & West Blossom Island
  {
    id: 'mushroom-hub-west',
    x: -11.8,
    z: -2.5,
    baseY: 0,
    radius: 1.15,
    height: 1.5,
    kind: 'bumper_mushroom',
    restitutionMultiplier: 1.48,
  },
  {
    id: 'mushroom-hub-south',
    x: 0,
    z: 11.2,
    baseY: 0,
    radius: 1.2,
    height: 1.55,
    kind: 'bumper_mushroom',
    restitutionMultiplier: 1.48,
  },
  {
    id: 'mushroom-west-1',
    x: -26.2,
    z: -2.8,
    baseY: 0.4,
    radius: 1.1,
    height: 1.5,
    kind: 'bumper_mushroom',
    restitutionMultiplier: 1.52,
  },
  {
    id: 'mushroom-west-2',
    x: -26.2,
    z: 2.8,
    baseY: 0.4,
    radius: 1.1,
    height: 1.5,
    kind: 'bumper_mushroom',
    restitutionMultiplier: 1.52,
  },

  // Crystal Spires on Central Hub & East Crystal Terrace
  {
    id: 'crystal-hub-east',
    x: 11.8,
    z: 2.5,
    baseY: 0,
    radius: 1.1,
    height: 2.1,
    kind: 'crystal_spire',
    restitutionMultiplier: 1.18,
  },
  {
    id: 'crystal-east-1',
    x: 26.2,
    z: -2.8,
    baseY: 2.2,
    radius: 1.05,
    height: 2.2,
    kind: 'crystal_spire',
    restitutionMultiplier: 1.2,
  },
  {
    id: 'crystal-east-2',
    x: 26.2,
    z: 2.8,
    baseY: 2.2,
    radius: 1.05,
    height: 2.2,
    kind: 'crystal_spire',
    restitutionMultiplier: 1.2,
  },
];

/**
 * 5 Jump Pads launching characters across islands and high platforms!
 */
export const ARENA_JUMP_PADS: JumpPadDef[] = [
  {
    id: 'jump-pad-ne-to-sanctuary',
    x: 10.5,
    z: -9.5,
    baseY: 0,
    radius: 1.5,
    targetX: 0,
    targetZ: -26.5,
    targetY: 3.4,
  },
  {
    id: 'jump-pad-nw-to-west',
    x: -11.5,
    z: 4.5,
    baseY: 0,
    radius: 1.5,
    targetX: -27.5,
    targetZ: 0,
    targetY: 0.4,
  },
  {
    id: 'jump-pad-se-to-east',
    x: 11.5,
    z: -3.2,
    baseY: 0,
    radius: 1.5,
    targetX: 27.5,
    targetZ: 0,
    targetY: 2.2,
  },
  {
    id: 'jump-pad-west-to-center',
    x: -24.5,
    z: 0,
    baseY: 0.4,
    radius: 1.35,
    targetX: -4.5,
    targetZ: 0,
    targetY: 0,
  },
  {
    id: 'jump-pad-south-to-center',
    x: 0,
    z: 23.8,
    baseY: 0,
    radius: 1.35,
    targetX: 0,
    targetZ: 4.5,
    targetY: 0,
  },
];

/**
 * Glowing Floor Speed Dash Pads that accelerate sliding characters toward outer islands or across the hub.
 */
export const ARENA_SPEED_ZONES: SpeedZoneDef[] = [
  { id: 'dash-north', x: 0, z: -9.5, y: 0, radius: 1.6, dirX: 0, dirZ: -1, boostMultiplier: 1.42 },
  { id: 'dash-west', x: -14.2, z: 0, y: 0, radius: 1.55, dirX: -1, dirZ: 0, boostMultiplier: 1.42 },
  { id: 'dash-east', x: 14.2, z: 0, y: 0, radius: 1.55, dirX: 1, dirZ: 0, boostMultiplier: 1.42 },
  { id: 'dash-south', x: 0, z: 15.0, y: 0, radius: 1.55, dirX: 0, dirZ: 1, boostMultiplier: 1.42 },
];

export interface CharacterPreset {
  type: AnimalType;
  nameKo: string;
  subtitleKo: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export const CHARACTER_PRESETS: Record<AnimalType, CharacterPreset> = {
  puppy: {
    type: 'puppy',
    nameKo: '시바견 뭉치',
    subtitleKo: '크림색 볼살과 빨간 뼈다귀 목걸이',
    primaryColor: '#F6B26B',
    secondaryColor: '#FFF5E4',
    accentColor: '#E04F5F',
  },
  cat: {
    type: 'cat',
    nameKo: '회색냥이 루루',
    subtitleKo: '쫑긋한 삼각형 귀와 줄무늬 이마',
    primaryColor: '#8E8D9A',
    secondaryColor: '#F5F4F8',
    accentColor: '#FFB5C2',
  },
  pig: {
    type: 'pig',
    nameKo: '분홍돼지 꿀꿀',
    subtitleKo: '말랑한 분홍 몸통과 동그란 코',
    primaryColor: '#F9A8C9',
    secondaryColor: '#FFD6E7',
    accentColor: '#F26B9A',
  },
};

export const AI_BOT_PROFILES: Array<{
  id: string;
  name: string;
  animal: AnimalType;
  personality: 'collector' | 'brawler' | 'platform_hunter';
}> = [
  { id: 'bot-1', name: '멍멍이왕', animal: 'puppy', personality: 'collector' },
  { id: 'bot-2', name: '치즈냥이', animal: 'cat', personality: 'platform_hunter' },
  { id: 'bot-3', name: '꿀꿀이', animal: 'pig', personality: 'brawler' },
];

export type StageId = 'star_rush' | 'king_of_hill' | 'sweeper_survival' | 'hex_bomb_tag';

export interface StagePreset {
  id: StageId;
  roundBadgeKo: string;
  titleKo: string;
  subtitleKo: string;
  ruleSummaryKo: string;
  bannerColor: string;
  accentColor: string;
}

export const STAGE_ORDER: StageId[] = [
  'star_rush',
  'king_of_hill',
  'sweeper_survival',
  'hex_bomb_tag',
];

export const STAGE_PRESETS: Record<StageId, StagePreset> = {
  star_rush: {
    id: 'star_rush',
    roundBadgeKo: 'ROUND 1 · 수집 레이스',
    titleKo: '별빛 군도 대소동',
    subtitleKo: '5개 섬의 별과 슈퍼 스타를 가장 많이 모으세요!',
    ruleSummaryKo: '별 코인(+140~180)과 외곽 섬 슈퍼 스타(+380~450) 수집 · 마지막 15초 점수 2배!',
    bannerColor: '#FFE144',
    accentColor: '#FF8A3D',
  },
  king_of_hill: {
    id: 'king_of_hill',
    roundBadgeKo: 'ROUND 2 · 구역 점령전',
    titleKo: '왕관 구역 쟁탈전',
    subtitleKo: '이동하는 황금 왕관 링 안을 지키고 라이벌을 밀어내세요!',
    ruleSummaryKo: '황금 왕관 링 안에 머물면 초당 +90점(피버 시 +180점) 실시간 획득 · 몸싸움으로 독점!',
    bannerColor: '#FFB800',
    accentColor: '#9B7EDE',
  },
  sweeper_survival: {
    id: 'sweeper_survival',
    roundBadgeKo: 'ROUND 3 · 점프 클럽 서바이벌',
    titleKo: '빙글빙글 스원 해머',
    subtitleKo: '점점 빨라지는 거대 회전 바를 피하며 끝까지 살아남으세요!',
    ruleSummaryKo: '생존 시 초당 +45점 자동 획득 · 회전 해머 바에 맞으면 장외로 강하게 넉백!',
    bannerColor: '#FF5D8F',
    accentColor: '#00BBF9',
  },
  hex_bomb_tag: {
    id: 'hex_bomb_tag',
    roundBadgeKo: 'ROUND 4 · 폭탄 술래잡기',
    titleKo: '아슬아슬 시한폭탄 태그',
    subtitleKo: '박치기로 시한폭탄을 상대에게 넘기고 폭발을 피하세요!',
    ruleSummaryKo: '충돌 시 폭탄 전이 · 10초마다 폭발(보유자 -220점, 생존자 전원 +180점 보너스!)',
    bannerColor: '#FF6B35',
    accentColor: '#52D62A',
  },
};

export const CROWN_ZONE_WAYPOINTS: Array<{
  x: number;
  y: number;
  z: number;
  radius: number;
  labelKo: string;
}> = [
  { x: 0, y: 0, z: -6.2, radius: 4.8, labelKo: '중앙 북쪽 광장' },
  { x: -8.5, y: 0, z: 0, radius: 4.8, labelKo: '서쪽 광장' },
  { x: 8.5, y: 0, z: 0, radius: 4.8, labelKo: '동쪽 광장' },
  { x: 0, y: 0, z: 6.5, radius: 4.8, labelKo: '남쪽 광장' },
  { x: 0, y: 3.4, z: -26.5, radius: 4.6, labelKo: '북쪽 고대 신전' },
];


