import {
  ALL_SEATS,
  MatchFormat,
  SeatKey,
  SeatPlayer,
  TeamId,
  getSeatTeam,
} from './types.js';

export type SeatMap = Record<SeatKey, SeatPlayer | null>;
export interface SpectatorEntry {
  id: string;
  name: string;
}

export function getTeamSeats(team: TeamId): [SeatKey, SeatKey] {
  return team === 1 ? ['A_w', 'B_b'] : ['A_b', 'B_w'];
}

export function getPlayerSeats(seats: SeatMap, playerId: string): SeatKey[] {
  return ALL_SEATS.filter((seat) => seats[seat]?.id === playerId);
}

export function getPlayerTeam(seats: SeatMap, playerId: string): TeamId | null {
  const playerSeats = getPlayerSeats(seats, playerId);
  return playerSeats.length > 0 ? getSeatTeam(playerSeats[0]) : null;
}

export function isTeamSoloPlayer(seats: SeatMap, team: TeamId): boolean {
  const [s1, s2] = getTeamSeats(team);
  const p1 = seats[s1];
  const p2 = seats[s2];
  return p1 !== null && p2 !== null && p1.id === p2.id;
}

export function getTeamUniquePlayerCount(seats: SeatMap, team: TeamId): number {
  const ids = new Set<string>();
  for (const seat of getTeamSeats(team)) {
    const occupant = seats[seat];
    if (occupant) ids.add(occupant.id);
  }
  return ids.size;
}

export function getRoomMatchFormat(seats: SeatMap): MatchFormat {
  const t1Solo = isTeamSoloPlayer(seats, 1);
  const t2Solo = isTeamSoloPlayer(seats, 2);
  if (t1Solo && t2Solo) return '1v1';
  if (t1Solo || t2Solo) return '2v1';
  return '2v2';
}

export interface TakeSeatResult {
  ok: boolean;
  seats: SeatMap;
  spectators: SpectatorEntry[];
  playerSeats: SeatKey[];
}

/**
 * Seats a player into `targetSeat`.
 * - If `keepExisting` is true, any existing seats held by this player on the SAME team
 *   are kept (allowing one player to control both boards on their team for 2v1 or 1v1).
 * - Seats on the opposing team are ALWAYS vacated so a player can never occupy opposing teams.
 * - If `keepExisting` is false, all previously held seats by this player are vacated first.
 */
export function applyTakeSeat(
  seats: SeatMap,
  spectators: SpectatorEntry[],
  player: { id: string; name: string },
  targetSeat: SeatKey,
  keepExisting: boolean = false
): TakeSeatResult {
  if (!ALL_SEATS.includes(targetSeat) || seats[targetSeat] !== null) {
    return {
      ok: false,
      seats,
      spectators,
      playerSeats: getPlayerSeats(seats, player.id),
    };
  }

  const nextSeats: SeatMap = { ...seats };
  const targetTeam = getSeatTeam(targetSeat);
  const currSeats = getPlayerSeats(nextSeats, player.id);

  for (const seat of currSeats) {
    if (!keepExisting || getSeatTeam(seat) !== targetTeam) {
      nextSeats[seat] = null;
    }
  }

  nextSeats[targetSeat] = {
    id: player.id,
    name: player.name,
    isBot: false,
    connected: true,
    ready: true,
  };

  const nextSpectators = spectators.filter((s) => s.id !== player.id);

  return {
    ok: true,
    seats: nextSeats,
    spectators: nextSpectators,
    playerSeats: getPlayerSeats(nextSeats, player.id),
  };
}

export interface VacateSeatResult {
  ok: boolean;
  seats: SeatMap;
  spectators: SpectatorEntry[];
  remainingSeats: SeatKey[];
}

/**
 * Releases `targetSeat` if currently occupied by `player.id`.
 * If the player holds no remaining seats, they are added to `spectators`.
 */
export function applyVacateSeat(
  seats: SeatMap,
  spectators: SpectatorEntry[],
  player: { id: string; name: string },
  targetSeat: SeatKey
): VacateSeatResult {
  if (!ALL_SEATS.includes(targetSeat) || seats[targetSeat]?.id !== player.id) {
    return {
      ok: false,
      seats,
      spectators,
      remainingSeats: getPlayerSeats(seats, player.id),
    };
  }

  const nextSeats: SeatMap = { ...seats, [targetSeat]: null };
  const remainingSeats = getPlayerSeats(nextSeats, player.id);
  const nextSpectators =
    remainingSeats.length === 0 && !spectators.some((s) => s.id === player.id)
      ? [...spectators, { id: player.id, name: player.name }]
      : spectators;

  return {
    ok: true,
    seats: nextSeats,
    spectators: nextSpectators,
    remainingSeats,
  };
}

/**
 * Swaps White <-> Black on both boards for a rematch while keeping teammates
 * (and solo dual-board players) together on the same team.
 */
export function swapSeatsForRematch(seats: SeatMap): SeatMap {
  return {
    A_w: seats.A_b,
    A_b: seats.A_w,
    B_w: seats.B_b,
    B_b: seats.B_w,
  };
}
