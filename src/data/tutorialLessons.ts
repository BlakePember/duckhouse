import {
  BoardId,
  BoardState,
  Color,
  DroppablePieceType,
  GameState,
  Piece,
  PieceType,
  PocketCounts,
  TIME_CONTROLS,
} from '../../shared/types';
import {
  algebraicToSquare,
  applyChessMove,
  applyDuckMove,
  createEmptyPocket,
  getAllLegalChessMoves,
  getLegalDuckSquares,
  squareToAlgebraic,
} from '../../shared/engine';

export type TutorialAction =
  | { kind: 'move'; boardId: BoardId; from: number; to: number }
  | { kind: 'drop'; boardId: BoardId; pieceType: DroppablePieceType; to: number }
  | { kind: 'duck'; boardId: BoardId; to: number };

export interface TutorialStepValidation {
  ok: boolean;
  feedback: string;
}

export interface TutorialStep {
  id: string;
  boardId: BoardId;
  expectedPhase: 'chess' | 'duck';
  badgeText: string;
  prompt: string;
  subtip: string;
  hintText: string;
  getHintSquares?: (state: GameState) => { from?: number[]; targets?: number[] };
  getThreatSquares?: (state: GameState) => number[];
  highlightPocketPiece?: DroppablePieceType;
  validate: (
    action: TutorialAction,
    prevState: GameState,
    nextState: GameState
  ) => TutorialStepValidation;
  autoResponse?: (state: GameState) => { state: GameState; narration: string } | null;
}

export interface TutorialLesson {
  id: string;
  number: number;
  shortTitle: string;
  title: string;
  badge: string;
  summary: string;
  whyItMatters: string;
  layout: 'single' | 'dual';
  showPocketA?: boolean;
  showPocketB?: boolean;
  completionTitle: string;
  completionMessage: string;
  createInitialState: () => GameState;
  steps: TutorialStep[];
}

export interface PieceGuideItem {
  name: string;
  asset: string;
  rule: string;
  duckNote: string;
}

export const PIECE_GUIDE: PieceGuideItem[] = [
  {
    name: 'Pawn',
    asset: 'pieces/pawn-w.svg',
    rule: 'Moves forward 1 square (or 2 from its starting row) and captures 1 square diagonally.',
    duckNote: 'Blocked by the Duck. Cannot be dropped on ranks 1 or 8.',
  },
  {
    name: 'Knight',
    asset: 'pieces/knight-w.svg',
    rule: 'Moves in an L-shape: 2 squares one way, then 1 square sideways.',
    duckNote: 'The ONLY piece that can jump right over the Duck!',
  },
  {
    name: 'Bishop',
    asset: 'pieces/bishop-w.svg',
    rule: 'Slides any number of open squares diagonally.',
    duckNote: 'Cannot pass through or land on the Duck.',
  },
  {
    name: 'Rook',
    asset: 'pieces/rook-w.svg',
    rule: 'Slides any number of open squares horizontally or vertically.',
    duckNote: 'Cannot pass through or land on the Duck.',
  },
  {
    name: 'Queen',
    asset: 'pieces/queen-w.svg',
    rule: 'Slides in any straight or diagonal line — the strongest attacker.',
    duckNote: 'Cannot pass through or land on the Duck.',
  },
  {
    name: 'King',
    asset: 'pieces/king-w.svg',
    rule: 'Moves 1 square in any direction. No check rule in Duckhouse!',
    duckNote: 'Capture either enemy King to win the match immediately.',
  },
  {
    name: 'The Duck',
    asset: 'duck.png',
    rule: 'Shared by both players on a board. After EVERY move or drop, you must move it to a new empty square.',
    duckNote: 'Indestructible wall — blocks sliding pieces, movement, and drops.',
  },
];

function sq(alg: string): number {
  const idx = algebraicToSquare(alg);
  if (idx < 0) throw new Error(`Invalid algebraic square: ${alg}`);
  return idx;
}

interface CustomBoardSpec {
  pieces: Array<{ at: string; type: PieceType; color: Color; promoted?: boolean }>;
  duck?: string | null;
  turn?: Color;
  phase?: 'chess' | 'duck';
  pockets?: Partial<Record<Color, Partial<PocketCounts>>>;
}

