import { Room, Player, STARTING_SHELLS } from '../types';
import { createPlayer, createBoard } from './game-logic';

const rooms = new Map<string, Room>();

function generateRoomId(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createRoom(playerName: string, ws: any): { room: Room; player: Player } {
  let roomId = generateRoomId();
  while (rooms.has(roomId)) {
    roomId = generateRoomId();
  }

  const player = createPlayer(crypto.randomUUID(), playerName);
  (player as any).ws = ws;

  const room: Room = {
    id: roomId,
    players: [player, null],
    phase: 'lobby',
    currentTurn: '',
    winner: null,
    turnCount: 0,
    playAgainVotes: new Set(),
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);

  return { room, player };
}

export function joinRoom(roomId: string, playerName: string, ws: any): { room: Room; player: Player } | null {
  const room = rooms.get(roomId);
  if (!room || room.players[1] !== null) {
    return null;
  }

  const player = createPlayer(crypto.randomUUID(), playerName);
  (player as any).ws = ws;

  room.players[1] = player;

  return { room, player };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function removeRoom(roomId: string): void {
  rooms.delete(roomId);
}

export function leaveRoom(room: Room, playerId: string): void {
  if (room.players[0]?.id === playerId) {
    room.players[0] = null;
  } else if (room.players[1]?.id === playerId) {
    room.players[1] = null;
  }

  if (room.players[0] === null && room.players[1] === null) {
    removeRoom(room.id);
  }
}

export function broadcast(room: Room, message: object, excludePlayerId?: string): void {
  for (const player of room.players) {
    if (!player) continue;
    if (excludePlayerId && player.id === excludePlayerId) continue;

    const ws = (player as any).ws;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}

export function getOpponent(room: Room, playerId: string): Player | null {
  if (room.players[0]?.id === playerId) {
    return room.players[1];
  }
  if (room.players[1]?.id === playerId) {
    return room.players[0];
  }
  return null;
}

export function resetRoomForRestart(room: Room): void {
  room.phase = 'lobby';
  room.currentTurn = '';
  room.winner = null;
  room.turnCount = 0;
  room.playAgainVotes = new Set();

  for (const player of room.players) {
    if (!player) continue;
    player.board = createBoard();
    player.ready = false;
    player.inventory = [...STARTING_SHELLS];
  }
}

// Cleanup timer: remove rooms older than 30 minutes, checked every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes in milliseconds

  for (const [roomId, room] of rooms) {
    if (now - room.createdAt > maxAge) {
      rooms.delete(roomId);
    }
  }
}, 5 * 60 * 1000); // every 5 minutes
