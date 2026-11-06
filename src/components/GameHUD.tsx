/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AnimalType,
  ARENA_PLATFORMS,
  CHARACTER_PRESETS,
  DEFAULT_PHYSICS_CONFIG,
  GamePhysicsConfig,
  STAGE_ORDER,
  STAGE_PRESETS,
  StageId,
} from '../game/config';
import {
  AimDragOverlayState,
  CameraViewMode,
  GameState,
  HudActorSnapshot,
  MiniMapStarSnapshot,
  RoundSummary,
  StageRuntimeStatus,
} from './GameCanvas';

interface GameHUDProps {
  gameState: GameState;
  stageId: StageId;
  stageStatus: StageRuntimeStatus;
  cameraMode: CameraViewMode;
  actors: HudActorSnapshot[];
  stars: MiniMapStarSnapshot[];
  remainingSeconds: number;
  aimState: AimDragOverlayState;
  eventBanner: string | null;
  playerAnimal: AnimalType;
  playerName: string;
  physicsConfig: GamePhysicsConfig;
  isMuted: boolean;
  showTuningModal: boolean;
  roundSummary: RoundSummary | null;
  onSelectStage: (stage: StageId) => void;
  onNextStage: () => void;
  onSelectAnimal: (animal: AnimalType) => void;
  onChangePlayerName: (name: string) => void;
  onStartGame: () => void;
  onPauseToggle: () => void;
  onRestartGame: () => void;
  onReturnTitle: () => void;
  onToggleMute: () => void;
  onToggleCameraMode: () => void;
  onToggleTuningModal: () => void;
  onUpdatePhysicsConfig: (next: GamePhysicsConfig) => void;
}

/**
 * Cute SVG Avatar badge for each animal type (Puppy, Cat, Pig) matching the reference HUD icons
 */
export const AnimalAvatarIcon: React.FC<{ animal: AnimalType; size?: number }> = ({
  animal,
  size = 26,
}) => {
  if (animal === 'puppy') {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <circle cx="18" cy="19" r="14" fill="#F5AD56" stroke="#2B1E1A" strokeWidth="2.5" />
        <path d="M7 12 L10 4 L16 9 Z" fill="#F5AD56" stroke="#2B1E1A" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M29 12 L26 4 L20 9 Z" fill="#F5AD56" stroke="#2B1E1A" strokeWidth="2.2" strokeLinejoin="round" />
        <ellipse cx="18" cy="23" rx="10" ry="7.5" fill="#FFF6E6" />
        <circle cx="13.5" cy="18" r="2" fill="#2B1E1A" />
        <circle cx="22.5" cy="18" r="2" fill="#2B1E1A" />
        <ellipse cx="18" cy="20.5" rx="2.2" ry="1.5" fill="#2B1E1A" />
      </svg>
    );
  }
  if (animal === 'cat') {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <circle cx="18" cy="19" r="14" fill="#8B8999" stroke="#2B1E1A" strokeWidth="2.5" />
        <path d="M6 13 L8 4 L15 9 Z" fill="#8B8999" stroke="#2B1E1A" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M30 13 L28 4 L21 9 Z" fill="#8B8999" stroke="#2B1E1A" strokeWidth="2.2" strokeLinejoin="round" />
        <ellipse cx="18" cy="23.5" rx="9.5" ry="7" fill="#F7F6FA" />
        <circle cx="13.5" cy="18.5" r="2" fill="#2B1E1A" />
        <circle cx="22.5" cy="18.5" r="2" fill="#2B1E1A" />
        <polygon points="16,20 20,20 18,22.2" fill="#FF8DA1" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="19" r="14" fill="#F9A8C9" stroke="#2B1E1A" strokeWidth="2.5" />
      <path d="M6 13 L7 5 L14 9 Z" fill="#F794BE" stroke="#2B1E1A" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M30 13 L29 5 L22 9 Z" fill="#F794BE" stroke="#2B1E1A" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="13" cy="17.5" r="2" fill="#2B1E1A" />
      <circle cx="23" cy="17.5" r="2" fill="#2B1E1A" />
      <ellipse cx="18" cy="21.5" rx="4.5" ry="3.2" fill="#F46C9B" stroke="#2B1E1A" strokeWidth="1.8" />
      <circle cx="16.5" cy="21.5" r="1" fill="#4A152B" />
      <circle cx="19.5" cy="21.5" r="1" fill="#4A152B" />
    </svg>
  );
};

