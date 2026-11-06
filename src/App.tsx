/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AimDragOverlayState,
  CameraViewMode,
  GameCanvas,
  GameState,
  HudActorSnapshot,
  MiniMapStarSnapshot,
  RoundSummary,
  StageRuntimeStatus,
} from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import {
  AnimalType,
  DEFAULT_PHYSICS_CONFIG,
  GamePhysicsConfig,
  STAGE_ORDER,
  STAGE_PRESETS,
  StageId,
} from './game/config';
import { soundEngine } from './game/sound';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  const [stageId, setStageId] = useState<StageId>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qStage = params.get('stage') as StageId | null;
      if (qStage && STAGE_ORDER.includes(qStage)) {
        return qStage;
      }
    }
    return 'star_rush';
  });

  const [stageStatus, setStageStatus] = useState<StageRuntimeStatus>(() => ({
    stageId: 'star_rush',
    statusText: STAGE_PRESETS.star_rush.ruleSummaryKo,
  }));

  const [cameraMode, setCameraMode] = useState<CameraViewMode>('follow');
  const [playerAnimal, setPlayerAnimal] = useState<AnimalType>('puppy');
  const [playerName, setPlayerName] = useState<string>('나');
  const [physicsConfig, setPhysicsConfig] = useState<GamePhysicsConfig>(() => ({
    ...DEFAULT_PHYSICS_CONFIG,
  }));
  const [restartNonce, setRestartNonce] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showTuningModal, setShowTuningModal] = useState<boolean>(false);

  const [actors, setActors] = useState<HudActorSnapshot[]>([]);
  const [stars, setStars] = useState<MiniMapStarSnapshot[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    DEFAULT_PHYSICS_CONFIG.roundDurationSeconds
  );
  const [aimState, setAimState] = useState<AimDragOverlayState>({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    powerRatio: 0,
    dirX: 0,
    dirZ: -1,
  });
  const [eventBanner, setEventBanner] = useState<string | null>(null);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);

  // Sync game state and stageId to document.body.dataset for testability & accessibility
  useEffect(() => {
    document.body.dataset.state = gameState;
    document.body.dataset.stage = stageId;
  }, [gameState, stageId]);

  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowTuningModal(false);
    setRoundSummary(null);
    setRestartNonce((n) => n + 1);
    setGameState('playing');
  }, []);

  const handleRestartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowTuningModal(false);
    setRoundSummary(null);
    setRestartNonce((n) => n + 1);
    setGameState('playing');
  }, []);

  const handleNextStage = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setStageId((prev) => {
      const idx = STAGE_ORDER.indexOf(prev);
      return STAGE_ORDER[(idx + 1) % STAGE_ORDER.length];
    });
    setShowTuningModal(false);
    setRoundSummary(null);
    setRestartNonce((n) => n + 1);
    setGameState('playing');
  }, []);

  const handlePauseToggle = useCallback(() => {
    setShowTuningModal(false);
    setGameState((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
  }, []);

  const handleReturnTitle = useCallback(() => {
    setShowTuningModal(false);
    setRoundSummary(null);
    setGameState('title');
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.muted = next;
      return next;
    });
  }, []);

  const handleToggleCameraMode = useCallback(() => {
    setCameraMode((prev) => (prev === 'follow' ? 'overview' : 'follow'));
  }, []);

  const handleToggleTuningModal = useCallback(() => {
    setShowTuningModal((prev) => !prev);
  }, []);

  const handleHudUpdate = useCallback(
    (
      nextActors: HudActorSnapshot[],
      nextStars: MiniMapStarSnapshot[],
      nextRemainingSeconds: number,
      nextAimState: AimDragOverlayState,
      nextBanner: string | null,
      nextStageStatus: StageRuntimeStatus
    ) => {
      setActors(nextActors);
      setStars(nextStars);
      setRemainingSeconds(nextRemainingSeconds);
      setAimState(nextAimState);
      setEventBanner(nextBanner);
      setStageStatus(nextStageStatus);
    },
    []
  );

  const handleRoundEnd = useCallback((summary: RoundSummary) => {
    setRoundSummary(summary);
    setGameState('gameover');
  }, []);

  // Global keyboard shortcuts (Enter/Space on title screen, Escape/P for pause, R for restart, M for mute, C/V for camera mode, N for next stage)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Enter' && gameState === 'title') {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (gameState === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartGame();
      } else if ((e.code === 'Escape' || e.code === 'KeyP') && (gameState === 'playing' || gameState === 'paused')) {
        e.preventDefault();
        handlePauseToggle();
      } else if (e.code === 'KeyR' && (gameState === 'playing' || gameState === 'paused' || gameState === 'gameover')) {
        e.preventDefault();
        handleRestartGame();
      } else if (e.code === 'KeyN' && (gameState === 'playing' || gameState === 'gameover')) {
        e.preventDefault();
        handleNextStage();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.code === 'KeyC' || e.code === 'KeyV') {
        e.preventDefault();
        handleToggleCameraMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    handleStartGame,
    handlePauseToggle,
    handleRestartGame,
    handleNextStage,
    handleToggleMute,
    handleToggleCameraMode,
  ]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#55B8FF]">
      <GameCanvas
        gameState={gameState}
        stageId={stageId}
        cameraMode={cameraMode}
        playerAnimal={playerAnimal}
        playerName={playerName}
        physicsConfig={physicsConfig}
        restartNonce={restartNonce}
        onHudUpdate={handleHudUpdate}
        onRoundEnd={handleRoundEnd}
      />
      <GameHUD
        gameState={gameState}
        stageId={stageId}
        stageStatus={stageStatus}
        cameraMode={cameraMode}
        actors={actors}
        stars={stars}
        remainingSeconds={remainingSeconds}
        aimState={aimState}
        eventBanner={eventBanner}
        playerAnimal={playerAnimal}
        playerName={playerName}
        physicsConfig={physicsConfig}
        isMuted={isMuted}
        showTuningModal={showTuningModal}
        roundSummary={roundSummary}
        onSelectStage={setStageId}
        onNextStage={handleNextStage}
        onSelectAnimal={setPlayerAnimal}
        onChangePlayerName={setPlayerName}
        onStartGame={handleStartGame}
        onPauseToggle={handlePauseToggle}
        onRestartGame={handleRestartGame}
        onReturnTitle={handleReturnTitle}
        onToggleMute={handleToggleMute}
        onToggleCameraMode={handleToggleCameraMode}
        onToggleTuningModal={handleToggleTuningModal}
        onUpdatePhysicsConfig={setPhysicsConfig}
      />
    </main>
  );
}