function createCustomBoard(id: BoardId, spec: CustomBoardSpec): BoardState {
  const squares: (Piece | null)[] = Array(64).fill(null);
  for (const p of spec.pieces) {
    squares[sq(p.at)] = {
      type: p.type,
      color: p.color,
      promoted: p.promoted ?? false,
    };
  }
  return {
    id,
    squares,
    duckSquare: spec.duck ? sq(spec.duck) : null,
    turn: spec.turn ?? 'w',
    phase: spec.phase ?? 'chess',
    castling: { wK: false, wQ: false, bK: false, bQ: false },
    enPassant: null,
    pockets: {
      w: { ...createEmptyPocket(), ...(spec.pockets?.w ?? {}) },
      b: { ...createEmptyPocket(), ...(spec.pockets?.b ?? {}) },
    },
    lastMove: null,
    lastDuckMove: null,
    moveHistory: [],
  };
}

function createTutorialGame(boardA: CustomBoardSpec, boardB?: CustomBoardSpec): GameState {
  const initialMs = TIME_CONTROLS[4].initialMs;
  return {
    boards: {
      A: createCustomBoard('A', boardA),
      B: createCustomBoard(
        'B',
        boardB ?? {
          pieces: [
            { at: 'e1', type: 'k', color: 'w' },
            { at: 'e8', type: 'k', color: 'b' },
          ],
          duck: null,
          turn: 'b',
        }
      ),
    },
    clocks: {
      A_w: initialMs,
      A_b: initialMs,
      B_w: initialMs,
      B_b: initialMs,
    },
    status: 'playing',
    winnerTeam: null,
    winReason: null,
    winningBoard: null,
    startedAt: null,
    lastClockTickAt: null,
  };
}

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  // =========================================================================
  // LESSON 1: Meet the Duck (2-Step Turns)
  // =========================================================================
  {
    id: 'meet-duck',
    number: 1,
    shortTitle: '1. The Duck',
    title: 'Meet the Duck: Every Turn Has 2 Steps',
    badge: 'Duck Chess Basics',
    summary: 'Learn the core rhythm of Duckhouse: make a chess move, then move the Duck to finish your turn.',
    whyItMatters:
      'In normal chess, your turn ends after one move. In Duckhouse, every turn has TWO halves: first make your chess move, then place (or move) the yellow Duck onto an empty square.',
    layout: 'single',
    completionTitle: 'Two-Step Turn Mastered!',
    completionMessage:
      'Every turn in Duckhouse follows that exact rhythm: Chess Move → Move the Duck. Both players share the same Duck and must relocate it to a new square every turn.',
    createInitialState: () =>
      createTutorialGame({
        pieces: [
          { at: 'g1', type: 'k', color: 'w' },
          { at: 'a4', type: 'r', color: 'w' },
          { at: 'e2', type: 'p', color: 'w' },
          { at: 'e8', type: 'k', color: 'b' },
          { at: 'e7', type: 'r', color: 'b' },
          { at: 'f7', type: 'p', color: 'b' },
          { at: 'g7', type: 'p', color: 'b' },
        ],
        duck: null,
        turn: 'w',
      }),
    steps: [
      {
        id: 'l1-move',
        boardId: 'A',
        expectedPhase: 'chess',
        badgeText: 'Step 1 of 2 · Chess Move',
        prompt: 'Start your turn like regular chess: advance your White Pawn from e2 to e4 (or make any legal White move).',
        subtip: 'Click any White piece to see dots for its legal moves — or drag and drop it.',
        hintText: 'Click the White Pawn on e2, then click the highlighted dot on e4.',
        getHintSquares: () => ({ from: [sq('e2')], targets: [sq('e4')] }),
        validate: (action) => {
          if (action.kind !== 'move') {
            return { ok: false, feedback: 'Make a chess move with one of your White pieces first.' };
          }
          if (action.from === sq('e2') && action.to === sq('e4')) {
            return {
              ok: true,
              feedback:
                'Nice move! Notice the board now glows gold — that means it’s Duck Phase. Your turn isn’t finished yet!',
            };
          }
          return {
            ok: true,
            feedback:
              'Good move! Notice the board now glows gold — that means it’s Duck Phase. Place the Duck to end your turn!',
          };
        },
      },
      {
        id: 'l1-duck',
        boardId: 'A',
        expectedPhase: 'duck',
        badgeText: 'Step 2 of 2 · Place the Duck',
        prompt: 'Finish your turn by clicking any empty square to place the Duck! Try e5 to stand in front of Black’s Rook.',
        subtip: 'Hover empty squares to preview the Duck, then click to place it.',
        hintText: 'Click empty square e5 (or any empty square on the board) to place the Duck.',
        getHintSquares: () => ({ targets: [sq('e5')] }),
        validate: (action) => {
          if (action.kind !== 'duck') {
            return { ok: false, feedback: 'Click any empty square on the board to place the Duck.' };
          }
          const blockedEFile = [sq('e3'), sq('e5'), sq('e6')].includes(action.to);
          return {
            ok: true,
            feedback: blockedEFile
              ? `Great placement on ${squareToAlgebraic(action.to)} — right in front of Black’s Rook! Watch Black reply…`
              : `Duck placed on ${squareToAlgebraic(action.to)}! Your turn is complete — watch how Black must also move the Duck…`,
          };
        },
        autoResponse: (state) => {
          // Pick a guaranteed legal Black move
          const preferredMoves: Array<[string, string]> = [
            ['f7', 'f6'],
            ['g7', 'g6'],
            ['e8', 'd8'],
            ['e8', 'f8'],
          ];
          const allLegal = getAllLegalChessMoves(state.boards.A);
          let chosen = allLegal[0];
          for (const [f, t] of preferredMoves) {
            const match = allLegal.find((m) => m.from === sq(f) && m.to === sq(t));
            if (match) {
              chosen = match;
              break;
            }
          }
          if (!chosen) return null;
          const afterMove = applyChessMove(state, 'A', chosen.from, chosen.to);
          if (!afterMove.ok) return null;

          const legalDucks = getLegalDuckSquares(afterMove.state.boards.A);
          const preferredDucks = ['c5', 'd5', 'c4', 'b5', 'f5'].map(sq);
          const duckTarget = preferredDucks.find((d) => legalDucks.includes(d)) ?? legalDucks[0];
          if (duckTarget === undefined) return null;

          const afterDuck = applyDuckMove(afterMove.state, 'A', duckTarget);
          if (!afterDuck.ok) return null;

          return {
            state: afterDuck.state,
            narration: `Black moved and had to relocate the Duck to ${squareToAlgebraic(
              duckTarget
            )} — the Duck can NEVER stay in the same square two turns in a row!`,
          };
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 2: Blocking & Jumping the Duck
  // =========================================================================
  {
    id: 'duck-block-jump',
    number: 2,
    shortTitle: '2. Block & Jump',
    title: 'Blocking Sliders & Jumping Over the Duck',
    badge: 'Duck Tactics',
    summary: 'See how the Duck blocks Rooks, Bishops, and Queens — while Knights leap right over it!',
    whyItMatters:
      'The Duck is an indestructible brick wall. No piece can capture it, and sliding pieces (Queens, Rooks, Bishops) cannot pass through it. Only Knights can jump over the Duck!',
    layout: 'single',
    completionTitle: 'Duck Wall & Knight Leap Mastered!',
    completionMessage:
      'You jumped past the Duck with your Knight, then dropped the Duck right in front of Black’s Rook to shield yourself. Use the Duck both to defend your pieces and ruin your opponent’s plans!',
    createInitialState: () =>
      createTutorialGame({
        pieces: [
          { at: 'g1', type: 'k', color: 'w' },
          { at: 'd1', type: 'r', color: 'w' },
          { at: 'e4', type: 'n', color: 'w' },
          { at: 'h8', type: 'k', color: 'b' },
          { at: 'a6', type: 'r', color: 'b' },
          { at: 'd6', type: 'q', color: 'b' },
        ],
        duck: 'd4',
        turn: 'w',
      }),
    steps: [
      {
        id: 'l2-jump',
        boardId: 'A',
        expectedPhase: 'chess',
        badgeText: 'Step 1 of 2 · Jump the Duck',
        prompt:
          'Try clicking your Rook on d1 — notice the Duck on d4 blocks it! Instead, leap over the Duck with your Knight on e4 to capture Black’s Queen on d6.',
        subtip: 'Knights move in an L-shape and are the only piece that can jump over the Duck.',
        hintText: 'Click your White Knight on e4, then click Black’s Queen on d6.',
        getHintSquares: () => ({ from: [sq('e4')], targets: [sq('d6')] }),
        validate: (action) => {
          if (action.kind === 'move' && action.from === sq('e4') && action.to === sq('d6')) {
            return {
              ok: true,
              feedback:
                'Great Knight jump! Watch out — Black’s Rook on a6 (highlighted red) is now aiming straight across rank 6 at your Knight!',
            };
          }
          if (action.kind === 'move' && action.from === sq('d1')) {
            return {
              ok: false,
              feedback:
                'Your Rook on d1 is stopped by the Duck on d4 — sliding pieces can’t pass through it! Click your Knight on e4 to jump over the Duck and capture d6.',
            };
          }
          return {
            ok: false,
            feedback:
              'Almost! Click your White Knight on e4 and capture Black’s Queen on d6 by jumping past the Duck.',
          };
        },
      },
      {
        id: 'l2-block',
        boardId: 'A',
        expectedPhase: 'duck',
        badgeText: 'Step 2 of 2 · Shield with the Duck',
        prompt: 'Shield your Knight! Move the Duck from d4 onto b6 or c6 to block Black’s Rook on a6.',
        subtip: 'Place the Duck anywhere along rank 6 between Black’s Rook (a6) and your Knight (d6).',
        hintText: 'Click square b6 or c6 to drop the Duck right in front of Black’s Rook.',
        getHintSquares: () => ({ targets: [sq('b6'), sq('c6')] }),
        getThreatSquares: () => [sq('a6')],
        validate: (action) => {
          if (action.kind === 'duck' && (action.to === sq('b6') || action.to === sq('c6'))) {
            return {
              ok: true,
              feedback: `Brick wall on ${squareToAlgebraic(
                action.to
              )}! Black’s Rook on a6 can’t slide through the Duck to take your Knight.`,
            };
          }
          return {
            ok: false,
            feedback:
              'Careful — Black’s Rook on a6 can still slide straight across rank 6 to capture your Knight on d6! Move the Duck to b6 or c6 to block its lane.',
          };
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 3: No Check — Capture the King to Win!
  // =========================================================================
  {
    id: 'capture-king',
    number: 3,
    shortTitle: '3. Capture King',
    title: 'No Check or Checkmate — Capture the King!',
    badge: 'Win Condition',
    summary: 'Forget checkmate! In Duckhouse, you win immediately by capturing an enemy King.',
    whyItMatters:
      'Official Duck Chess removes "check" completely. Even if your own King is under attack, you don’t have to move it — you can block with the Duck, or win immediately by capturing the opponent’s King first!',
    layout: 'single',
    completionTitle: 'King Captured — Instant Victory!',
    completionMessage:
      'There is no check or checkmate in Duckhouse — the first team to physically capture either enemy King (or win on time) wins the entire 2v2 match on the spot!',
    createInitialState: () =>
      createTutorialGame({
        pieces: [
          { at: 'e1', type: 'k', color: 'w' },
          { at: 'b3', type: 'q', color: 'w' },
          { at: 'f2', type: 'p', color: 'w' },
          { at: 'g2', type: 'p', color: 'w' },
          { at: 'h2', type: 'p', color: 'w' },
          { at: 'g8', type: 'k', color: 'b' },
          { at: 'e5', type: 'r', color: 'b' },
          { at: 'e7', type: 'p', color: 'b' },
          { at: 'g7', type: 'p', color: 'b' },
          { at: 'h7', type: 'p', color: 'b' },
        ],
        duck: 'c6',
        turn: 'w',
      }),
    steps: [
      {
        id: 'l3-take-king',
        boardId: 'A',
        expectedPhase: 'chess',
        badgeText: 'Step 1 of 1 · Capture the Enemy King',
        prompt:
          'Black’s Rook on e5 is attacking your King on e1 — in standard chess you’d be forced out of check. Ignore it and capture Black’s King on g8 with your Queen (b3 → g8)!',
        subtip: 'Look along the open diagonal from your Queen on b3 up to Black’s King on g8.',
        hintText: 'Click your White Queen on b3, then click Black’s King on g8 to win immediately!',
        getHintSquares: () => ({ from: [sq('b3')], targets: [sq('g8')] }),
        getThreatSquares: () => [sq('e5')],
        validate: (action, _prev, nextState) => {
          if (action.kind === 'move' && action.from === sq('b3') && action.to === sq('g8') && nextState.status === 'finished') {
            return {
              ok: true,
              feedback:
                'BOOM! King captured — you win immediately! Notice you don’t even need a Duck move after capturing a King.',
            };
          }
          if (action.kind === 'move' && action.from === sq('e1')) {
            return {
              ok: false,
              feedback:
                'Classic chess instinct! In regular chess you’d have to save your King from check — but Duckhouse has NO check rule! Capture Black’s King on g8 with your Queen (b3 → g8) to win right now.',
            };
          }
          return {
            ok: false,
            feedback:
              'You can win on this exact move! Click your White Queen on b3 and slide diagonally all the way to capture Black’s King on g8.',
          };
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 4: Two Boards, Two Teams (Bughouse Transfers)
  // =========================================================================
  {
    id: 'bughouse-transfer',
    number: 4,
    shortTitle: '4. Team Pocket',
    title: 'Two Boards, Two Teams: Feeding Your Partner',
    badge: 'Bughouse 2v2',
    summary: 'See how pieces you capture on Board A flip color and teleport into your Partner’s Pocket on Board B!',
    whyItMatters:
      'Duckhouse is a 2v2 team game. Team Emerald is YOU (Board A White) + your PARTNER (Board B Black). Because your Partner plays the opposite color, every enemy piece you capture becomes a reinforcement for their team!',
    layout: 'dual',
    showPocketB: true,
    completionTitle: 'Bughouse Transfer Unlocked!',
    completionMessage:
      'Every capture you make arms your teammate on the neighboring board — and every capture they make arms you! (Fun detail: if you capture a promoted piece, it reverts back into a Pawn in your partner’s pocket.)',
    createInitialState: () =>
      createTutorialGame(
        {
          pieces: [
            { at: 'g1', type: 'k', color: 'w' },
            { at: 'd4', type: 'q', color: 'w' },
            { at: 'f2', type: 'p', color: 'w' },
            { at: 'g2', type: 'p', color: 'w' },
            { at: 'h2', type: 'p', color: 'w' },
            { at: 'h8', type: 'k', color: 'b' },
            { at: 'd7', type: 'r', color: 'b' },
            { at: 'g7', type: 'p', color: 'b' },
            { at: 'h7', type: 'p', color: 'b' },
          ],
          duck: 'b4',
          turn: 'w',
        },
        {
          pieces: [
            { at: 'e1', type: 'k', color: 'w' },
            { at: 'd2', type: 'p', color: 'w' },
            { at: 'f2', type: 'p', color: 'w' },
            { at: 'g8', type: 'k', color: 'b' },
            { at: 'f7', type: 'p', color: 'b' },
            { at: 'g7', type: 'p', color: 'b' },
            { at: 'h7', type: 'p', color: 'b' },
          ],
          duck: 'c3',
          turn: 'b',
        }
      ),
    steps: [
      {
        id: 'l4-capture',
        boardId: 'A',
        expectedPhase: 'chess',
        badgeText: 'Step 1 of 2 · Capture on Board A',
        prompt:
          'Your Partner on Board B has an empty pocket. On Board A, capture Black’s Rook on d7 with your Queen (d4 → d7) — watch Board B’s Pocket!',
        subtip: 'Play on Board A (Your Board). Click your White Queen on d4, then click Black’s Rook on d7.',
        hintText: 'On Board A, click the White Queen on d4, then click Black’s Rook on d7.',
        getHintSquares: () => ({ from: [sq('d4')], targets: [sq('d7')] }),
        validate: (action, _prev, nextState) => {
          if (
            action.kind === 'move' &&
            action.boardId === 'A' &&
            action.from === sq('d4') &&
            action.to === sq('d7') &&
            nextState.boards.B.pockets.b.r === 1
          ) {
            return {
              ok: true,
              feedback:
                'Look over at Board B! Your captured Rook flipped to Black and appeared in Partner’s Pocket (+1 Rook)! Now place Board A’s Duck to finish your turn.',
            };
          }
          return {
            ok: false,
            feedback:
              'On Board A, capture Black’s Rook on d7 with your White Queen on d4 so it transfers to your Partner’s Pocket!',
          };
        },
      },
      {
        id: 'l4-duck',
        boardId: 'A',
        expectedPhase: 'duck',
        badgeText: 'Step 2 of 2 · Move Board A’s Duck',
        prompt: 'Finish your turn on Board A by clicking any empty square to move the Duck off b4.',
        subtip: 'Remember: after every move or capture, you must relocate the Duck.',
        hintText: 'Click any empty square on Board A (such as d5) to complete your turn.',
        getHintSquares: () => ({ targets: [sq('d5')] }),
        validate: (action) => {
          if (action.kind === 'duck' && action.boardId === 'A') {
            return {
              ok: true,
              feedback:
                'Turn complete! Now your Partner has a shiny Black Rook ready to drop anywhere on Board B.',
            };
          }
          return { ok: false, feedback: 'Click any empty square on Board A to move the Duck.' };
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 5: Dropping Pieces from Your Pocket
  // =========================================================================
  {
    id: 'pocket-drop',
    number: 5,
    shortTitle: '5. Piece Drops',
    title: 'Dropping Reinforcements from Your Pocket',
    badge: 'Bughouse Drops',
    summary: 'Spend pieces your Partner sent you by dropping them straight onto empty squares!',
    whyItMatters:
      'On your turn, instead of moving a piece on the board, you can DROP a piece from your Pocket onto any empty square! Two quick rules: you can’t drop onto the Duck, and Pawns can’t drop on rank 1 or rank 8.',
    layout: 'single',
    showPocketA: true,
    completionTitle: 'Pocket Drops Mastered!',
    completionMessage:
      'You dropped a Knight straight out of your pocket to threaten the King over the Duck, then boxed it in with the Duck. Pocket drops turn defense into sudden attacks in a single move!',
    createInitialState: () =>
      createTutorialGame({
        pieces: [
          { at: 'g1', type: 'k', color: 'w' },
          { at: 'f2', type: 'p', color: 'w' },
          { at: 'g2', type: 'p', color: 'w' },
          { at: 'h2', type: 'p', color: 'w' },
          { at: 'e8', type: 'k', color: 'b' },
          { at: 'h8', type: 'r', color: 'b' },
          { at: 'd7', type: 'p', color: 'b' },
          { at: 'f7', type: 'p', color: 'b' },
        ],
        duck: 'e7',
        turn: 'w',
        pockets: {
          w: { n: 1, p: 1 },
        },
      }),
    steps: [
      {
        id: 'l5-drop',
        boardId: 'A',
        expectedPhase: 'chess',
        badgeText: 'Step 1 of 2 · Drop a Pocket Piece',
        prompt:
          'Your Partner sent you a Knight and a Pawn (check Your Pocket below the board!). Click the Knight in Your Pocket and drop it on d6 or f6 to threaten Black’s King right over the Duck!',
        subtip:
          'Bonus: click the Pawn in Your Pocket first if you want to see how yellow drop dots skip ranks 1 & 8 and the Duck — then click the Knight!',
        hintText: 'Click the White Knight in Your Pocket below the board, then click square d6 or f6.',
        highlightPocketPiece: 'n',
        getHintSquares: () => ({ targets: [sq('d6'), sq('f6')] }),
        validate: (action) => {
          if (
            action.kind === 'drop' &&
            action.pieceType === 'n' &&
            (action.to === sq('d6') || action.to === sq('f6'))
          ) {
            return {
              ok: true,
              feedback: `Sweet drop on ${squareToAlgebraic(
                action.to
              )}! Your Knight attacks Black’s King right over the Duck. Remember: a drop counts as your chess move, so now move the Duck!`,
            };
          }
          if (action.kind === 'move') {
            return {
              ok: false,
              feedback:
                'Instead of moving a piece already on the board, click the Knight inside Your Pocket below the board and drop it onto d6 or f6!',
            };
          }
          if (action.kind === 'drop' && action.pieceType === 'p') {
            return {
              ok: false,
              feedback:
                'Good Pawn test (notice Pawns can only drop on ranks 2–7)! For this tactic, select the Knight in Your Pocket and drop it on d6 or f6 to attack Black’s King over the Duck.',
            };
          }
          return {
            ok: false,
            feedback:
              'Almost! Drop your Knight onto d6 or f6 so its L-shape jump threatens Black’s King on e8 right over the Duck.',
          };
        },
      },
      {
        id: 'l5-duck',
        boardId: 'A',
        expectedPhase: 'duck',
        badgeText: 'Step 2 of 2 · Trap with the Duck',
        prompt: 'Move the Duck off e7 onto d8 or f8 right beside Black’s King to cut off its escape!',
        subtip: 'Click d8 or f8 (either empty square next to Black’s King on rank 8).',
        hintText: 'Click square d8 or f8 to place the Duck next to Black’s King.',
        getHintSquares: () => ({ targets: [sq('d8'), sq('f8')] }),
        validate: (action) => {
          if (action.kind === 'duck' && (action.to === sq('d8') || action.to === sq('f8'))) {
            return {
              ok: true,
              feedback: `Locked in! Moving the Duck to ${squareToAlgebraic(
                action.to
              )} cuts off the King’s escape while your dropped Knight threatens to capture it.`,
            };
          }
          return {
            ok: false,
            feedback: 'Place the Duck right next to Black’s King on d8 or f8 to block its escape!',
          };
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 6: Full 2-Board Duckhouse Combo!
  // =========================================================================
  {
    id: 'full-combo',
    number: 6,
    shortTitle: '6. Full Combo',
    title: 'Final Challenge: Pull Off a 2-Board Team Win!',
    badge: 'Final Challenge',
    summary: 'Play both seats of Team Emerald to combine Captures, Duck Shields, Pocket Drops, and a King Capture win!',
    whyItMatters:
      'This is what real Duckhouse feels like! You’ll capture a Knight on Board A to feed your Partner, shield your Queen with Board A’s Duck, then switch to Board B to drop that Knight, trap the enemy King, and capture it for the win!',
    layout: 'dual',
    showPocketB: true,
    completionTitle: 'You’re Ready for Duckhouse!',
    completionMessage:
      'You just pulled off a full Capture → Partner Transfer → Duck Shield → Pocket Drop → Knight-Jump King Capture combo! Jump into Solo Practice vs Bots or hop into the Online Lobby!',
    createInitialState: () =>
      createTutorialGame(
        {
          pieces: [
            { at: 'g1', type: 'k', color: 'w' },
            { at: 'e5', type: 'q', color: 'w' },
            { at: 'f2', type: 'p', color: 'w' },
            { at: 'g2', type: 'p', color: 'w' },
            { at: 'h2', type: 'p', color: 'w' },
            { at: 'e8', type: 'k', color: 'b' },
            { at: 'c6', type: 'r', color: 'b' },
            { at: 'e6', type: 'n', color: 'b' },
            { at: 'f7', type: 'p', color: 'b' },
          ],
          duck: 'f5',
          turn: 'w',
        },
        {
          pieces: [
            { at: 'e1', type: 'k', color: 'w' },
            { at: 'a1', type: 'r', color: 'w' },
            { at: 'f1', type: 'b', color: 'w' },
            { at: 'd2', type: 'p', color: 'w' },
            { at: 'f2', type: 'p', color: 'w' },
            { at: 'g8', type: 'k', color: 'b' },
            { at: 'e4', type: 'r', color: 'b' },
            { at: 'g7', type: 'p', color: 'b' },
            { at: 'h7', type: 'p', color: 'b' },
          ],
          duck: 'e2',
          turn: 'b',
        }
      ),
    steps: [
      {
        id: 'l6-capture',
        boardId: 'A',
        expectedPhase: 'chess',
        badgeText: 'Step 1 of 5 · Board A Capture',
        prompt:
          'On Board A (left), capture Black’s Knight on e6 with your Queen (e5 → e6) to send a Knight to your Partner on Board B!',
        subtip: 'Click your White Queen on e5, then click Black’s Knight on e6.',
        hintText: 'On Board A, move your White Queen from e5 to e6.',
        getHintSquares: () => ({ from: [sq('e5')], targets: [sq('e6')] }),
        validate: (action) => {
          if (action.kind === 'move' && action.boardId === 'A' && action.from === sq('e5') && action.to === sq('e6')) {
            return {
              ok: true,
              feedback:
                'Captured! A Black Knight just landed in your Partner’s Pocket on Board B. First, shield your Queen on Board A!',
            };
          }
          return {
            ok: false,
            feedback:
              'On Board A, capture Black’s Knight on e6 with your White Queen on e5 so your Partner gets a Knight!',
          };
        },
      },
      {
        id: 'l6-duck-a',
        boardId: 'A',
        expectedPhase: 'duck',
        badgeText: 'Step 2 of 5 · Board A Duck Shield',
        prompt: 'Black’s Rook on c6 wants to recapture your Queen! Move Board A’s Duck to d6 to block it.',
        subtip: 'Click empty square d6 on Board A between Black’s Rook (c6) and your Queen (e6).',
        hintText: 'Click square d6 on Board A to place the Duck in front of Black’s Rook.',
        getHintSquares: () => ({ targets: [sq('d6')] }),
        getThreatSquares: () => [sq('c6')],
        validate: (action) => {
          if (action.kind === 'duck' && action.boardId === 'A' && action.to === sq('d6')) {
            return {
              ok: true,
              feedback:
                'Queen shielded! Now look over at Board B (right) — it’s your Partner’s turn to use that gifted Knight!',
            };
          }
          return {
            ok: false,
            feedback:
              'Block Black’s Rook on c6 by placing Board A’s Duck on d6 right between c6 and your Queen on e6!',
          };
        },
      },
      {
        id: 'l6-drop-b',
        boardId: 'B',
        expectedPhase: 'chess',
        badgeText: 'Step 3 of 5 · Board B Pocket Drop',
        prompt:
          'Now play as your Partner on Board B (right)! Click the Black Knight in Partner’s Pocket and drop it on f3 or d3 to attack White’s King!',
        subtip: 'Click the glowing Black Knight in the Pocket below Board B, then click f3 or d3.',
        hintText: 'Click the Black Knight in Partner’s Pocket below Board B, then click f3 or d3 on Board B.',
        highlightPocketPiece: 'n',
        getHintSquares: () => ({ targets: [sq('f3'), sq('d3')] }),
        validate: (action) => {
          if (
            action.kind === 'drop' &&
            action.boardId === 'B' &&
            action.pieceType === 'n' &&
            (action.to === sq('f3') || action.to === sq('d3'))
          ) {
            return {
              ok: true,
              feedback: `Great drop on ${squareToAlgebraic(
                action.to
              )}! Now move Board B’s Duck to trap White’s King and unleash your Rook!`,
            };
          }
          return {
            ok: false,
            feedback:
              'Click the Black Knight in Partner’s Pocket below Board B and drop it onto f3 or d3 to threaten White’s King on e1!',
          };
        },
      },
      {
        id: 'l6-duck-b',
        boardId: 'B',
        expectedPhase: 'duck',
        badgeText: 'Step 4 of 5 · Board B Duck Trap',
        prompt:
          'Move Board B’s Duck off e2 onto d1 — blocking White’s King from running away AND opening your Black Rook on e4!',
        subtip: 'Look at the top row of Board B: d1 is the empty square right next to White’s King.',
        hintText: 'Click square d1 on Board B (next to White’s King on e1) to trap it!',
        getHintSquares: () => ({ targets: [sq('d1')] }),
        validate: (action) => {
          if (action.kind === 'duck' && action.boardId === 'B' && action.to === sq('d1')) {
            return {
              ok: true,
              feedback: 'White’s King is double-attacked and boxed in! Watch White try to defend…',
            };
          }
          return {
            ok: false,
            feedback:
              'Place Board B’s Duck on d1 (next to White’s King on e1) to block its escape and uncover your Rook!',
          };
        },
        autoResponse: (state) => {
          const afterMove = applyChessMove(state, 'B', sq('a1'), sq('b1'));
          if (!afterMove.ok) return null;
          const afterDuck = applyDuckMove(afterMove.state, 'B', sq('e2'));
          if (!afterDuck.ok) return null;
          return {
            state: afterDuck.state,
            narration:
              'White moved the Duck back to e2 to block your Rook on e4 — forgetting that Knights jump right over ducks!',
          };
        },
      },
      {
        id: 'l6-win',
        boardId: 'B',
        expectedPhase: 'chess',
        badgeText: 'Step 5 of 5 · Capture the King to Win!',
        prompt:
          'White blocked your Rook with the Duck on e2 — but your Knight jumps right over it! Capture White’s King on e1 with your Black Knight to win!',
        subtip: 'Click your Black Knight on Board B, then click White’s King on e1.',
        hintText: 'Click your Black Knight (on f3 or d3) on Board B, then click White’s King on e1!',
        getHintSquares: (state) => {
          const f3 = sq('f3');
          const d3 = sq('d3');
          const knightSq = state.boards.B.squares[f3]?.type === 'n' ? f3 : d3;
          return { from: [knightSq], targets: [sq('e1')] };
        },
        validate: (action, _prev, nextState) => {
          if (
            action.kind === 'move' &&
            action.boardId === 'B' &&
            action.to === sq('e1') &&
            nextState.status === 'finished' &&
            nextState.winnerTeam === 1
          ) {
            return {
              ok: true,
              feedback: '🏆 KING CAPTURED! Team Emerald wins the entire match!',
            };
          }
          return {
            ok: false,
            feedback:
              'Finish the match right now! Click your Black Knight on Board B and jump over the Duck to capture White’s King on e1!',
          };
        },
      },
    ],
  },
];
