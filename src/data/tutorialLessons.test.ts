import { describe, expect, it } from 'vitest';
import {
  algebraicToSquare,
  applyChessMove,
  applyDropMove,
  applyDuckMove,
  getLegalMovesForSquare,
} from '../../shared/engine';
import { TUTORIAL_LESSONS } from './tutorialLessons';

const sq = (alg: string) => algebraicToSquare(alg);

describe('Interactive Tutorial Lessons', () => {
  it('Lesson 1 (Meet the Duck) completes cleanly and auto-responds even when player blocks f6', () => {
    const lesson = TUTORIAL_LESSONS[0];
    expect(lesson.id).toBe('meet-duck');

    const initial = lesson.createInitialState();
    const moveRes = applyChessMove(initial, 'A', sq('e2'), sq('e4'));
    expect(moveRes.ok).toBe(true);
    const v1 = lesson.steps[0].validate({ kind: 'move', boardId: 'A', from: sq('e2'), to: sq('e4') }, initial, moveRes.state);
    expect(v1.ok).toBe(true);

    // Put duck directly on f6 to test fallback autoResponse safety
    const duckRes = applyDuckMove(moveRes.state, 'A', sq('f6'));
    expect(duckRes.ok).toBe(true);
    const v2 = lesson.steps[1].validate({ kind: 'duck', boardId: 'A', to: sq('f6') }, moveRes.state, duckRes.state);
    expect(v2.ok).toBe(true);

    const reply = lesson.steps[1].autoResponse?.(duckRes.state);
    expect(reply).not.toBeNull();
    expect(reply!.state.boards.A.turn).toBe('w');
    expect(reply!.state.boards.A.duckSquare).not.toBe(sq('f6'));
  });

  it('Lesson 2 (Block & Jump) verifies Rook is blocked by Duck, Knight jumps over Duck, and Duck blocks a6 Rook', () => {
    const lesson = TUTORIAL_LESSONS[1];
    const initial = lesson.createInitialState();

    // Confirm White Rook on d1 cannot reach d6 because Duck is on d4
    const rookTargets = getLegalMovesForSquare(initial.boards.A, sq('d1')).map((m) => m.to);
    expect(rookTargets).toContain(sq('d3'));
    expect(rookTargets).not.toContain(sq('d4'));
    expect(rookTargets).not.toContain(sq('d6'));

    // Wrong move with Rook gives coaching feedback
    const badMove = applyChessMove(initial, 'A', sq('d1'), sq('d3'));
    expect(badMove.ok).toBe(true);
    expect(
      lesson.steps[0].validate({ kind: 'move', boardId: 'A', from: sq('d1'), to: sq('d3') }, initial, badMove.state).ok
    ).toBe(false);

    // Knight jumps over Duck to capture Queen on d6
    const jump = applyChessMove(initial, 'A', sq('e4'), sq('d6'));
    expect(jump.ok).toBe(true);
    expect(jump.captured).toBe('q');
    expect(
      lesson.steps[0].validate({ kind: 'move', boardId: 'A', from: sq('e4'), to: sq('d6') }, initial, jump.state).ok
    ).toBe(true);

    // Wrong duck placement fails validation
    const badDuck = applyDuckMove(jump.state, 'A', sq('a1'));
    expect(badDuck.ok).toBe(true);
    expect(
      lesson.steps[1].validate({ kind: 'duck', boardId: 'A', to: sq('a1') }, jump.state, badDuck.state).ok
    ).toBe(false);

    // Good duck placement on b6 or c6 succeeds
    for (const blockSq of [sq('b6'), sq('c6')]) {
      const goodDuck = applyDuckMove(jump.state, 'A', blockSq);
      expect(goodDuck.ok).toBe(true);
      expect(
        lesson.steps[1].validate({ kind: 'duck', boardId: 'A', to: blockSq }, jump.state, goodDuck.state).ok
      ).toBe(true);
      // Confirm Black Rook on a6 is now blocked from d6
      const blackRookTargets = getLegalMovesForSquare(goodDuck.state.boards.A, sq('a6')).map((m) => m.to);
      expect(blackRookTargets).not.toContain(sq('d6'));
    }
  });

  it('Lesson 3 (Capture King) wins immediately by capturing Black King despite White King being attacked', () => {
    const lesson = TUTORIAL_LESSONS[2];
    const initial = lesson.createInitialState();

    // Moving White King away gives educational feedback
    const runAway = applyChessMove(initial, 'A', sq('e1'), sq('d1'));
    expect(runAway.ok).toBe(true);
    const vWrong = lesson.steps[0].validate({ kind: 'move', boardId: 'A', from: sq('e1'), to: sq('d1') }, initial, runAway.state);
    expect(vWrong.ok).toBe(false);
    expect(vWrong.feedback).toMatch(/NO check/i);

    // Capturing Black King on g8 wins immediately
    const winRes = applyChessMove(initial, 'A', sq('b3'), sq('g8'));
    expect(winRes.ok).toBe(true);
    expect(winRes.kingCaptured).toBe(true);
    expect(winRes.state.status).toBe('finished');
    expect(
      lesson.steps[0].validate({ kind: 'move', boardId: 'A', from: sq('b3'), to: sq('g8') }, initial, winRes.state).ok
    ).toBe(true);
  });

  it('Lesson 4 (Team Pocket) transfers captured Black Rook on Board A to Partner Black Pocket on Board B', () => {
    const lesson = TUTORIAL_LESSONS[3];
    const initial = lesson.createInitialState();
    expect(initial.boards.B.pockets.b.r).toBe(0);

    const capRes = applyChessMove(initial, 'A', sq('d4'), sq('d7'));
    expect(capRes.ok).toBe(true);
    expect(capRes.state.boards.B.pockets.b.r).toBe(1);
    expect(
      lesson.steps[0].validate({ kind: 'move', boardId: 'A', from: sq('d4'), to: sq('d7') }, initial, capRes.state).ok
    ).toBe(true);

    const duckRes = applyDuckMove(capRes.state, 'A', sq('d5'));
    expect(duckRes.ok).toBe(true);
    expect(
      lesson.steps[1].validate({ kind: 'duck', boardId: 'A', to: sq('d5') }, capRes.state, duckRes.state).ok
    ).toBe(true);
  });

  it('Lesson 5 (Piece Drops) validates Knight pocket drop onto d6/f6 and Duck trap on d8/f8', () => {
    const lesson = TUTORIAL_LESSONS[4];
    const initial = lesson.createInitialState();
    expect(initial.boards.A.pockets.w.n).toBe(1);
    expect(initial.boards.A.pockets.w.p).toBe(1);

    // Dropping pawn fails with helpful note
    const pawnDrop = applyDropMove(initial, 'A', 'p', sq('c5'));
    expect(pawnDrop.ok).toBe(true);
    expect(
      lesson.steps[0].validate({ kind: 'drop', boardId: 'A', pieceType: 'p', to: sq('c5') }, initial, pawnDrop.state).ok
    ).toBe(false);

    // Dropping knight on f6 succeeds
    const knightDrop = applyDropMove(initial, 'A', 'n', sq('f6'));
    expect(knightDrop.ok).toBe(true);
    expect(
      lesson.steps[0].validate({ kind: 'drop', boardId: 'A', pieceType: 'n', to: sq('f6') }, initial, knightDrop.state).ok
    ).toBe(true);

    // Moving duck to d8 or f8 succeeds
    const duckTrap = applyDuckMove(knightDrop.state, 'A', sq('f8'));
    expect(duckTrap.ok).toBe(true);
    expect(
      lesson.steps[1].validate({ kind: 'duck', boardId: 'A', to: sq('f8') }, knightDrop.state, duckTrap.state).ok
    ).toBe(true);
  });

  it.each(['f3', 'd3'])('Lesson 6 (Full Combo) plays through all 5 steps cleanly when Knight drops on %s', (dropAlg) => {
    const lesson = TUTORIAL_LESSONS[5];
    let state = lesson.createInitialState();

    // Step 1: Board A Queen captures Knight e5 -> e6
    const s1 = applyChessMove(state, 'A', sq('e5'), sq('e6'));
    expect(s1.ok).toBe(true);
    expect(s1.state.boards.B.pockets.b.n).toBe(1);
    expect(
      lesson.steps[0].validate({ kind: 'move', boardId: 'A', from: sq('e5'), to: sq('e6') }, state, s1.state).ok
    ).toBe(true);
    state = s1.state;

    // Step 2: Board A Duck shields on d6
    const s2 = applyDuckMove(state, 'A', sq('d6'));
    expect(s2.ok).toBe(true);
    expect(lesson.steps[1].validate({ kind: 'duck', boardId: 'A', to: sq('d6') }, state, s2.state).ok).toBe(true);
    state = s2.state;

    // Step 3: Board B Partner drops Knight on f3 or d3
    const dropSq = sq(dropAlg);
    const s3 = applyDropMove(state, 'B', 'n', dropSq);
    expect(s3.ok).toBe(true);
    expect(
      lesson.steps[2].validate({ kind: 'drop', boardId: 'B', pieceType: 'n', to: dropSq }, state, s3.state).ok
    ).toBe(true);
    state = s3.state;

    // Step 4: Board B Partner moves Duck to d1 + White auto-responds
    const s4 = applyDuckMove(state, 'B', sq('d1'));
    expect(s4.ok).toBe(true);
    expect(lesson.steps[3].validate({ kind: 'duck', boardId: 'B', to: sq('d1') }, state, s4.state).ok).toBe(true);
    const auto = lesson.steps[3].autoResponse?.(s4.state);
    expect(auto).not.toBeNull();
    state = auto!.state;
    expect(state.boards.B.duckSquare).toBe(sq('e2'));
    expect(state.boards.B.turn).toBe('b');

    // Verify dynamic hint highlights the dropped knight square
    const hints = lesson.steps[4].getHintSquares?.(state);
    expect(hints?.from).toEqual([dropSq]);
    expect(hints?.targets).toEqual([sq('e1')]);

    // Step 5: Board B Partner Knight jumps over Duck to capture White King on e1!
    const s5 = applyChessMove(state, 'B', dropSq, sq('e1'));
    expect(s5.ok).toBe(true);
    expect(s5.kingCaptured).toBe(true);
    expect(s5.state.status).toBe('finished');
    expect(s5.state.winnerTeam).toBe(1);
    expect(
      lesson.steps[4].validate({ kind: 'move', boardId: 'B', from: dropSq, to: sq('e1') }, state, s5.state).ok
    ).toBe(true);
  });
});
