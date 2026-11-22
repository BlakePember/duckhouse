import { describe, it, expect } from 'vitest';
import {
  SeatMap,
  applyTakeSeat,
  applyVacateSeat,
  getPlayerSeats,
  getPlayerTeam,
  getRoomMatchFormat,
  getTeamUniquePlayerCount,
  isTeamSoloPlayer,
  swapSeatsForRematch,
} from './seats.js';
import {
  algebraicToSquare,
  applyChessMove,
  applyDropMove,
  applyDuckMove,
  createInitialGame,
} from './engine.js';
import { TIME_CONTROLS, getSeatKey } from './types.js';

function emptySeats(): SeatMap {
  return { A_w: null, B_b: null, A_b: null, B_w: null };
}

describe('Dual-Board / 2v1 Seat Management', () => {
  it('allows a player to claim both seats on the same team (2v1)', () => {
    const alice = { id: 'p_alice', name: 'Alice' };
    const bob = { id: 'p_bob', name: 'Bob' };
    const carol = { id: 'p_carol', name: 'Carol' };

    let seats = emptySeats();
    let spectators: { id: string; name: string }[] = [];

    // Alice sits on Team 1 Board A White
    let res = applyTakeSeat(seats, spectators, alice, 'A_w', false);
    expect(res.ok).toBe(true);
    seats = res.seats;
    spectators = res.spectators;

    // Alice also claims Team 1 partner seat Board B Black
    res = applyTakeSeat(seats, spectators, alice, 'B_b', true);
    expect(res.ok).toBe(true);
    seats = res.seats;
    spectators = res.spectators;

    expect(getPlayerSeats(seats, alice.id)).toEqual(['A_w', 'B_b']);
    expect(getPlayerTeam(seats, alice.id)).toBe(1);
    expect(isTeamSoloPlayer(seats, 1)).toBe(true);
    expect(isTeamSoloPlayer(seats, 2)).toBe(false);
    expect(getTeamUniquePlayerCount(seats, 1)).toBe(1);

    // Bob and Carol take Team 2 seats
    seats = applyTakeSeat(seats, spectators, bob, 'A_b', false).seats;
    seats = applyTakeSeat(seats, spectators, carol, 'B_w', false).seats;

    expect(getTeamUniquePlayerCount(seats, 2)).toBe(2);
    expect(getRoomMatchFormat(seats)).toBe('2v1');
  });

  it('prevents a player from occupying opposing team seats even when keepExisting is true', () => {
    const alice = { id: 'p_alice', name: 'Alice' };

    let seats = emptySeats();
    seats = applyTakeSeat(seats, [], alice, 'A_w', false).seats;
    seats = applyTakeSeat(seats, [], alice, 'B_b', true).seats;
    expect(getPlayerSeats(seats, alice.id)).toEqual(['A_w', 'B_b']);

    // Attempting to take opposing seat A_b with keepExisting=true must vacate Team 1 seats
    const switched = applyTakeSeat(seats, [], alice, 'A_b', true);
    expect(switched.ok).toBe(true);
    expect(getPlayerSeats(switched.seats, alice.id)).toEqual(['A_b']);
    expect(switched.seats.A_w).toBeNull();
    expect(switched.seats.B_b).toBeNull();
    expect(getPlayerTeam(switched.seats, alice.id)).toBe(2);
  });

  it('supports moving between same-team seats when keepExisting is false', () => {
    const alice = { id: 'p_alice', name: 'Alice' };
    let seats = emptySeats();
    seats = applyTakeSeat(seats, [], alice, 'A_w', false).seats;

    const moved = applyTakeSeat(seats, [], alice, 'B_b', false);
    expect(moved.ok).toBe(true);
    expect(getPlayerSeats(moved.seats, alice.id)).toEqual(['B_b']);
    expect(moved.seats.A_w).toBeNull();
  });

  it('supports 1v1 when both teams have a single dual-board player', () => {
    const alice = { id: 'p_alice', name: 'Alice' };
    const bob = { id: 'p_bob', name: 'Bob' };

    let seats = emptySeats();
    seats = applyTakeSeat(seats, [], alice, 'A_w', false).seats;
    seats = applyTakeSeat(seats, [], alice, 'B_b', true).seats;
    seats = applyTakeSeat(seats, [], bob, 'A_b', false).seats;
    seats = applyTakeSeat(seats, [], bob, 'B_w', true).seats;

    expect(isTeamSoloPlayer(seats, 1)).toBe(true);
    expect(isTeamSoloPlayer(seats, 2)).toBe(true);
    expect(getRoomMatchFormat(seats)).toBe('1v1');
  });

  it('allows vacating one of two seats while keeping the other seat, and moves to spectators if vacating last seat', () => {
    const alice = { id: 'p_alice', name: 'Alice' };

    let seats = emptySeats();
    let spectators: { id: string; name: string }[] = [];
    seats = applyTakeSeat(seats, spectators, alice, 'A_w', false).seats;
    seats = applyTakeSeat(seats, spectators, alice, 'B_b', true).seats;

    // Release Board B Black -> stays on Board A White
    const r1 = applyVacateSeat(seats, spectators, alice, 'B_b');
    expect(r1.ok).toBe(true);
    expect(r1.remainingSeats).toEqual(['A_w']);
    expect(r1.spectators).toEqual([]);
    expect(isTeamSoloPlayer(r1.seats, 1)).toBe(false);

    // Cannot vacate someone else's seat or an empty seat
    const invalid = applyVacateSeat(r1.seats, r1.spectators, { id: 'p_other', name: 'Other' }, 'A_w');
    expect(invalid.ok).toBe(false);

    // Release last remaining seat -> becomes spectator
    const r2 = applyVacateSeat(r1.seats, r1.spectators, alice, 'A_w');
    expect(r2.ok).toBe(true);
    expect(r2.remainingSeats).toEqual([]);
    expect(r2.spectators).toEqual([{ id: alice.id, name: alice.name }]);
  });

  it('preserves dual-board control on the same team after rematch color swap', () => {
    const alice = { id: 'p_alice', name: 'Alice' };
    const bob = { id: 'p_bob', name: 'Bob' };
    const carol = { id: 'p_carol', name: 'Carol' };

    let seats = emptySeats();
    seats = applyTakeSeat(seats, [], alice, 'A_w', false).seats;
    seats = applyTakeSeat(seats, [], alice, 'B_b', true).seats;
    seats = applyTakeSeat(seats, [], bob, 'A_b', false).seats;
    seats = applyTakeSeat(seats, [], carol, 'B_w', false).seats;

    const swapped = swapSeatsForRematch(seats);

    // Alice swapped from Team 1 (A_w + B_b) to Team 2 (A_b + B_w)
    expect(getPlayerSeats(swapped, alice.id)).toEqual(['A_b', 'B_w']);
    expect(getPlayerTeam(swapped, alice.id)).toBe(2);
    expect(isTeamSoloPlayer(swapped, 2)).toBe(true);
    expect(isTeamSoloPlayer(swapped, 1)).toBe(false);
    expect(getRoomMatchFormat(swapped)).toBe('2v1');
    // Bob and Carol remain teammates on Team 1
    expect(getPlayerSeats(swapped, bob.id)).toEqual(['A_w']);
    expect(getPlayerSeats(swapped, carol.id)).toEqual(['B_b']);
  });

  it('lets a solo 2v1 player capture on Board A and immediately drop that piece on their own Board B', () => {
    const alice = { id: 'p_alice', name: 'Alice' };
    let seats = emptySeats();
    seats = applyTakeSeat(seats, [], alice, 'A_w', false).seats;
    seats = applyTakeSeat(seats, [], alice, 'B_b', true).seats;

    let game = createInitialGame(TIME_CONTROLS[2], 'playing');
    // Set up capture on Board A: White Knight on d4 captures Black Bishop on f5
    game.boards.A.squares[algebraicToSquare('d4')] = { type: 'n', color: 'w' };
    game.boards.A.squares[algebraicToSquare('f5')] = { type: 'b', color: 'b' };

    // Verify Alice controls active seat on Board A
    expect(seats[getSeatKey('A', game.boards.A.turn)]?.id).toBe(alice.id);

    const capRes = applyChessMove(game, 'A', algebraicToSquare('d4'), algebraicToSquare('f5'));
    expect(capRes.ok).toBe(true);
    game = capRes.state;
    // Captured bishop goes to Board B Black pocket (also Alice!)
    expect(game.boards.B.pockets.b.b).toBe(1);

    // Complete Alice's duck move on Board A
    game = applyDuckMove(game, 'A', algebraicToSquare('d5')).state;

    // Opponent (Board B White) makes a move and duck move
    game = applyChessMove(game, 'B', algebraicToSquare('e2'), algebraicToSquare('e4')).state;
    game = applyDuckMove(game, 'B', algebraicToSquare('e5')).state;

    // Now it is Board B Black's turn — Alice controls this seat too!
    expect(seats[getSeatKey('B', game.boards.B.turn)]?.id).toBe(alice.id);

    // Alice drops the Black Bishop she captured on Board A onto c5 on Board B
    const dropRes = applyDropMove(game, 'B', 'b', algebraicToSquare('c5'));
    expect(dropRes.ok).toBe(true);
    expect(dropRes.state.boards.B.squares[algebraicToSquare('c5')])?.toEqual({
      type: 'b',
      color: 'b',
      promoted: false,
    });
    expect(dropRes.state.boards.B.pockets.b.b).toBe(0);
  });
});
