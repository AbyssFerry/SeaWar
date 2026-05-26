import type { ServerWebSocket } from 'bun';
import { Player, RoomPhase, ShellType, STARTING_SHELLS } from '../types';
import { createPlayer, createBoard, fire, useShell, checkWin, placeShips } from './game-logic';
import { validateShipPlacement, generateRandomShips } from './ship-validator';
import { broadcastToPlayers } from './room-manager';

export type MatchRoom = {
  id: string;
  tournamentMatchId: string;
  players: [Player | null, Player | null];
  phase: RoomPhase;
  currentTurn: string;
  turnCount: number;
  winner: string | null;
};

export function createMatchRoom(matchRoomId: string, tournamentMatchId: string): MatchRoom {
  return {
    id: matchRoomId,
    tournamentMatchId,
    players: [null, null],
    phase: 'lobby',
    currentTurn: '',
    turnCount: 0,
    winner: null,
  };
}

export function addPlayerToMatchRoom(
  room: MatchRoom,
  participantId: string,
  name: string,
  ws: any
): Player {
  const player = createPlayer(participantId, name);
  (player as any).ws = ws;

  if (!room.players[0]) {
    room.players[0] = player;
  } else if (!room.players[1]) {
    room.players[1] = player;
    room.phase = 'placement';
  }

  return player;
}

export function broadcastMatchRoom(
  room: MatchRoom,
  message: object,
  excludePlayerId?: string
): void {
  broadcastToPlayers(room.players, message, excludePlayerId);
}

export function getOpponentInMatch(room: MatchRoom, playerId: string): Player | null {
  if (room.players[0]?.id === playerId) return room.players[1];
  if (room.players[1]?.id === playerId) return room.players[0];
  return null;
}

export function checkMatchGameStart(room: MatchRoom): void {
  const p0 = room.players[0];
  const p1 = room.players[1];

  if (p0 && p1 && p0.ready && p1.ready && room.phase === 'placement') {
    room.phase = 'battle';
    room.currentTurn = p0.id;
    room.turnCount = 0;

    for (const p of room.players) {
      if (p) {
        const pws = (p as any).ws as ServerWebSocket;
        if (pws && pws.readyState === 1) {
          pws.send(JSON.stringify({ type: 'INVENTORY_UPDATE', shells: p.inventory }));
        }
      }
    }

    broadcastMatchRoom(room, {
      type: 'GAME_START',
      firstTurn: room.currentTurn,
      isTournamentMatch: true,
    });
    broadcastMatchRoom(room, {
      type: 'ROOM_STATE',
      roomId: room.id,
      players: room.players
        .filter((p): p is Player => p !== null)
        .map((p) => ({ id: p.id, name: p.name, ready: p.ready })),
      phase: room.phase,
    });
  }
}

export function resetMatchRoom(room: MatchRoom): void {
  room.phase = 'placement';
  room.currentTurn = '';
  room.winner = null;
  room.turnCount = 0;

  for (const player of room.players) {
    if (!player) continue;
    player.board = createBoard();
    player.ready = false;
    player.inventory = [...STARTING_SHELLS];
  }
}