export const GameHUD: React.FC<GameHUDProps> = ({
  gameState,
  stageId,
  stageStatus,
  cameraMode,
  actors,
  stars,
  remainingSeconds,
  aimState,
  eventBanner,
  playerAnimal,
  playerName,
  physicsConfig,
  isMuted,
  showTuningModal,
  roundSummary,
  onSelectStage,
  onNextStage,
  onSelectAnimal,
  onChangePlayerName,
  onStartGame,
  onPauseToggle,
  onRestartGame,
  onReturnTitle,
  onToggleMute,
  onToggleCameraMode,
  onToggleTuningModal,
  onUpdatePhysicsConfig,
}) => {
  const currentStagePreset = STAGE_PRESETS[stageId];
  const playerSnap = actors.find((a) => a.isPlayer) || {
    id: 'player',
    name: playerName || '나',
    animal: playerAnimal,
    score: 0,
    level: 1,
    levelProgress: 0,
    rank: 1,
    isPlayer: true,
    canAim: true,
    invincibleTimer: 0,
    worldX: 0,
    worldZ: 6.2,
    screenX: 0.5,
    screenY: 0.6,
    visibleOnScreen: true,
    emote: null,
    popupText: null,
  };

  const minutes = Math.floor(Math.max(0, remainingSeconds) / 60);
  const seconds = Math.floor(Math.max(0, remainingSeconds) % 60);
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between overflow-hidden">
      {/* 1. Floating 3D-Projected Character Labels & Emotes (during active play) */}
      {gameState === 'playing' && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {actors.map((actor) => {
            if (!actor.visibleOnScreen) return null;
            const rankColors: Record<number, string> = {
              1: '#FFB800',
              2: '#A879FF',
              3: '#FF8A3D',
              4: '#52C41A',
            };
            const badgeBg = rankColors[actor.rank] || '#52C41A';

            return (
              <div
                key={actor.id}
                style={{
                  transform: `translate3d(${actor.screenX * 100}vw, ${actor.screenY * 100}vh, 0) translate(-50%, -100%)`,
                }}
                className="absolute top-0 left-0 flex flex-col items-center pointer-events-none will-change-transform"
              >
                {/* Floating Score Delta Popup */}
                {actor.popupText && (
                  <div className="mb-0.5 font-display text-sm font-bold text-amber-300 text-stroke-sm animate-bounce">
                    {actor.popupText}
                  </div>
                )}

                {/* Comic Emote Alert ("!!" + yellow comic burst on impact) */}
                {actor.emote === 'bang' && (
                  <div className="mb-1 flex items-center gap-1 font-display text-lg font-extrabold text-rose-500 text-stroke-sm">
                    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
                      <polygon
                        points="16,1 20,10 30,7 24,15 31,23 21,22 18,31 13,22 3,25 9,16 2,8 12,10"
                        fill="#FFE144"
                        stroke="#231815"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>!!</span>
                  </div>
                )}

                {/* Name Pill + Rank Circle (+ Bomb Holder Indicator in Hex Bomb Tag) */}
                <div
                  className={`flex items-center gap-1 border-2 border-[#231815] rounded-full pr-2.5 pl-0.5 py-0.5 shadow-md ${
                    actor.isBombHolder ? 'bg-rose-600 animate-pulse' : 'bg-[#231815]/88'
                  }`}
                >
                  <span
                    style={{ backgroundColor: badgeBg }}
                    className="w-5 h-5 rounded-full border border-[#231815] flex items-center justify-center font-display text-xs font-bold text-white"
                  >
                    {actor.rank}
                  </span>
                  <span className="font-display text-xs text-white tracking-wide whitespace-nowrap">
                    {actor.isBombHolder ? `💣 ${actor.name}` : actor.name}
                  </span>
                </div>

                {/* Yellow Outlined Score Under Name */}
                <div className="font-display text-sm font-bold text-[#FFE144] text-stroke-sm tabular-nums -mt-0.5">
                  {actor.score.toLocaleString()}
                </div>

                {/* Green Player Indicator Chevron */}
                {actor.isPlayer && (
                  <svg
                    width="14"
                    height="10"
                    viewBox="0 0 14 10"
                    className="-mt-0.5"
                    aria-hidden="true"
                  >
                    <polygon
                      points="1,1 13,1 7,9"
                      fill="#52D62A"
                      stroke="#1F3B12"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            );
          })}

          {/* 2D Slingshot Forward Dashed Trajectory Arrow + Drag Handle Ring (matches reference image!) */}
          {aimState.active && (
            <svg className="fixed inset-0 w-full h-full pointer-events-none" aria-hidden="true">
              <defs>
                <marker
                  id="aim-arrowhead"
                  markerWidth="6"
                  markerHeight="6"
                  refX="4.5"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0.5, 5.5 3, 0 5.5"
                    fill="#FFFFFF"
                    stroke="#231815"
                    strokeWidth="0.8"
                  />
                </marker>
              </defs>
              {aimState.powerRatio > 0.02 && (
                <>
                  {/* Dark outer stroke for forward trajectory line */}
                  <line
                    x1={`${playerSnap.screenX * 100}%`}
                    y1={`${playerSnap.screenY * 100 + 4}%`}
                    x2={`calc(${playerSnap.screenX * 100}% + ${aimState.dirX * (55 + aimState.powerRatio * 105)}px)`}
                    y2={`calc(${playerSnap.screenY * 100 + 4}% + ${aimState.dirZ * (55 + aimState.powerRatio * 105)}px)`}
                    stroke="#231815"
                    strokeWidth="9"
                    strokeDasharray="11 8"
                    strokeLinecap="round"
                  />
                  {/* Crisp white dashed trajectory arrow pointing in launch direction */}
                  <line
                    x1={`${playerSnap.screenX * 100}%`}
                    y1={`${playerSnap.screenY * 100 + 4}%`}
                    x2={`calc(${playerSnap.screenX * 100}% + ${aimState.dirX * (55 + aimState.powerRatio * 105)}px)`}
                    y2={`calc(${playerSnap.screenY * 100 + 4}% + ${aimState.dirZ * (55 + aimState.powerRatio * 105)}px)`}
                    stroke="#FFFFFF"
                    strokeWidth="5"
                    strokeDasharray="11 8"
                    strokeLinecap="round"
                    markerEnd="url(#aim-arrowhead)"
                  />
                </>
              )}
              {/* Pull-back drag line & touch ring */}
              <line
                x1={aimState.startX}
                y1={aimState.startY}
                x2={aimState.currentX}
                y2={aimState.currentY}
                stroke="rgba(255, 255, 255, 0.75)"
                strokeWidth="3.5"
                strokeDasharray="6 6"
              />
              <circle
                cx={aimState.startX}
                cy={aimState.startY}
                r="12"
                fill="rgba(255, 255, 255, 0.25)"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
              <circle
                cx={aimState.currentX}
                cy={aimState.currentY}
                r="24"
                fill="rgba(255, 225, 68, 0.32)"
                stroke="#FFFFFF"
                strokeWidth="3.5"
              />
            </svg>
          )}
        </div>
      )}

      {/* 2. Top Perimeter HUD Bar (Zero horizontal overflow on 390px mobile!) */}
      {gameState !== 'title' && (
        <div className="w-full max-w-[540px] mx-auto px-2.5 pt-2.5 flex flex-col gap-2 pointer-events-none">
          {/* Row 1: Pause/Mute (Left) — Countdown Timer (Center) — Physics Settings (Right) */}
          <div className="relative w-full flex items-center justify-between">
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPauseToggle();
                }}
                aria-label="일시정지"
                className="w-10 h-10 rounded-xl bg-[#3B3344]/92 hover:bg-[#4B4156] border-2 border-[#231815] shadow-[0_3px_0_#231815] flex items-center justify-center text-white active:translate-y-0.5 transition-transform cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="4" width="4.5" height="16" rx="1.5" />
                  <rect x="13.5" y="4" width="4.5" height="16" rx="1.5" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                aria-label={isMuted ? '사운드 켜기' : '사운드 끄기'}
                className="w-10 h-10 rounded-xl bg-[#3B3344]/92 hover:bg-[#4B4156] border-2 border-[#231815] shadow-[0_3px_0_#231815] flex items-center justify-center text-white active:translate-y-0.5 transition-transform cursor-pointer"
              >
                {isMuted ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>
            </div>

            {/* Centered Timer Pill (with 2x Fever Badge during final 15s) */}
            <div
              className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-[#231815] shadow-[0_3px_0_#231815] transition-colors ${
                remainingSeconds <= physicsConfig.feverThresholdSeconds
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-[#2C2533]/92 text-white'
              }`}
              aria-label="남은 시간"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2.5" />
                <path d="M9 2h6" />
              </svg>
              <span className="font-display text-lg tracking-wider tabular-nums" data-testid="timer-readout">
                {formattedTime}
              </span>
              {remainingSeconds <= physicsConfig.feverThresholdSeconds && (
                <span
                  data-testid="fever-badge"
                  className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#FFE144] text-[#231815] font-display text-[10px] font-extrabold leading-none border border-[#231815]"
                >
                  x2배
                </span>
              )}
            </div>

            {/* Right: Camera Mode Toggle + Compact Physics Settings Button */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                data-testid="camera-mode-toggle"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleCameraMode();
                }}
                aria-label={cameraMode === 'follow' ? '전체 맵 시점으로 전환' : '캐릭터 추적 시점으로 전환'}
                className="px-2.5 h-10 rounded-xl bg-[#3B3344]/92 hover:bg-[#4B4156] border-2 border-[#231815] shadow-[0_3px_0_#231815] flex items-center gap-1 text-sky-300 font-display text-xs active:translate-y-0.5 transition-transform cursor-pointer whitespace-nowrap shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                </svg>
                <span>{cameraMode === 'follow' ? '추적 시점' : '전체 맵'}</span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleTuningModal();
                }}
                aria-label="물리 설정 열기"
                className="px-2.5 h-10 rounded-xl bg-[#3B3344]/92 hover:bg-[#4B4156] border-2 border-[#231815] shadow-[0_3px_0_#231815] flex items-center gap-1 text-amber-300 font-display text-xs active:translate-y-0.5 transition-transform cursor-pointer whitespace-nowrap shrink-0"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                </svg>
                <span>물리</span>
              </button>
            </div>
          </div>

          {/* Row 1.5: Fall Guys Stage Rule & Live Gimmick Banner Pill */}
          <div
            data-testid="stage-rule-banner"
            className="w-full flex items-center justify-between gap-2 px-3 py-1 rounded-2xl bg-[#251E2E]/92 border-2 border-[#231815] shadow-[0_3px_0_#231815] pointer-events-auto"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                style={{ backgroundColor: currentStagePreset.accentColor }}
                className="px-2 py-0.5 rounded-full border border-[#231815] font-display text-[10px] font-extrabold text-[#231815] shrink-0"
              >
                {currentStagePreset.roundBadgeKo}
              </span>
              <span className="font-display text-xs text-white whitespace-nowrap shrink-0">
                {currentStagePreset.titleKo}
              </span>
              <span className="text-[11px] font-bold text-amber-200 truncate">
                · {stageStatus.statusText}
              </span>
            </div>
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-next-stage-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onNextStage();
              }}
              className="px-2 py-0.5 rounded-lg bg-[#FFE144] hover:bg-amber-300 border border-[#231815] font-display text-[10px] text-[#231815] whitespace-nowrap shrink-0 cursor-pointer active:translate-y-0.5"
            >
              다음 스테이지 ▸
            </button>
          </div>

          {/* Row 2: Live 4-Row Leaderboard on Left + Interactive 5-Island Mini-Map & Event Toast on Right */}
          <div className="w-full flex items-start justify-between gap-2">
            <div
              className="flex flex-col gap-1 w-40 pointer-events-auto shrink-0"
              aria-label="실시간 순위표"
              data-testid="live-leaderboard"
            >
              {actors.map((entry) => {
                const isMe = entry.isPlayer;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between px-2 py-0.5 rounded-xl border-2 transition-colors ${
                      isMe
                        ? 'bg-[#FFE144] border-[#231815] text-[#231815] font-bold shadow-[0_2px_0_#231815]'
                        : 'bg-[#25202B]/88 border-[#231815]/85 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      {entry.rank === 1 ? (
                        <span
                          className="w-4 h-4 rounded bg-amber-400 border border-[#231815] flex items-center justify-center font-display text-[11px] text-[#231815] shrink-0"
                          title="1위"
                        >
                          1
                        </span>
                      ) : (
                        <span
                          className={`w-4 text-center font-display text-xs shrink-0 ${
                            isMe ? 'text-[#231815]' : 'text-amber-200'
                          }`}
                        >
                          {entry.rank}
                        </span>
                      )}
                      <AnimalAvatarIcon animal={entry.animal} size={18} />
                      <span className="font-display text-xs truncate">{entry.name}</span>
                    </div>
                    <span
                      className={`font-display text-xs tabular-nums ml-1.5 shrink-0 ${
                        isMe ? 'text-[#231815]' : 'text-white'
                      }`}
                    >
                      {entry.score.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Interactive 5-Island Mini-Map Radar + Event Toast */}
            <div className="flex flex-col items-end gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleCameraMode();
                }}
                title="클릭하여 시점 전환 (추적 / 전체 맵)"
                aria-label="아레나 미니맵 (클릭 시 카메라 시점 전환)"
                data-testid="arena-minimap"
                className="pointer-events-auto w-24 h-24 rounded-2xl bg-[#1A293B]/90 border-2 border-[#231815] shadow-[0_3px_0_#231815] p-1 relative overflow-hidden cursor-pointer active:translate-y-0.5 transition-transform"
              >
                <svg viewBox="-38 -38 76 76" className="w-full h-full overflow-visible">
                  {/* Connecting Bridges */}
                  <rect x="-2.8" y="-21.5" width="5.6" height="5" fill="#B5A6B2" />
                  <rect x="-22.5" y="-2.6" width="5" height="5.2" fill="#C98A4B" />
                  <rect x="17.5" y="-2.6" width="5" height="5.2" fill="#72EFDD" />
                  <rect x="-2.6" y="17.5" width="5.2" height="5" fill="#B5A6B2" />

                  {/* Central Hub Island */}
                  <circle
                    cx="0"
                    cy="0"
                    r={physicsConfig.arenaRadius}
                    fill="#88BE58"
                    stroke="#E2D9E0"
                    strokeWidth="1.4"
                  />
                  <circle cx="0" cy="0" r={physicsConfig.arenaRadius * 0.62} fill="none" stroke="#A8949E" strokeWidth="2.2" />

                  {/* 4 Outer Themed Islands */}
                  {ARENA_PLATFORMS.map((plat) => {
                    const fill =
                      plat.theme === 'sanctuary'
                        ? '#9B7EDE'
                        : plat.theme === 'blossom'
                        ? '#FF9EBB'
                        : plat.theme === 'crystal'
                        ? '#48BFE3'
                        : '#F9C74F';
                    return (
                      <circle
                        key={plat.id}
                        cx={plat.x}
                        cy={plat.z}
                        r={plat.radius}
                        fill={fill}
                        stroke="#231815"
                        strokeWidth="1.2"
                      />
                    );
                  })}

                  {/* Active Crown Zone on Mini-Map (in King of the Hill stage) */}
                  {stageStatus.crownZone && (
                    <circle
                      cx={stageStatus.crownZone.x}
                      cy={stageStatus.crownZone.z}
                      r={stageStatus.crownZone.radius}
                      fill="rgba(255, 225, 68, 0.45)"
                      stroke="#FFE144"
                      strokeWidth="1.6"
                    />
                  )}

                  {/* Active Stars on Mini-Map */}
                  {stars.map((s) => {
                    if (!s.active) return null;
                    return (
                      <circle
                        key={s.id}
                        cx={s.x}
                        cy={s.z}
                        r={s.isMega ? 2.4 : 1.3}
                        fill={s.isMega ? '#FFE144' : '#FFF3B0'}
                        stroke="#231815"
                        strokeWidth="0.6"
                      />
                    );
                  })}

                  {/* AI Bots & Player Dots */}
                  {actors.map((actor) => (
                    <circle
                      key={actor.id}
                      cx={actor.worldX}
                      cy={actor.worldZ}
                      r={actor.isPlayer ? 3.2 : 2.3}
                      fill={
                        actor.isBombHolder
                          ? '#FF2A55'
                          : actor.isPlayer
                          ? '#52D62A'
                          : '#FF5D8F'
                      }
                      stroke="#FFFFFF"
                      strokeWidth={actor.isPlayer ? '1.3' : '0.9'}
                    />
                  ))}
                </svg>
                <span className="absolute bottom-0.5 right-1.5 font-display text-[9px] text-white/90 text-stroke-sm">
                  5개 섬 맵
                </span>
              </button>

              {eventBanner && (
                <div className="px-2.5 py-1 rounded-xl bg-[#231815]/88 text-amber-300 font-display text-[11px] border border-amber-400/50 shadow-sm max-w-[185px] text-right leading-tight">
                  {eventBanner}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Bottom HUD Bar (Star Level Bar, Current Score, and Quick Restart — zero skill button clutter!) */}
      {gameState !== 'title' && (
        <div className="w-full max-w-[540px] mx-auto px-3 pb-3 flex items-center justify-between gap-3 pointer-events-none">
          {/* Star Level & Growth Progress Bar (matches bottom-left of reference image) */}
          <div className="flex-1 flex items-center bg-[#2C2533]/92 border-2 border-[#231815] rounded-2xl p-1.5 shadow-[0_4px_0_#231815] pointer-events-auto">
            {/* Big Golden Star Badge */}
            <div className="w-10 h-10 -ml-1 -my-1 rounded-xl bg-amber-400 border-2 border-[#231815] flex items-center justify-center shrink-0 shadow-inner">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFF3B0" stroke="#231815" strokeWidth="2" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>

            <div className="ml-2.5 flex items-center gap-2 flex-1 min-w-0 pr-2">
              <span className="font-display text-base text-white whitespace-nowrap shrink-0">
                Lv.{playerSnap.level}
              </span>

              {/* Segmented Yellow Growth Progress Bar */}
              <div className="flex-1 h-4 bg-[#19141E] rounded-lg border border-[#231815] overflow-hidden p-0.5">
                <div
                  style={{ width: `${Math.max(8, Math.round(playerSnap.levelProgress * 100))}%` }}
                  className="h-full bg-[#FFE144] rounded-sm transition-all duration-150"
                />
              </div>

              <div className="flex items-baseline gap-1 shrink-0">
                <span className="text-[11px] font-bold text-amber-200">점수</span>
                <span
                  className="font-display text-base text-[#FFE144] tabular-nums"
                  data-testid="player-score"
                >
                  {playerSnap.score.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Clean Restart Match Button */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRestartGame();
            }}
            aria-label="게임 재시작"
            className="px-4 h-12 rounded-2xl bg-[#FF8A3D] hover:bg-[#FF9B57] text-[#231815] font-display text-sm border-2 border-[#231815] shadow-[0_4px_0_#231815] active:translate-y-0.5 transition-transform pointer-events-auto cursor-pointer whitespace-nowrap shrink-0"
          >
            다시 시작
          </button>
        </div>
      )}

      {/* 4. Title Screen Stage Overlay (`document.body.dataset.state = 'title'`) */}
      {gameState === 'title' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-3 pointer-events-auto bg-[#121826]/45">
          <div className="w-full max-w-[450px] max-h-[95vh] overflow-y-auto rounded-3xl bg-[#FFF9EC] border-4 border-[#231815] shadow-[0_10px_0_#231815] p-4 flex flex-col items-center text-[#231815]">
            {/* Custom Inline SVG Arcade Emblem Lockup */}
            <div className="w-full flex flex-col items-center mb-2">
              <svg
                viewBox="0 0 360 84"
                className="w-full max-w-[310px] h-auto overflow-visible"
                role="img"
                aria-label="튕기고, 먹고, 커져라!"
              >
                <defs>
                  <filter id="titleShadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="4" stdDeviation="0" floodColor="#231815" />
                  </filter>
                </defs>
                <rect
                  x="16"
                  y="8"
                  width="328"
                  height="64"
                  rx="22"
                  fill="#FFE144"
                  stroke="#231815"
                  strokeWidth="5"
                  filter="url(#titleShadow)"
                />
                <circle cx="42" cy="40" r="10" fill="#FF8A3D" stroke="#231815" strokeWidth="3" />
                <circle cx="318" cy="40" r="10" fill="#52D62A" stroke="#231815" strokeWidth="3" />
                <text
                  x="180"
                  y="50"
                  textAnchor="middle"
                  className="font-display"
                  fontSize="30"
                  fontWeight="800"
                  fill="#FFFFFF"
                  stroke="#231815"
                  strokeWidth="7"
                  paintOrder="stroke fill"
                >
                  튕기고, 먹고, 커져라!
                </text>
              </svg>
              <p className="text-[11px] font-bold text-[#5C4B44] mt-0.5 text-center">
                폴가이즈 스타일 4종 스테이지 · 알까기 슬링샷 서바이벌!
              </p>
            </div>

            {/* Key Art Banner Thumbnail from Attached Asset */}
            <div className="w-full h-24 rounded-2xl border-2 border-[#231815] overflow-hidden mb-2.5 relative bg-[#7CE8FF] shrink-0">
              <img
                src="/assets/aistudio/image_3d82fdac.png"
                alt="튕기고 먹고 커져라 아레나 일러스트"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute bottom-1.5 right-2 bg-[#231815]/88 text-amber-300 font-display text-[10px] px-2.5 py-0.5 rounded-full">
                1분 스피드 라운드 · 마지막 15초 점수 2배!
              </div>
            </div>

            {/* Fall Guys 4-Stage Selection Cards */}
            <div className="w-full mb-2.5" data-testid="stage-selector-grid">
              <div className="flex items-center justify-between mb-1">
                <span className="font-display text-xs text-[#231815]">
                  폴가이즈 스테이지 규칙 선택 (4종)
                </span>
                <span className="font-display text-[11px] text-amber-700">
                  {currentStagePreset.roundBadgeKo} 선택됨
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {STAGE_ORDER.map((sId) => {
                  const st = STAGE_PRESETS[sId];
                  const isSelected = stageId === sId;
                  return (
                    <button
                      key={sId}
                      type="button"
                      data-testid={`stage-card-${sId}`}
                      onClick={() => onSelectStage(sId)}
                      aria-pressed={isSelected}
                      className={`flex flex-col items-start p-2 rounded-2xl border-2 text-left transition-transform cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFE144] border-[#231815] shadow-[0_3px_0_#231815] -translate-y-0.5'
                          : 'bg-white border-[#D6C7B8] hover:border-[#231815]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-0.5">
                        <span
                          style={{ backgroundColor: st.accentColor }}
                          className="px-1.5 py-0.2 rounded-full border border-[#231815] font-display text-[9px] font-extrabold text-[#231815]"
                        >
                          {st.roundBadgeKo}
                        </span>
                      </div>
                      <div className="font-display text-xs text-[#231815] leading-snug">
                        {st.titleKo}
                      </div>
                      <div className="text-[10px] font-semibold text-[#5C4B44] leading-tight mt-0.5 line-clamp-2">
                        {st.ruleSummaryKo}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Character Selection Cards (Puppy, Cat, Pig) + Nickname Row */}
            <div className="w-full mb-2.5">
              <div className="font-display text-xs text-[#231815] mb-1">
                동물 캐릭터 및 닉네임
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {(['puppy', 'cat', 'pig'] as AnimalType[]).map((type) => {
                  const preset = CHARACTER_PRESETS[type];
                  const selected = playerAnimal === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onSelectAnimal(type)}
                      aria-pressed={selected}
                      className={`flex flex-col items-center p-2 rounded-2xl border-2 transition-transform cursor-pointer ${
                        selected
                          ? 'bg-[#FFE144] border-[#231815] shadow-[0_3px_0_#231815] -translate-y-0.5'
                          : 'bg-white border-[#D6C7B8] hover:border-[#231815]'
                      }`}
                    >
                      <AnimalAvatarIcon animal={type} size={32} />
                      <span className="font-display text-[11px] mt-1 text-[#231815] whitespace-nowrap">
                        {preset.nameKo}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="player-nickname-input"
                  className="font-display text-xs text-[#5C4B44] whitespace-nowrap shrink-0"
                >
                  닉네임
                </label>
                <input
                  id="player-nickname-input"
                  type="text"
                  maxLength={8}
                  value={playerName}
                  onChange={(e) => onChangePlayerName(e.target.value)}
                  placeholder="나"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white border-2 border-[#231815] font-display text-sm text-[#231815] focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Primary Start CTA (`data-start="true"`) */}
            <button
              type="button"
              data-start="true"
              onClick={onStartGame}
              className="w-full py-3 rounded-2xl bg-[#52D62A] hover:bg-[#62E53A] text-[#231815] font-display text-lg border-3 border-[#231815] shadow-[0_5px_0_#231815] active:translate-y-1 transition-transform cursor-pointer"
            >
              {currentStagePreset.titleKo} 시작!
            </button>

            {/* Flat borderless inline control hint */}
            <div className="mt-2 text-[10px] font-semibold text-[#6E5D54] text-center">
              뒤로 드래그 후 놓아서 발사 · 점프 패드로 상단 이동 · 낙사 시 점수 -20%
            </div>
          </div>
        </div>
      )}

      {/* 5. Pause & Physics Tuning Modal (`gameState === 'paused'` or `showTuningModal`) */}
      {(gameState === 'paused' || showTuningModal) && gameState !== 'gameover' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="일시정지 및 물리 설정"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto bg-[#121826]/60"
        >
          <div className="w-full max-w-[420px] rounded-3xl bg-[#FFF9EC] border-4 border-[#231815] shadow-[0_8px_0_#231815] p-5 text-[#231815] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl text-[#231815]">
                {showTuningModal ? '아케이드 물리 밸런스 설정' : '게임 일시정지'}
              </h2>
              <button
                type="button"
                onClick={showTuningModal ? onToggleTuningModal : onPauseToggle}
                aria-label="모달 닫기"
                className="w-8 h-8 rounded-full bg-amber-200 border-2 border-[#231815] font-display text-sm flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Live Physics Tuning Sliders (Requested in Section 14) */}
            <div className="space-y-3 bg-white p-3.5 rounded-2xl border-2 border-[#E6DACB] mb-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <label htmlFor="slider-launch-speed">최대 발사 속도 (발사력)</label>
                  <span className="tabular-nums text-amber-700">{physicsConfig.maxLaunchSpeed.toFixed(1)}</span>
                </div>
                <input
                  id="slider-launch-speed"
                  type="range"
                  min={18}
                  max={42}
                  step={0.5}
                  value={physicsConfig.maxLaunchSpeed}
                  onChange={(e) =>
                    onUpdatePhysicsConfig({
                      ...physicsConfig,
                      maxLaunchSpeed: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <label htmlFor="slider-friction">바닥 마찰 감속 (높을수록 빨리 정지)</label>
                  <span className="tabular-nums text-amber-700">{physicsConfig.groundFriction.toFixed(1)}</span>
                </div>
                <input
                  id="slider-friction"
                  type="range"
                  min={1.6}
                  max={5.0}
                  step={0.1}
                  value={physicsConfig.groundFriction}
                  onChange={(e) =>
                    onUpdatePhysicsConfig({
                      ...physicsConfig,
                      groundFriction: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <label htmlFor="slider-restitution">충돌 반발력 (쫀득한 튕김 정도)</label>
                  <span className="tabular-nums text-amber-700">
                    {physicsConfig.collisionBoostMultiplier.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="slider-restitution"
                  type="range"
                  min={0.8}
                  max={1.65}
                  step={0.05}
                  value={physicsConfig.collisionBoostMultiplier}
                  onChange={(e) =>
                    onUpdatePhysicsConfig({
                      ...physicsConfig,
                      collisionBoostMultiplier: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <label htmlFor="slider-max-radius">최대 성장 크기 상한</label>
                  <span className="tabular-nums text-amber-700">{physicsConfig.maxRadius.toFixed(2)}배</span>
                </div>
                <input
                  id="slider-max-radius"
                  type="range"
                  min={1.5}
                  max={2.6}
                  step={0.05}
                  value={physicsConfig.maxRadius}
                  onChange={(e) =>
                    onUpdatePhysicsConfig({
                      ...physicsConfig,
                      maxRadius: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={() => onUpdatePhysicsConfig({ ...DEFAULT_PHYSICS_CONFIG })}
                className="w-full py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-[#231815] font-display text-xs text-[#231815] cursor-pointer"
              >
                기본 물리 수치로 초기화
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={showTuningModal ? onToggleTuningModal : onPauseToggle}
                className="py-2.5 rounded-xl bg-[#52D62A] border-2 border-[#231815] shadow-[0_3px_0_#231815] font-display text-sm cursor-pointer"
              >
                계속하기
              </button>
              <button
                type="button"
                onClick={onRestartGame}
                className="py-2.5 rounded-xl bg-[#FFE144] border-2 border-[#231815] shadow-[0_3px_0_#231815] font-display text-sm cursor-pointer"
              >
                재시작
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="py-2.5 rounded-xl bg-white border-2 border-[#231815] shadow-[0_3px_0_#231815] font-display text-sm cursor-pointer"
              >
                타이틀로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Game Over / Final Ranking Podium Modal (`gameState === 'gameover'`) */}
      {gameState === 'gameover' && roundSummary && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="게임 종료 결과"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto bg-[#121826]/65"
        >
          <div className="w-full max-w-[420px] rounded-3xl bg-[#FFF9EC] border-4 border-[#231815] shadow-[0_10px_0_#231815] p-5 text-[#231815] flex flex-col items-center">
            <div className="px-4 py-1 rounded-full bg-[#FFE144] border-2 border-[#231815] font-display text-xs mb-1">
              {currentStagePreset.roundBadgeKo} · {currentStagePreset.titleKo} 종료!
            </div>
            <h2 className="font-display text-3xl text-[#231815] mb-3">
              최종 {roundSummary.playerRank}위 달성!
            </h2>

            {/* Final Rankings List */}
            <div className="w-full space-y-2 mb-4">
              {roundSummary.rankings.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border-2 ${
                    r.isPlayer
                      ? 'bg-[#FFE144] border-[#231815] shadow-[0_3px_0_#231815]'
                      : 'bg-white border-[#D6C7B8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-[#231815] text-white font-display text-sm flex items-center justify-center">
                      {r.rank}
                    </span>
                    <AnimalAvatarIcon animal={r.animal} size={28} />
                    <div>
                      <div className="font-display text-sm text-[#231815]">{r.name}</div>
                      <div className="text-[11px] font-semibold text-[#6E5D54]">
                        별 {r.starsCollected}개 · 충돌 {r.collisionsCount}회
                      </div>
                    </div>
                  </div>
                  <span className="font-display text-lg text-[#231815] tabular-nums">
                    {r.score.toLocaleString()}점
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              data-testid="gameover-next-stage-btn"
              onClick={onNextStage}
              className="w-full py-3 mb-2.5 rounded-2xl bg-[#FF8A3D] hover:bg-[#FF9B57] border-2 border-[#231815] shadow-[0_4px_0_#231815] font-display text-base text-[#231815] cursor-pointer"
            >
              다음 스테이지 도전! (폴가이즈 투어 ▸)
            </button>

            <div className="w-full grid grid-cols-2 gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onRestartGame}
                className="py-2.5 rounded-2xl bg-[#52D62A] hover:bg-[#62E53A] border-2 border-[#231815] shadow-[0_4px_0_#231815] font-display text-sm cursor-pointer"
              >
                같은 스테이지 재도전
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="py-2.5 rounded-2xl bg-white hover:bg-amber-50 border-2 border-[#231815] shadow-[0_4px_0_#231815] font-display text-sm cursor-pointer"
              >
                스테이지/캐릭터 변경
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
