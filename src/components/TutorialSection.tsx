import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Globe,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  BoardId,
  DroppablePieceType,
  GameState,
  PromotionPieceType,
} from '../../shared/types';
import { applyChessMove, applyDropMove, applyDuckMove } from '../../shared/engine';
import { PIECE_GUIDE, TUTORIAL_LESSONS, TutorialAction } from '../data/tutorialLessons';
import { useGame } from '../context/GameContext';
import { assetUrl } from '../utils/routes';
import {
  playCaptureSound,
  playDropSound,
  playDuckSound,
  playMoveSound,
  playWinSound,
} from '../utils/sounds';
import { ChessBoard } from './ChessBoard';
import { PocketTray } from './PocketTray';

const STORAGE_KEY = 'duckhouse_tutorial_completed_v1';

function loadCompletedLessons(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface FeedbackState {
  kind: 'success' | 'nudge' | 'info';
  text: string;
}

export const TutorialSection: React.FC = () => {
  const { startPractice, setPage } = useGame();

  const [lessonIndex, setLessonIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>(() => loadCompletedLessons());
  const [game, setGame] = useState<GameState>(() => TUTORIAL_LESSONS[0].createInitialState());
  const [stepIndex, setStepIndex] = useState(0);
  const [lessonDone, setLessonDone] = useState(false);
  const [selectedDrops, setSelectedDrops] = useState<Record<BoardId, DroppablePieceType | null>>({
    A: null,
    B: null,
  });
  const [showHint, setShowHint] = useState(false);
  const [showPieceGuide, setShowPieceGuide] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [autoResponding, setAutoResponding] = useState(false);
  const [justTransferred, setJustTransferred] = useState<DroppablePieceType | null>(null);
  const [resetTick, setResetTick] = useState(0);

  const autoTimerRef = useRef<number | null>(null);
  const transferTimerRef = useRef<number | null>(null);

  const lesson = TUTORIAL_LESSONS[lessonIndex];
  const currentStep = lessonDone ? null : lesson.steps[stepIndex] ?? null;

  const clearTimers = useCallback(() => {
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (transferTimerRef.current !== null) {
      window.clearTimeout(transferTimerRef.current);
      transferTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const markCompleted = useCallback((id: string) => {
    setCompletedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const loadLesson = useCallback(
    (idx: number) => {
      clearTimers();
      const target = TUTORIAL_LESSONS[idx];
      if (!target) return;
      setLessonIndex(idx);
      setGame(target.createInitialState());
      setStepIndex(0);
      setLessonDone(false);
      setSelectedDrops({ A: null, B: null });
      setShowHint(false);
      setFeedback(null);
      setAutoResponding(false);
      setJustTransferred(null);
      setResetTick((t) => t + 1);
    },
    [clearTimers]
  );

  const resetCurrentLesson = useCallback(() => {
    loadLesson(lessonIndex);
  }, [lessonIndex, loadLesson]);

  const finishStep = useCallback(
    (nextState: GameState, stepFeedback: string, stepObj: (typeof lesson.steps)[number]) => {
      setGame(nextState);
      setSelectedDrops({ A: null, B: null });
      setShowHint(false);

      const isLastStep = stepIndex >= lesson.steps.length - 1;

      if (stepObj.autoResponse) {
        setFeedback({ kind: 'success', text: stepFeedback });
        setAutoResponding(true);
        autoTimerRef.current = window.setTimeout(() => {
          autoTimerRef.current = null;
          const reply = stepObj.autoResponse?.(nextState);
          setAutoResponding(false);
          if (reply) {
            setGame(reply.state);
            playDuckSound();
            setFeedback({ kind: 'info', text: reply.narration });
          }
          if (isLastStep) {
            setLessonDone(true);
            markCompleted(lesson.id);
            playWinSound();
          } else {
            setStepIndex((s) => s + 1);
          }
        }, 720);
        return;
      }

      setFeedback({ kind: 'success', text: stepFeedback });

      if (isLastStep) {
        setLessonDone(true);
        markCompleted(lesson.id);
        playWinSound();
      } else {
        setStepIndex((s) => s + 1);
      }
    },
    [lesson, markCompleted, stepIndex]
  );

  const processAction = useCallback(
    (
      action: TutorialAction,
      result: ReturnType<typeof applyChessMove>
    ) => {
      if (!currentStep || lessonDone || autoResponding) return;
      if (!result.ok) {
        setFeedback({ kind: 'nudge', text: result.error || 'That move is not legal here.' });
        return;
      }

      const check = currentStep.validate(action, game, result.state);
      if (!check.ok) {
        setFeedback({ kind: 'nudge', text: check.feedback });
        return;
      }

      // Play tactile audio cue matching the action
      if (result.kingCaptured) {
        playWinSound();
      } else if (action.kind === 'drop') {
        playDropSound();
      } else if (action.kind === 'duck') {
        playDuckSound();
      } else if (result.captured) {
        playCaptureSound();
      } else {
        playMoveSound();
      }

      // Highlight Partner Pocket transfer on Board B if a piece transferred!
      if (result.partnerReceived && result.partnerReceived.boardId === 'B') {
        const receivedType = result.partnerReceived.pieceType;
        setJustTransferred(receivedType);
        if (transferTimerRef.current !== null) window.clearTimeout(transferTimerRef.current);
        transferTimerRef.current = window.setTimeout(() => {
          setJustTransferred(null);
          transferTimerRef.current = null;
        }, 2800);
      }

      finishStep(result.state, check.feedback, currentStep);
    },
    [autoResponding, currentStep, finishStep, game, lessonDone]
  );

  const handleChessMove = useCallback(
    (boardId: BoardId, from: number, to: number, promotion?: PromotionPieceType) => {
      if (!currentStep || currentStep.boardId !== boardId) return;
      const res = applyChessMove(game, boardId, from, to, promotion);
      processAction({ kind: 'move', boardId, from, to }, res);
    },
    [currentStep, game, processAction]
  );

  const handleDropMove = useCallback(
    (boardId: BoardId, pieceType: DroppablePieceType, to: number) => {
      if (!currentStep || currentStep.boardId !== boardId) return;
      const res = applyDropMove(game, boardId, pieceType, to);
      processAction({ kind: 'drop', boardId, pieceType, to }, res);
    },
    [currentStep, game, processAction]
  );

  const handleDuckMove = useCallback(
    (boardId: BoardId, to: number) => {
      if (!currentStep || currentStep.boardId !== boardId) return;
      const res = applyDuckMove(game, boardId, to);
      processAction({ kind: 'duck', boardId, to }, res);
    },
    [currentStep, game, processAction]
  );

  const activeHints = useMemo(() => {
    if (!showHint || !currentStep || !currentStep.getHintSquares) return { from: [], targets: [] };
    const h = currentStep.getHintSquares(game);
    return { from: h.from ?? [], targets: h.targets ?? [] };
  }, [currentStep, game, showHint]);

  const activeThreats = useMemo(() => {
    if (!currentStep || !currentStep.getThreatSquares) return [];
    return currentStep.getThreatSquares(game);
  }, [currentStep, game]);

  const completedCount = TUTORIAL_LESSONS.filter((l) => completedIds.includes(l.id)).length;
  const allCompleted = completedCount === TUTORIAL_LESSONS.length;
  const isDual = lesson.layout === 'dual';
  const nextLesson = TUTORIAL_LESSONS[lessonIndex + 1] ?? null;

  const canActOnA = !lessonDone && !autoResponding && currentStep?.boardId === 'A';
  const canActOnB = !lessonDone && !autoResponding && currentStep?.boardId === 'B';

  const renderBoardPanel = (boardId: BoardId) => {
    const board = game.boards[boardId];
    const orientation = boardId === 'A' ? 'w' : 'b';
    const canAct = boardId === 'A' ? canActOnA : canActOnB;
    const showPocket = boardId === 'A' ? Boolean(lesson.showPocketA) : Boolean(lesson.showPocketB);
    const pocketColor = boardId === 'A' ? 'w' : 'b';
    const pocketInteractive = canAct && board.phase === 'chess' && board.turn === pocketColor;

    const hintFrom = currentStep?.boardId === boardId ? activeHints.from : [];
    const hintTargets = currentStep?.boardId === boardId ? activeHints.targets : [];
    const threats = currentStep?.boardId === boardId ? activeThreats : [];
    const highlightPocketPiece =
      currentStep?.boardId === boardId && !lessonDone ? currentStep.highlightPocketPiece ?? null : null;
    const receivedPiece = boardId === 'B' ? justTransferred : null;

    return (
      <div
        className={`dh-tut-board-col ${canAct ? 'is-active' : 'is-waiting'} ${
          canAct && board.phase === 'duck' ? 'is-duck-phase' : ''
        }`}
      >
        <div className="dh-tut-board-head">
          <div className="dh-tut-board-title">
            <span className={`dh-tut-seat-dot ${boardId === 'A' ? 'white' : 'black'}`} />
            <strong>{boardId === 'A' ? 'Board A · You (White)' : 'Board B · Partner (Black)'}</strong>
          </div>
          <span
            className={`dh-tut-phase-badge ${
              lessonDone
                ? 'done'
                : canAct && board.phase === 'duck'
                ? 'duck'
                : canAct
                ? 'active'
                : 'waiting'
            }`}
          >
            {lessonDone
              ? 'Complete ✓'
              : autoResponding && currentStep?.boardId === boardId
              ? 'Opponent moving…'
              : canAct && board.phase === 'duck'
              ? '🦆 Place the Duck!'
              : canAct
              ? 'Your Action'
              : isDual
              ? boardId === 'B'
                ? 'Watch Pocket'
                : 'Done on A ✓'
              : 'Waiting'}
          </span>
        </div>

        <ChessBoard
          key={`${lesson.id}-${boardId}-${resetTick}`}
          board={board}
          orientation={orientation}
          canAct={canAct}
          selectedDrop={selectedDrops[boardId]}
          onClearDrop={() => setSelectedDrops((prev) => ({ ...prev, [boardId]: null }))}
          onChessMove={(from, to, promo) => handleChessMove(boardId, from, to, promo)}
          onDropMove={(pieceType, to) => handleDropMove(boardId, pieceType, to)}
          onDuckMove={(to) => handleDuckMove(boardId, to)}
          compact={isDual}
          hintFromSquares={hintFrom}
          hintTargetSquares={hintTargets}
          threatSquares={threats}
        />

        {showPocket && (
          <div className="dh-tut-pocket-wrap">
            <PocketTray
              color={pocketColor}
              pocket={board.pockets[pocketColor]}
              interactive={pocketInteractive}
              selectedDrop={pocketInteractive ? selectedDrops[boardId] : null}
              onSelectDrop={(piece) => setSelectedDrops((prev) => ({ ...prev, [boardId]: piece }))}
              label={
                boardId === 'A'
                  ? pocketInteractive
                    ? 'Your Pocket (Click piece to drop)'
                    : 'Your Pocket'
                  : pocketInteractive
                  ? 'Partner’s Pocket (Click piece to drop!)'
                  : 'Partner’s Pocket'
              }
              highlightPiece={highlightPocketPiece}
              receivedPiece={receivedPiece}
            />
            {receivedPiece && (
              <div className="dh-tut-transfer-pill" role="status">
                <Sparkles size={13} />
                <span>Piece transferred from Board A into Partner’s Pocket!</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCoachPanel = () => (
    <div className="dh-tut-coach">
      <div className="dh-tut-lesson-meta">
        <span className="dh-pill-badge emerald">{lesson.badge}</span>
        <span className="dh-tut-lesson-num">
          Lesson {lesson.number} of {TUTORIAL_LESSONS.length}
        </span>
      </div>

      <h3 className="dh-tut-lesson-title">{lesson.title}</h3>
      <p className="dh-tut-why">{lesson.whyItMatters}</p>

      {!lessonDone && currentStep ? (
        <div
          className={`dh-tut-step-card ${
            currentStep.expectedPhase === 'duck' ? 'phase-duck' : 'phase-chess'
          }`}
        >
          <div className="dh-tut-step-head">
            <span className="dh-tut-step-badge">{currentStep.badgeText}</span>
            <div className="dh-tut-step-dots" aria-hidden="true">
              {lesson.steps.map((s, idx) => (
                <span
                  key={s.id}
                  className={`dh-tut-dot ${
                    idx < stepIndex ? 'done' : idx === stepIndex ? 'active' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <p className="dh-tut-step-prompt">{currentStep.prompt}</p>
          <p className="dh-tut-step-subtip">{currentStep.subtip}</p>

          {showHint && (
            <div className="dh-tut-hint-box">
              <Lightbulb size={15} />
              <span>{currentStep.hintText}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="dh-tut-complete-card">
          <div className="dh-tut-complete-head">
            {lesson.number === TUTORIAL_LESSONS.length ? <Trophy size={20} /> : <CheckCircle2 size={20} />}
            <strong>{lesson.completionTitle}</strong>
          </div>
          <p>{lesson.completionMessage}</p>

          <div className="dh-tut-complete-actions">
            {nextLesson ? (
              <button
                type="button"
                className="dh-btn dh-btn-primary"
                onClick={() => loadLesson(lessonIndex + 1)}
              >
                <span>Next: {nextLesson.shortTitle}</span>
                <ArrowRight size={15} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="dh-btn dh-btn-primary"
                  onClick={() => startPractice('bots')}
                >
                  <Bot size={15} />
                  <span>Play vs Bots</span>
                </button>
                <button
                  type="button"
                  className="dh-btn dh-btn-secondary"
                  onClick={() => setPage('lobby')}
                >
                  <Globe size={15} />
                  <span>Online Lobby</span>
                </button>
                <button
                  type="button"
                  className="dh-btn dh-btn-ghost"
                  onClick={() => startPractice('sandbox')}
                >
                  <Users size={15} />
                  <span>4-Seat Sandbox</span>
                </button>
              </>
            )}

            <button
              type="button"
              className="dh-btn dh-btn-ghost dh-btn-sm"
              onClick={resetCurrentLesson}
            >
              <RotateCcw size={14} />
              <span>Replay</span>
            </button>
          </div>
        </div>
      )}

      {feedback && !lessonDone && (
        <div className={`dh-tut-feedback kind-${feedback.kind}`} role="status">
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="dh-tut-controls">
        {!lessonDone && (
          <button
            type="button"
            className={`dh-btn dh-btn-sm ${showHint ? 'dh-btn-secondary' : 'dh-btn-ghost'}`}
            onClick={() => setShowHint((h) => !h)}
          >
            <Lightbulb size={14} />
            <span>{showHint ? 'Hide Hint' : 'Show Hint'}</span>
          </button>
        )}

        <button
          type="button"
          className="dh-btn dh-btn-ghost dh-btn-sm"
          onClick={resetCurrentLesson}
        >
          <RotateCcw size={14} />
          <span>Reset Lesson</span>
        </button>

        <div className="dh-tut-nav-pair">
          <button
            type="button"
            className="dh-btn dh-btn-ghost dh-btn-sm"
            disabled={lessonIndex === 0}
            onClick={() => loadLesson(lessonIndex - 1)}
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>
          <button
            type="button"
            className="dh-btn dh-btn-secondary dh-btn-sm"
            disabled={lessonIndex === TUTORIAL_LESSONS.length - 1}
            onClick={() => loadLesson(lessonIndex + 1)}
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section id="dh-tutorial" className="dh-tutorial-section" aria-labelledby="dh-tutorial-heading">
      <div className="dh-tut-header">
        <div>
          <div className="dh-eyebrow">
            <GraduationCap size={14} />
            <span>INTERACTIVE TUTORIAL · NO VARIANT EXPERIENCE NEEDED</span>
          </div>
          <h2 id="dh-tutorial-heading" className="dh-tut-heading">
            Learn Duckhouse in 6 Quick Hands-On Lessons
          </h2>
          <p className="dh-tut-subheading">
            Never played Duck Chess or Bughouse before? Play through these bite-sized interactive boards to master
            every rule in about 2 minutes.
          </p>
        </div>

        <div className="dh-tut-header-right">
          <div className="dh-tut-progress-box">
            <div className="dh-tut-progress-label">
              {allCompleted ? (
                <>
                  <Crown size={14} className="dh-accent-icon" />
                  <span>All {TUTORIAL_LESSONS.length} lessons complete!</span>
                </>
              ) : (
                <span>
                  Progress: <strong>{completedCount}</strong> / {TUTORIAL_LESSONS.length}
                </span>
              )}
            </div>
            <div className="dh-tut-progress-track" aria-hidden="true">
              <div
                className="dh-tut-progress-fill"
                style={{ width: `${(completedCount / TUTORIAL_LESSONS.length) * 100}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            className={`dh-btn dh-btn-sm ${showPieceGuide ? 'dh-btn-secondary' : 'dh-btn-ghost'}`}
            onClick={() => setShowPieceGuide((v) => !v)}
            aria-expanded={showPieceGuide}
          >
            {showPieceGuide ? <X size={14} /> : <HelpCircle size={14} />}
            <span>{showPieceGuide ? 'Hide Piece Guide' : 'New to Chess? Piece Guide'}</span>
          </button>
        </div>
      </div>

      {/* Optional beginner chess piece movement cheat-sheet */}
      {showPieceGuide && (
        <div className="dh-piece-guide" role="region" aria-label="Chess piece and Duck movement guide">
          <div className="dh-piece-guide-head">
            <strong>Quick Piece &amp; Duck Guide</strong>
            <span>Tip: Click any of your pieces on the board to see glowing dots for every legal move!</span>
          </div>
          <div className="dh-piece-guide-grid">
            {PIECE_GUIDE.map((item) => (
              <div key={item.name} className={`dh-piece-guide-card ${item.name === 'The Duck' ? 'duck' : ''}`}>
                <img src={assetUrl(item.asset)} alt={item.name} />
                <div>
                  <div className="dh-piece-guide-name">{item.name}</div>
                  <p>{item.rule}</p>
                  <span className="dh-piece-guide-note">{item.duckNote}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6-lesson stepper bar */}
      <div className="dh-tut-tabs" role="tablist" aria-label="Tutorial lessons">
        {TUTORIAL_LESSONS.map((item, idx) => {
          const isDone = completedIds.includes(item.id);
          const isActive = idx === lessonIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`dh-tut-tab ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
              onClick={() => loadLesson(idx)}
            >
              <span className="dh-tut-tab-check">
                {isDone ? <CheckCircle2 size={14} /> : <span className="dh-tut-tab-num">{item.number}</span>}
              </span>
              <span className="dh-tut-tab-label">{item.shortTitle.replace(/^\d+\.\s*/, '')}</span>
            </button>
          );
        })}
      </div>

      {/* Main interactive workspace */}
      <div className={`dh-card dh-tut-workspace ${isDual ? 'layout-dual' : 'layout-single'}`}>
        {isDual ? (
          <>
            {renderCoachPanel()}
            <div className="dh-tut-dual-arena">
              {renderBoardPanel('A')}
              <div className={`dh-tut-dual-bridge ${justTransferred ? 'glow' : ''}`}>
                <div className="dh-tut-bridge-badge">
                  <ArrowRight size={16} />
                </div>
                <span>Captures on Board A → Partner’s Pocket on Board B</span>
              </div>
              {renderBoardPanel('B')}
            </div>
          </>
        ) : (
          <>
            <div className="dh-tut-single-board-wrap">{renderBoardPanel('A')}</div>
            {renderCoachPanel()}
          </>
        )}
      </div>
    </section>
  );
};
