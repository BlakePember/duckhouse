import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Clock,
  Crown,
  Flag,
  History,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  Users,
} from 'lucide-react';
import {
  BoardId,
  Color,
  DroppablePieceType,
  GameState,
  PromotionPieceType,
  SeatKey,
  SeatPlayer,
  TIME_CONTROLS,
  getPartnerSeat,
  getSeatBoardAndColor,
  getSeatKey,
  getSeatTeam,
  oppositeColor,
  otherBoard,
} from '../../shared/types';
import { getRoomMatchFormat } from '../../shared/seats';
import { useGame } from '../context/GameContext';
import { ChessBoard } from '../components/ChessBoard';
import { PocketTray } from '../components/PocketTray';
import { PlayerClock } from '../components/PlayerClock';
import { TeamChat } from '../components/TeamChat';

const DROPPABLE_TYPES: DroppablePieceType[] = ['q', 'r', 'b', 'n', 'p'];

interface GamePageProps {
  mode: 'online' | 'practice';
}

export const GamePage: React.FC<GamePageProps> = ({ mode }) => {
  const {
    room,
    mySeats,
    leaveRoom,
    rematch,
    sendMove,
    sendDrop,
    sendDuck,
    resign,
    sendChat,
    playerName,
    practiceMode,
    practiceColor,
    practiceTc,
    practiceGame,
    openPractice,
    setPracticeColor,
    startPracticeGame,
    resetPracticeGame,
    practiceMove,
    practiceDrop,
    practiceDuck,
    practiceResign,
  } = useGame();

  const [flipped, setFlipped] = useState(false);
  const [selectedDrops, setSelectedDrops] = useState<Record<BoardId, DroppablePieceType | null>>({
    A: null,
    B: null,
  });
  const [historyBoard, setHistoryBoard] = useState<BoardId>('A');
  const [receivedPieces, setReceivedPieces] = useState<Record<SeatKey, DroppablePieceType | null>>({
    A_w: null,
    A_b: null,
    B_w: null,
    B_b: null,
  });
  const [nextBotsColor, setNextBotsColor] = useState<Color>(practiceColor);
  const prevGameRef = useRef<GameState | null>(null);
  const receiveTimersRef = useRef<Partial<Record<SeatKey, ReturnType<typeof setTimeout>>>>({});

  const isOnline = mode === 'online';
  const game: GameState | null = isOnline ? room?.game ?? null : practiceGame;

  const seats: Record<SeatKey, SeatPlayer | null> = useMemo(() => {
    if (isOnline && room) return room.seats;
    if (practiceMode === 'bots') {
      const human: SeatPlayer = { id: 'human', name: playerName, isBot: false, connected: true, ready: true };
      const partner: SeatPlayer = {
        id: 'bot_partner',
        name: 'QuackBot (Partner)',
        isBot: true,
        connected: true,
        ready: true,
      };
      const opp1: SeatPlayer = { id: 'bot_opp1', name: 'MallardAI', isBot: true, connected: true, ready: true };
      const opp2: SeatPlayer = { id: 'bot_opp2', name: 'DrakeEngine', isBot: true, connected: true, ready: true };
      if (practiceColor === 'b') {
        return {
          A_w: opp1,
          B_b: opp2,
          A_b: human,
          B_w: partner,
        };
      }
      return {
        A_w: human,
        B_b: partner,
        A_b: opp1,
        B_w: opp2,
      };
    }
    if (practiceMode === 'dual') {
      return {
        A_w: { id: 'human', name: playerName, isBot: false, connected: true, ready: true },
        B_b: { id: 'human', name: playerName, isBot: false, connected: true, ready: true },
        A_b: { id: 'bot_opp1', name: 'MallardAI', isBot: true, connected: true, ready: true },
        B_w: { id: 'bot_opp2', name: 'DrakeEngine', isBot: true, connected: true, ready: true },
      };
    }
    return {
      A_w: { id: 's1', name: 'Board A White', isBot: false, connected: true, ready: true },
      B_b: { id: 's2', name: 'Board B Black', isBot: false, connected: true, ready: true },
      A_b: { id: 's3', name: 'Board A Black', isBot: false, connected: true, ready: true },
      B_w: { id: 's4', name: 'Board B White', isBot: false, connected: true, ready: true },
    };
  }, [isOnline, room, practiceMode, practiceColor, playerName]);

  const activeSeats: SeatKey[] = useMemo(() => {
    if (isOnline) return mySeats;
    if (practiceMode === 'bots') return [getSeatKey('A', practiceColor)];
    if (practiceMode === 'dual') return ['A_w', 'B_b'];
    return [];
  }, [isOnline, mySeats, practiceMode, practiceColor]);

  useEffect(() => {
    setSelectedDrops({ A: null, B: null });
  }, [game?.startedAt, mode, practiceMode, practiceColor]);

  useEffect(() => {
    setFlipped(false);
  }, [practiceMode, practiceColor]);

  useEffect(() => {
    if (game?.status !== 'finished') {
      setNextBotsColor(practiceColor);
    }
  }, [game?.status, practiceColor]);

  useEffect(() => {
    const timers = receiveTimersRef.current;
    return () => {
      Object.values(timers).forEach((t) => {
        if (t) clearTimeout(t);
      });
    };
  }, []);

  useEffect(() => {
    const prev = prevGameRef.current;
    prevGameRef.current = game;
    if (!game || !prev || prev.startedAt !== game.startedAt) return;

    for (const seat of activeSeats) {
      const { boardId, color } = getSeatBoardAndColor(seat);
      const prevPocket = prev.boards[boardId].pockets[color];
      const nextPocket = game.boards[boardId].pockets[color];
      const arrived = DROPPABLE_TYPES.find((t) => nextPocket[t] > prevPocket[t]);
      if (arrived) {
        setReceivedPieces((curr) => ({ ...curr, [seat]: arrived }));
        if (receiveTimersRef.current[seat]) {
          clearTimeout(receiveTimersRef.current[seat]);
        }
        receiveTimersRef.current[seat] = setTimeout(() => {
          setReceivedPieces((curr) => ({ ...curr, [seat]: null }));
          delete receiveTimersRef.current[seat];
        }, 1600);
      }
    }
  }, [game, activeSeats]);

  if (!game) return null;

  const primarySeat: SeatKey | null = activeSeats[0] ?? null;
  const isDualControl = activeSeats.length === 2;
  const matchFormat = getRoomMatchFormat(seats);

  const primaryBoardId: BoardId = primarySeat ? getSeatBoardAndColor(primarySeat).boardId : 'A';
  const secondaryBoardId: BoardId = otherBoard(primaryBoardId);

  const primaryDefaultColor: Color = primarySeat ? getSeatBoardAndColor(primarySeat).color : 'w';
  const primaryOrientation: Color = flipped ? oppositeColor(primaryDefaultColor) : primaryDefaultColor;
  // Partner (or your second seat on the same team) always plays the opposite color on the other board!
  const secondaryOrientation: Color = oppositeColor(primaryOrientation);

  const partnerSeat: SeatKey | null = activeSeats.length === 1 ? getPartnerSeat(activeSeats[0]) : null;

  const canActOnBoard = (boardId: BoardId): boolean => {
    if (game.status !== 'playing') return false;
    const board = game.boards[boardId];
    if (!isOnline && practiceMode === 'sandbox') return true;
    return activeSeats.includes(getSeatKey(boardId, board.turn));
  };

  const handleMove = (boardId: BoardId, from: number, to: number, promotion?: PromotionPieceType) => {
    setSelectedDrops((prev) => ({ ...prev, [boardId]: null }));
    if (isOnline) sendMove({ boardId, from, to, promotion });
    else practiceMove({ boardId, from, to, promotion });
  };

  const handleDrop = (boardId: BoardId, pieceType: DroppablePieceType, to: number) => {
    setSelectedDrops((prev) => ({ ...prev, [boardId]: null }));
    if (isOnline) sendDrop({ boardId, pieceType, to });
    else practiceDrop({ boardId, pieceType, to });
  };

  const handleDuck = (boardId: BoardId, to: number) => {
    setSelectedDrops((prev) => ({ ...prev, [boardId]: null }));
    if (isOnline) sendDuck({ boardId, to });
    else practiceDuck({ boardId, to });
  };

  const renderBoardColumn = (boardId: BoardId, orientation: Color, isPrimary: boolean) => {
    const board = game.boards[boardId];
    const bottomColor = orientation;
    const topColor = oppositeColor(orientation);
    const bottomSeat = getSeatKey(boardId, bottomColor);
    const topSeat = getSeatKey(boardId, topColor);

    const canAct = canActOnBoard(boardId);
    const bottomCanDrop = canAct && board.phase === 'chess' && board.turn === bottomColor;
    const topCanDrop = canAct && board.phase === 'chess' && board.turn === topColor;

    const mySeatOnThisBoard = activeSeats.find((s) => s.startsWith(boardId)) ?? null;
    const isTopMine = activeSeats.includes(topSeat);
    const isBottomMine = activeSeats.includes(bottomSeat);
    const showActiveTurnHighlight = isOnline || practiceMode !== 'sandbox';

    const topPocketLabel = topCanDrop
      ? isTopMine
        ? 'Your Pocket (Click to Drop)'
        : `${topColor === 'w' ? 'White' : 'Black'} Pocket (Click to Drop)`
      : isTopMine
      ? 'Your Pocket'
      : `${topColor === 'w' ? 'White' : 'Black'} Pocket`;

    const bottomPocketLabel = bottomCanDrop
      ? isBottomMine
        ? 'Your Pocket (Click to Drop)'
        : `${bottomColor === 'w' ? 'White' : 'Black'} Pocket (Click to Drop)`
      : isBottomMine
      ? 'Your Pocket'
      : `${bottomColor === 'w' ? 'White' : 'Black'} Pocket`;

    return (
      <div
        key={boardId}
        className={`dh-board-column ${isPrimary || isDualControl ? 'primary' : 'secondary'} ${
          showActiveTurnHighlight && canAct ? 'your-turn' : ''
        }`}
      >
        <div className="dh-board-heading">
          <span className="dh-board-badge">
            Board {boardId}{' '}
            {isDualControl && mySeatOnThisBoard
              ? `· Your Board (${mySeatOnThisBoard.endsWith('_w') ? 'White' : 'Black'})`
              : mySeatOnThisBoard
              ? '· Your Board'
              : partnerSeat?.startsWith(boardId)
              ? '· Partner’s Board'
              : ''}
          </span>
          <span
            className={`dh-board-phase-tag ${board.phase === 'duck' ? 'duck' : ''} ${
              showActiveTurnHighlight && canAct && board.phase === 'chess' ? 'your-turn' : ''
            }`}
          >
            {game.status === 'finished'
              ? 'Finished'
              : game.status === 'waiting'
              ? 'Ready'
              : board.phase === 'duck'
              ? `🦆 ${board.turn === 'w' ? 'White' : 'Black'} moving Duck`
              : showActiveTurnHighlight && canAct
              ? `Your Move (${board.turn === 'w' ? 'White' : 'Black'})`
              : `${board.turn === 'w' ? 'White' : 'Black'} to move`}
          </span>
        </div>

        <PlayerClock
          seat={topSeat}
          player={seats[topSeat]}
          timeMs={game.clocks[topSeat]}
          lastClockTickAt={game.lastClockTickAt}
          isActiveTurn={board.turn === topColor}
          phase={board.phase}
          isPlaying={game.status === 'playing'}
          isMe={isTopMine}
          isPartner={partnerSeat === topSeat}
        />

        <PocketTray
          boardId={boardId}
          color={topColor}
          pocket={board.pockets[topColor]}
          interactive={topCanDrop}
          selectedDrop={topCanDrop ? selectedDrops[boardId] : null}
          onSelectDrop={(piece) => setSelectedDrops((prev) => ({ ...prev, [boardId]: piece }))}
          label={topPocketLabel}
          receivedPiece={receivedPieces[topSeat]}
        />

        <ChessBoard
          board={board}
          orientation={orientation}
          canAct={canAct}
          selectedDrop={selectedDrops[boardId]}
          onClearDrop={() => setSelectedDrops((prev) => ({ ...prev, [boardId]: null }))}
          onChessMove={(from, to, promo) => handleMove(boardId, from, to, promo)}
          onDropMove={(pieceType, to) => handleDrop(boardId, pieceType, to)}
          onDuckMove={(to) => handleDuck(boardId, to)}
          compact={!isPrimary && !isDualControl}
          highlightTurn={showActiveTurnHighlight}
        />

        <PocketTray
          boardId={boardId}
          color={bottomColor}
          pocket={board.pockets[bottomColor]}
          interactive={bottomCanDrop}
          selectedDrop={bottomCanDrop ? selectedDrops[boardId] : null}
          onSelectDrop={(piece) => setSelectedDrops((prev) => ({ ...prev, [boardId]: piece }))}
          label={bottomPocketLabel}
          receivedPiece={receivedPieces[bottomSeat]}
        />

        <PlayerClock
          seat={bottomSeat}
          player={seats[bottomSeat]}
          timeMs={game.clocks[bottomSeat]}
          lastClockTickAt={game.lastClockTickAt}
          isActiveTurn={board.turn === bottomColor}
          phase={board.phase}
          isPlaying={game.status === 'playing'}
          isMe={isBottomMine}
          isPartner={partnerSeat === bottomSeat}
        />
      </div>
    );
  };

  // Dynamic instructional banner
  const myTeam = primarySeat ? getSeatTeam(primarySeat) : null;
  const myActionBoards = (['A', 'B'] as BoardId[]).filter((bId) => canActOnBoard(bId));
  const myDuckBoards = myActionBoards.filter((bId) => game.boards[bId].phase === 'duck');
  const myChessBoards = myActionBoards.filter((bId) => game.boards[bId].phase === 'chess');

  let bannerText = '';
  let bannerVariant = 'neutral';
  const finishedSummary =
    game.status === 'finished'
      ? {
          winLabel: game.winnerTeam === 1 ? 'Team Emerald' : 'Team Amber',
          reasonText:
            game.winReason === 'king_capture'
              ? `King captured on Board ${game.winningBoard}!`
              : game.winReason === 'timeout'
              ? `Time expired on Board ${game.winningBoard}!`
              : 'Opponent resigned!',
          iWon: myTeam !== null && myTeam === game.winnerTeam,
        }
      : null;

  if (game.status === 'waiting') {
    if (!isOnline) {
      bannerText =
        practiceMode === 'bots'
          ? `Ready to play Solo Practice vs Bots as ${practiceColor === 'w' ? 'White' : 'Black'} — choose your color or time control, then press Start Game.`
          : practiceMode === 'dual'
          ? 'Ready to play 2v1 (Both Boards) vs Bots — control Board A White & Board B Black when you start.'
          : 'Ready for 4-Seat Sandbox — control all four seats freely once you start.';
      bannerVariant = 'ready';
    } else {
      bannerText = 'Waiting for match to start…';
      bannerVariant = 'neutral';
    }
  } else if (finishedSummary) {
    bannerText = `${finishedSummary.iWon ? '🏆 Victory! ' : ''}${finishedSummary.winLabel} wins — ${finishedSummary.reasonText}`;
    bannerVariant = finishedSummary.iWon ? 'win' : 'finished';
  } else if (!isOnline && practiceMode === 'sandbox') {
    const duckOnA = game.boards.A.phase === 'duck';
    const duckOnB = game.boards.B.phase === 'duck';
    bannerText =
      duckOnA || duckOnB
        ? `🦆 Sandbox Mode: Place the duck on ${[duckOnA ? 'Board A' : '', duckOnB ? 'Board B' : ''].filter(Boolean).join(' & ')}!`
        : '4-Seat Sandbox Mode: Move pieces or drop from pockets on either board.';
    bannerVariant = duckOnA || duckOnB ? 'duck' : 'info';
  } else if (activeSeats.length === 0) {
    bannerText = 'Spectating live Duckhouse match.';
    bannerVariant = 'neutral';
  } else if (myDuckBoards.length === 2) {
    bannerText = '🦆 DUCK PHASE on BOTH boards! Click an empty square on Board A and Board B to place each duck.';
    bannerVariant = 'duck';
  } else if (myDuckBoards.length === 1) {
    const dBoard = myDuckBoards[0];
    bannerText =
      myChessBoards.length === 1
        ? `🦆 DUCK PHASE on Board ${dBoard}! Place the duck (also your turn on Board ${myChessBoards[0]}).`
        : `🦆 DUCK PHASE! Click any empty square on Board ${dBoard} to place the duck.`;
    bannerVariant = 'duck';
  } else if (myChessBoards.length === 2) {
    bannerText = 'Your turn on BOTH Board A & Board B — move a piece or drop from either pocket!';
    bannerVariant = 'turn';
  } else if (myChessBoards.length === 1) {
    const cBoard = myChessBoards[0];
    bannerText = `Your turn on Board ${cBoard} — move a piece or click a pocket piece to drop it!`;
    bannerVariant = 'turn';
  } else if (isDualControl) {
    bannerText = 'Opponents’ turn on both boards… Get ready on Board A & Board B!';
    bannerVariant = 'neutral';
  } else {
    bannerText = `Opponent’s turn on Board ${primaryBoardId}… Watch your partner on Board ${secondaryBoardId}!`;
    bannerVariant = 'neutral';
  }

  const activeHistory = game.boards[historyBoard].moveHistory;
  const gameTitle =
    isOnline && room
      ? room.name
      : practiceMode === 'bots'
      ? 'Solo Practice vs Bots'
      : practiceMode === 'dual'
      ? '2v1 vs Bots'
      : '4-Seat Sandbox';

  return (
    <main className="dh-page dh-game-page">
      {/* Top Action & Status Bar */}
      <div className="dh-game-topbar">
        <div className="dh-game-topbar-left">
          {isOnline ? (
            <button type="button" className="dh-btn dh-btn-ghost dh-btn-sm" onClick={leaveRoom}>
              <ArrowLeft size={15} /> Lobby
            </button>
          ) : (
            <div className="dh-practice-switcher">
              <button
                type="button"
                className={`dh-seg-btn ${practiceMode === 'bots' ? 'active' : ''}`}
                onClick={() => {
                  if (practiceMode !== 'bots') openPractice('bots', practiceTc);
                }}
              >
                <Bot size={14} /> vs 3 Bots
              </button>
              <button
                type="button"
                className={`dh-seg-btn ${practiceMode === 'dual' ? 'active' : ''}`}
                onClick={() => {
                  if (practiceMode !== 'dual') openPractice('dual', practiceTc);
                }}
              >
                <Layers size={14} /> 2v1 (Both Boards)
              </button>
              <button
                type="button"
                className={`dh-seg-btn ${practiceMode === 'sandbox' ? 'active' : ''}`}
                onClick={() => {
                  if (practiceMode !== 'sandbox') openPractice('sandbox', practiceTc);
                }}
              >
                <Users size={14} /> 4-Seat Sandbox
              </button>
            </div>
          )}

          <div className="dh-game-title-meta">
            <strong>{gameTitle}</strong>
            {isOnline && matchFormat !== '2v2' && (
              <span className="dh-pill-badge emerald">
                <Layers size={12} /> {matchFormat}
              </span>
            )}
            <span className="dh-pill-badge neutral">
              <Clock size={12} /> {isOnline && room ? room.timeControl.label : practiceTc.label}
            </span>
            {isOnline && room && <span className="dh-room-code-chip">{room.code}</span>}
          </div>
        </div>

        <div className="dh-game-topbar-right">
          <button
            type="button"
            className="dh-btn dh-btn-ghost dh-btn-sm"
            onClick={() => setFlipped((f) => !f)}
            title="Flip board perspective"
          >
            <RotateCcw size={14} /> Flip
          </button>

          {game.status === 'playing' && (activeSeats.length > 0 || !isOnline) && (
            <button
              type="button"
              className="dh-btn dh-btn-danger dh-btn-sm"
              onClick={isOnline ? resign : practiceResign}
            >
              <Flag size={14} /> Resign
            </button>
          )}

          {game.status === 'finished' && (isOnline || practiceMode !== 'bots') && (
            <button
              type="button"
              className="dh-btn dh-btn-primary dh-btn-sm"
              onClick={isOnline ? rematch : () => startPracticeGame()}
            >
              <RefreshCw size={14} /> {isOnline ? 'Rematch (Swap Colors)' : 'Play Again'}
            </button>
          )}
        </div>
      </div>

      {/* Turn / Duck / Victory Banner */}
      <div className={`dh-status-banner variant-${bannerVariant}`}>
        <span>{bannerText}</span>
        {!isOnline && game.status === 'waiting' && (
          <div className="dh-banner-actions">
            {practiceMode === 'bots' && (
              <div className="dh-color-picker-inline" role="group" aria-label="Choose your color">
                <span className="dh-color-picker-label">Play as</span>
                <div className="dh-segmented compact">
                  <button
                    type="button"
                    className={practiceColor === 'w' ? 'active' : ''}
                    aria-pressed={practiceColor === 'w'}
                    onClick={() => setPracticeColor('w')}
                  >
                    <span className="dh-color-swatch white" /> White
                  </button>
                  <button
                    type="button"
                    className={practiceColor === 'b' ? 'active' : ''}
                    aria-pressed={practiceColor === 'b'}
                    onClick={() => setPracticeColor('b')}
                  >
                    <span className="dh-color-swatch black" /> Black
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              className="dh-btn dh-btn-primary"
              onClick={() => startPracticeGame()}
            >
              <Play size={16} /> Start Game
            </button>
          </div>
        )}
        {game.status === 'finished' && !isOnline && practiceMode === 'bots' && (
          <div className="dh-banner-actions">
            <div className="dh-color-picker-inline" role="group" aria-label="Choose next color">
              <span className="dh-color-picker-label">Play again as</span>
              <div className="dh-segmented compact">
                <button
                  type="button"
                  className={nextBotsColor === 'w' ? 'active' : ''}
                  aria-pressed={nextBotsColor === 'w'}
                  onClick={() => setNextBotsColor('w')}
                >
                  <span className="dh-color-swatch white" /> White
                </button>
                <button
                  type="button"
                  className={nextBotsColor === 'b' ? 'active' : ''}
                  aria-pressed={nextBotsColor === 'b'}
                  onClick={() => setNextBotsColor('b')}
                >
                  <span className="dh-color-swatch black" /> Black
                </button>
              </div>
            </div>
            <button
              type="button"
              className="dh-btn dh-btn-primary dh-btn-sm"
              onClick={() => startPracticeGame(nextBotsColor)}
            >
              <Play size={14} /> Start Game
            </button>
          </div>
        )}
        {game.status === 'finished' && (isOnline || practiceMode !== 'bots') && (
          <button
            type="button"
            className="dh-btn dh-btn-primary dh-btn-sm"
            onClick={isOnline ? rematch : () => startPracticeGame()}
          >
            <Crown size={14} /> {isOnline ? 'Rematch' : 'New Match'}
          </button>
        )}
      </div>

      {/* Main Arena: Board A + Board B + Sidebar */}
      <div className="dh-arena-grid">
        <div className="dh-boards-pair">
          {renderBoardColumn(primaryBoardId, primaryOrientation, true)}
          {renderBoardColumn(secondaryBoardId, secondaryOrientation, false)}
        </div>

        <aside className="dh-game-sidebar">
          {!isOnline && (
            <div className="dh-card dh-practice-panel">
              <div className="dh-panel-heading">Practice Settings</div>
              {practiceMode === 'bots' && (
                <div className="dh-field">
                  <span>{game.status === 'finished' ? 'Next Game Color' : 'Your Color'}</span>
                  <div
                    className="dh-segmented"
                    role="group"
                    aria-label="Choose your color"
                    title={game.status === 'playing' ? 'Reset match to change color' : undefined}
                  >
                    <button
                      type="button"
                      className={(game.status === 'finished' ? nextBotsColor : practiceColor) === 'w' ? 'active' : ''}
                      aria-pressed={(game.status === 'finished' ? nextBotsColor : practiceColor) === 'w'}
                      disabled={game.status === 'playing'}
                      onClick={() =>
                        game.status === 'finished' ? setNextBotsColor('w') : setPracticeColor('w')
                      }
                    >
                      <span className="dh-color-swatch white" /> White
                    </button>
                    <button
                      type="button"
                      className={(game.status === 'finished' ? nextBotsColor : practiceColor) === 'b' ? 'active' : ''}
                      aria-pressed={(game.status === 'finished' ? nextBotsColor : practiceColor) === 'b'}
                      disabled={game.status === 'playing'}
                      onClick={() =>
                        game.status === 'finished' ? setNextBotsColor('b') : setPracticeColor('b')
                      }
                    >
                      <span className="dh-color-swatch black" /> Black
                    </button>
                  </div>
                </div>
              )}
              <label className="dh-field">
                <span>Time Control</span>
                <select
                  value={practiceTc.id}
                  onChange={(e) => {
                    const tc = TIME_CONTROLS.find((t) => t.id === e.target.value) ?? TIME_CONTROLS[2];
                    openPractice(practiceMode, tc);
                  }}
                >
                  {TIME_CONTROLS.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.id} — {tc.label}
                    </option>
                  ))}
                </select>
              </label>
              {game.status === 'waiting' ? (
                <button
                  type="button"
                  className="dh-btn dh-btn-primary dh-btn-full"
                  onClick={() => startPracticeGame()}
                >
                  <Play size={15} /> Start Game
                </button>
              ) : game.status === 'playing' ? (
                <button
                  type="button"
                  className="dh-btn dh-btn-secondary dh-btn-full dh-btn-sm"
                  onClick={resetPracticeGame}
                >
                  <RefreshCw size={14} /> Reset Match
                </button>
              ) : practiceMode === 'bots' ? (
                <button
                  type="button"
                  className="dh-btn dh-btn-primary dh-btn-full dh-btn-sm"
                  onClick={() => startPracticeGame(nextBotsColor)}
                >
                  <Play size={14} /> Start as {nextBotsColor === 'w' ? 'White' : 'Black'}
                </button>
              ) : (
                <button
                  type="button"
                  className="dh-btn dh-btn-primary dh-btn-full dh-btn-sm"
                  onClick={() => startPracticeGame()}
                >
                  <RefreshCw size={14} /> Play Again
                </button>
              )}
            </div>
          )}

          {/* Dual-Board Move History */}
          <div className="dh-card dh-history-panel">
            <div className="dh-history-head">
              <div className="dh-panel-heading">
                <History size={15} /> Move Log
              </div>
              <div className="dh-history-tabs">
                <button
                  type="button"
                  className={historyBoard === 'A' ? 'active' : ''}
                  onClick={() => setHistoryBoard('A')}
                >
                  Board A ({game.boards.A.moveHistory.length})
                </button>
                <button
                  type="button"
                  className={historyBoard === 'B' ? 'active' : ''}
                  onClick={() => setHistoryBoard('B')}
                >
                  Board B ({game.boards.B.moveHistory.length})
                </button>
              </div>
            </div>

            <div className="dh-history-list">
              {activeHistory.length === 0 ? (
                <div className="dh-history-empty">No moves yet on Board {historyBoard}.</div>
              ) : (
                Array.from({ length: Math.ceil(activeHistory.length / 2) }).map((_, idx) => {
                  const wMove = activeHistory[idx * 2];
                  const bMove = activeHistory[idx * 2 + 1];
                  return (
                    <div key={idx} className="dh-history-row">
                      <span className="dh-move-num">{idx + 1}.</span>
                      <span className="dh-move-cell">{wMove?.notation ?? ''}</span>
                      <span className="dh-move-cell">{bMove?.notation ?? ''}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Online Team Chat */}
          {isOnline && room && (
            <TeamChat
              messages={room.chat}
              mySeats={mySeats}
              isSoloTeam={isDualControl}
              onSend={sendChat}
            />
          )}
        </aside>
      </div>
    </main>
  );
};
