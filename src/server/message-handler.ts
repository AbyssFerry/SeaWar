import type { ServerWebSocket } from 'bun';
import { ClientMessage, ServerMessage, Room, Player, RoomPhase, ShellType, STARTING_SHELLS } from '../types';
import { validateShipPlacement, generateRandomShips } from './ship-validator';
import { fire, useShell, checkWin, placeShips, createBoard, shouldSpawnItem, spawnItem } from './game-logic';
import { createRoom, joinRoom, getRoom, leaveRoom, broadcast, getOpponent, resetRoomForRestart } from './room-manager';

const wsToRoom = new WeakMap<ServerWebSocket, { room: Room; player: Player }>();

function send(ws: ServerWebSocket, message: ServerMessage): void {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function sendRoomState(room: Room): void {
  const roomState: ServerMessage = {
    type: 'ROOM_STATE',
    roomId: room.id,
    players: room.players
      .filter((p): p is Player => p !== null)
      .map((p) => ({ id: p.id, name: p.name, ready: p.ready })),
    phase: room.phase,
  };
  broadcast(room, roomState);
}

function checkGameStart(room: Room): void {
  const p0 = room.players[0];
  const p1 = room.players[1];

  if (p0 && p1 && p0.ready && p1.ready && room.phase === 'placement') {
    room.phase = 'battle';
    room.currentTurn = p0.id;
    room.turnCount = 0;

    // Send initial inventories before game start
    for (const p of room.players) {
      if (p) {
        const pws = (p as any).ws as ServerWebSocket;
        send(pws, { type: 'INVENTORY_UPDATE', shells: p.inventory });
      }
    }

    const gameStart: ServerMessage = {
      type: 'GAME_START',
      firstTurn: room.currentTurn,
    };
    broadcast(room, gameStart);
    sendRoomState(room);
  }
}

function trySpawnItems(room: Room): void {
  if (!shouldSpawnItem(room.turnCount)) {
    return;
  }

  const positions: { playerId: string; x: number; y: number }[] = [];

  for (const player of room.players) {
    if (!player) continue;
    const pos = spawnItem(player.board);
    if (pos) {
      positions.push({ playerId: player.id, x: pos.x, y: pos.y });
    }
  }

  if (positions.length > 0) {
    const itemSpawned: ServerMessage = {
      type: 'ITEM_SPAWNED',
      positions,
    };
    broadcast(room, itemSpawned);
  }
}

function switchTurn(room: Room): void {
  const opponent = getOpponent(room, room.currentTurn);
  if (opponent) {
    room.currentTurn = opponent.id;
  }

  const turnChange: ServerMessage = {
    type: 'TURN_CHANGE',
    currentTurn: room.currentTurn,
  };
  broadcast(room, turnChange);
}

export function handleMessage(ws: ServerWebSocket, data: string): void {
  let message: ClientMessage;

  try {
    message = JSON.parse(data) as ClientMessage;
  } catch {
    send(ws, { type: 'ERROR', message: 'Invalid JSON' });
    return;
  }

  switch (message.type) {
    case 'CREATE_ROOM':
      handleCreateRoom(ws, message.playerName);
      break;
    case 'JOIN_ROOM':
      handleJoinRoom(ws, message.roomId, message.playerName);
      break;
    case 'LEAVE_ROOM':
      handleLeaveRoom(ws);
      break;
    case 'READY':
      handleReady(ws);
      break;
    case 'PLACE_SHIPS':
      handlePlaceShips(ws, message.ships);
      break;
    case 'PLACE_SHIPS_AUTO':
      handlePlaceShipsAuto(ws);
      break;
    case 'FIRE':
      handleFire(ws, message.x, message.y);
      break;
    case 'USE_SHELL':
      handleUseShell(ws, message.shellType as ShellType, message.x, message.y);
      break;
    case 'PLAY_AGAIN':
      handlePlayAgain(ws);
      break;
    default:
      send(ws, { type: 'ERROR', message: 'Unknown message type' });
  }
}

function handleCreateRoom(ws: ServerWebSocket, playerName: string): void {
  const { room, player } = createRoom(playerName, ws);
  wsToRoom.set(ws, { room, player });

  send(ws, { type: 'ROOM_CREATED', roomId: room.id });
  send(ws, { type: 'PLAYER_ASSIGNED', playerId: player.id });
  sendRoomState(room);
}

function handleJoinRoom(ws: ServerWebSocket, roomId: string, playerName: string): void {
  const result = joinRoom(roomId, playerName, ws);

  if (!result) {
    send(ws, { type: 'ERROR', message: 'Room not found or full' });
    return;
  }

  const { room, player } = result;
  wsToRoom.set(ws, { room, player });

  send(ws, { type: 'PLAYER_ASSIGNED', playerId: player.id });
  sendRoomState(room);

  // If two players are now in the room, move to placement phase
  if (room.players[0] && room.players[1]) {
    room.phase = 'placement';
    sendRoomState(room);
  }
}

function handleLeaveRoom(ws: ServerWebSocket): void {
  const context = wsToRoom.get(ws);
  if (!context) return;

  const { room, player } = context;
  leaveRoom(room, player.id);
  wsToRoom.delete(ws);

  // Notify remaining player
  const remainingPlayer = room.players[0] || room.players[1];
  if (remainingPlayer) {
    const wsRemaining = (remainingPlayer as any).ws as ServerWebSocket;
    send(wsRemaining, { type: 'OPPONENT_LEFT' });
    sendRoomState(room);
  }
}

function handleReady(ws: ServerWebSocket): void {
  const context = wsToRoom.get(ws);
  if (!context) return;

  const { player } = context;
  player.ready = true;
  sendRoomState(context.room);
}

function handlePlaceShips(ws: ServerWebSocket, ships: any[]): void {
  const context = wsToRoom.get(ws);
  if (!context) return;

  const { room, player } = context;

  if (room.phase !== 'placement') {
    send(ws, { type: 'ERROR', message: 'Not in placement phase' });
    return;
  }

  const validation = validateShipPlacement(ships);
  if (!validation.valid) {
    send(ws, { type: 'ERROR', message: validation.error || 'Invalid ship placement' });
    return;
  }

  placeShips(player.board, ships);
  player.ready = true;
  sendRoomState(room);
  checkGameStart(room);
}

function handlePlaceShipsAuto(ws: ServerWebSocket): void {
  const context = wsToRoom.get(ws);
  if (!context) return;

  const { room, player } = context;

  if (room.phase !== 'placement') {
    send(ws, { type: 'ERROR', message: 'Not in placement phase' });
    return;
  }

  const ships = generateRandomShips();
  placeShips(player.board, ships);
  player.ready = true;
  sendRoomState(room);
  checkGameStart(room);
}

function handleFire(ws: ServerWebSocket, x: number, y: number): void {
  const context = wsToRoom.get(ws);
  if (!context) return;

  const { room, player } = context;

  if (room.phase !== 'battle') {
    send(ws, { type: 'ERROR', message: 'Not in battle phase' });
    return;
  }

  if (room.currentTurn !== player.id) {
    send(ws, { type: 'ERROR', message: 'Not your turn' });
    return;
  }

  const opponent = getOpponent(room, player.id);
  if (!opponent) {
    send(ws, { type: 'ERROR', message: 'No opponent' });
    return;
  }

  const result = fire(opponent.board, { x, y });

  const fireResult: ServerMessage = {
    type: 'FIRE_RESULT',
    shooter: player.id,
    x,
    y,
    result: result.result,
    shipSunk: result.shipSunk,
    gotShell: result.gotShell,
    shellType: result.shellType,
  };
  broadcast(room, fireResult);

  // If shooter got a shell from hitting an item, update their inventory
  if (result.gotShell && result.shellType) {
    player.inventory.push(result.shellType);
    send(ws, { type: 'INVENTORY_UPDATE', shells: player.inventory });
  }

  // Check win condition
  if (checkWin(opponent.board)) {
    room.phase = 'ended';
    room.winner = player.id;
    const gameOver: ServerMessage = {
      type: 'GAME_OVER',
      winner: player.id,
      reason: 'All ships destroyed',
    };
    broadcast(room, gameOver);
    return;
  }

  if (result.result === 'miss' || result.shipSunk) {
    room.turnCount++;
    switchTurn(room);
    trySpawnItems(room);
  }
  // If hit but not sunk, continue - no turn change
}

function handleUseShell(ws: ServerWebSocket, shellType: ShellType, x: number, y: number): void {
  const context = wsToRoom.get(ws);
  if (!context) return;

  const { room, player } = context;

  if (room.phase !== 'battle') {
    send(ws, { type: 'ERROR', message: 'Not in battle phase' });
    return;
  }

  if (room.currentTurn !== player.id) {
    send(ws, { type: 'ERROR', message: 'Not your turn' });
    return;
  }

  const shellIndex = player.inventory.indexOf(shellType);
  if (shellIndex === -1) {
    send(ws, { type: 'ERROR', message: 'Shell not in inventory' });
    return;
  }

  const opponent = getOpponent(room, player.id);
  if (!opponent) {
    send(ws, { type: 'ERROR', message: 'No opponent' });
    return;
  }

  // Remove shell from inventory
  player.inventory.splice(shellIndex, 1);

  const result = useShell(opponent.board, shellType, { x, y });

  const shellResult: ServerMessage = {
    type: 'SHELL_RESULT',
    shooter: player.id,
    shellType,
    targets: result.targets.map((t) => ({
      x: t.coord.x,
      y: t.coord.y,
      result: t.result,
      shipSunk: t.shipSunk,
    })),
    gotShell: result.gotShell,
    newShellType: result.newShellType,
  };
  broadcast(room, shellResult);

  // If shooter got a new shell, update their inventory
  if (result.gotShell && result.newShellType) {
    player.inventory.push(result.newShellType);
    send(ws, { type: 'INVENTORY_UPDATE', shells: player.inventory });
  }

  // Check win condition
  if (checkWin(opponent.board)) {
    room.phase = 'ended';
    room.winner = player.id;
    const gameOver: ServerMessage = {
      type: 'GAME_OVER',
      winner: player.id,
      reason: 'All ships destroyed',
    };
    broadcast(room, gameOver);
    return;
  }

  // Determine turn based on center cell result
  const centerTarget = result.targets.find((t) => t.coord.x === x && t.coord.y === y);
  const centerHit = centerTarget?.result === 'hit';
  const centerSunk = !!centerTarget?.shipSunk;

  // Center cell hit and did not sink → continue; otherwise switch turn
  if (!centerHit || centerSunk) {
    room.turnCount++;
    switchTurn(room);
    trySpawnItems(room);
  }
}

function handlePlayAgain(ws: ServerWebSocket): void {
  const context = wsToRoom.get(ws);
  if (!context) return;

  const { room, player } = context;

  if (room.phase !== 'ended') {
    send(ws, { type: 'ERROR', message: 'Game has not ended' });
    return;
  }

  room.playAgainVotes.add(player.id);

  if (room.playAgainVotes.size === 2) {
    resetRoomForRestart(room);

    // Re-associate WebSockets with updated players after reset
    for (const p of room.players) {
      if (!p) continue;
      const pws = (p as any).ws as ServerWebSocket;
      wsToRoom.set(pws, { room, player: p });
    }

    // Move to placement phase since both players are present
    room.phase = 'placement';

    const restartReady: ServerMessage = { type: 'RESTART_READY' };
    broadcast(room, restartReady);
    sendRoomState(room);
  }
}

export function handleClose(ws: ServerWebSocket): void {
  handleLeaveRoom(ws);
}
