import type { ServerWebSocket } from 'bun';
import { ClientMessage, ServerMessage, ShellType, TournamentMatchSummary } from '../types';
import {
  createTournament,
  joinTournament,
  getTournamentContext,
  leaveTournament,
  broadcastToTournament,
  startTournament,
  getCurrentRoundMatches,
  isRoundComplete,
  advanceRound,
  calculateStandings,
  reportMatchResult,
  getAllTournaments,
} from './tournament-manager';
import {
  createMatchRoom,
  addPlayerToMatchRoom,
  broadcastMatchRoom,
  getOpponentInMatch,
  checkMatchGameStart,
  resetMatchRoom,
} from './match-room';
import { validateShipPlacement, generateRandomShips } from './ship-validator';
import { fire, useShell, checkWin, placeShips } from './game-logic';

const matchRooms = new Map<string, any>();
const wsToMatchRoom = new WeakMap<ServerWebSocket, { room: any; playerId: string }>();

function send(ws: ServerWebSocket, message: ServerMessage): void {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

// Tournament lobby message handler
export function handleTournamentMessage(ws: ServerWebSocket, message: ClientMessage): boolean {
  switch (message.type) {
    case 'CREATE_TOURNAMENT':
      handleCreateTournament(ws, message.name, message.playerName, message.gamesToWin);
      return true;
    case 'JOIN_TOURNAMENT':
      handleJoinTournament(ws, message.code, message.playerName);
      return true;
    case 'LEAVE_TOURNAMENT':
      handleLeaveTournament(ws);
      return true;
    case 'START_TOURNAMENT':
      handleStartTournament(ws);
      return true;
    case 'ENTER_MATCH':
      handleEnterMatch(ws, message.matchId);
      return true;
    default:
      return false;
  }
}

// Match room game action handler
export function handleMatchRoomMessage(ws: ServerWebSocket, message: ClientMessage): boolean {
  const context = wsToMatchRoom.get(ws);
  if (!context) return false;

  const { room, playerId } = context;

  switch (message.type) {
    case 'PLACE_SHIPS':
      return handleMatchPlaceShips(ws, room, playerId, message.ships);
    case 'PLACE_SHIPS_AUTO':
      return handleMatchPlaceShipsAuto(ws, room, playerId);
    case 'READY':
      return true;
    case 'FIRE':
      return handleMatchFire(ws, room, playerId, message.x, message.y);
    case 'USE_SHELL':
      return handleMatchUseShell(ws, room, playerId, message.shellType as ShellType, message.x, message.y);
    default:
      return false;
  }
}

function handleCreateTournament(ws: ServerWebSocket, name: string, playerName: string, gamesToWin: number): void {
  const normalizedPlayerName = playerName.trim();
  if (!normalizedPlayerName) {
    send(ws, { type: 'ERROR', message: '请输入你的名字' });
    return;
  }

  const { tournament, participant } = createTournament(name, gamesToWin, ws, normalizedPlayerName);
  send(ws, { type: 'TOURNAMENT_CREATED', code: tournament.code });
  send(ws, { type: 'PLAYER_ASSIGNED', playerId: participant.id });
  sendTournamentState(tournament);
}

function handleJoinTournament(ws: ServerWebSocket, code: string, playerName: string): void {
  const normalizedPlayerName = playerName.trim();
  if (!normalizedPlayerName) {
    send(ws, { type: 'ERROR', message: '请输入你的名字' });
    return;
  }

  const result = joinTournament(code, ws, normalizedPlayerName);
  if (!result) {
    send(ws, { type: 'ERROR', message: 'Tournament not found or already started' });
    return;
  }
  send(ws, { type: 'PLAYER_ASSIGNED', playerId: result.participant.id });
  sendTournamentState(result.tournament);
}

function handleLeaveTournament(ws: ServerWebSocket): void {
  leaveTournament(ws);
}

function sendTournamentState(tournament: any): void {
  const state: ServerMessage = {
    type: 'TOURNAMENT_STATE',
    name: tournament.name,
    code: tournament.code,
    hostId: tournament.hostId,
    participants: Array.from(tournament.participants.values()).map((p: any) => ({ id: p.id, name: p.name })),
    phase: tournament.phase,
  };
  broadcastToTournament(tournament, state);
}

function handleStartTournament(ws: ServerWebSocket): void {
  const context = getTournamentContext(ws);
  if (!context) return;

  const { tournament, participant } = context;
  if (tournament.hostId !== participant.id) {
    send(ws, { type: 'ERROR', message: 'Only host can start tournament' });
    return;
  }
  if (tournament.phase !== 'lobby') {
    send(ws, { type: 'ERROR', message: 'Tournament already started' });
    return;
  }
  if (tournament.participants.size < 2) {
    send(ws, { type: 'ERROR', message: 'Need at least 2 players' });
    return;
  }

  startTournament(tournament);

  // Update match statuses to ongoing for round 1
  const currentMatches = getCurrentRoundMatches(tournament);
  for (const match of currentMatches) {
    match.status = 'ongoing';
  }

  broadcastToTournament(tournament, {
    type: 'TOURNAMENT_STARTED',
    matches: createMatchesPayload(tournament),
  });

  assignCurrentRoundMatches(tournament);
}

function createMatchesPayload(tournament: any): TournamentMatchSummary[] {
  return tournament.matches.map((m: any) => ({
    id: m.id,
    round: m.round,
    participantA: m.participantA,
    participantB: m.participantB,
    participantAName: tournament.participants.get(m.participantA)?.name ?? '???',
    participantBName: tournament.participants.get(m.participantB)?.name ?? '???',
    status: m.status,
    winner: m.winner,
    gamesToWin: m.gamesToWin,
    winsA: m.winsA,
    winsB: m.winsB,
  }));
}

function broadcastSchedule(tournament: any): void {
  broadcastToTournament(tournament, {
    type: 'TOURNAMENT_SCHEDULE_UPDATE',
    matches: createMatchesPayload(tournament),
    currentRound: tournament.currentRound,
  });
}

function assignCurrentRoundMatches(tournament: any): void {
  const currentMatches = getCurrentRoundMatches(tournament);
  for (const match of currentMatches) {
    const pA = tournament.participants.get(match.participantA);
    const pB = tournament.participants.get(match.participantB);
    if (pA && pB) {
      send(pA.ws, { type: 'MATCH_ASSIGNED', matchId: match.id });
      send(pB.ws, { type: 'MATCH_ASSIGNED', matchId: match.id });
    }
  }
}

function handleEnterMatch(ws: ServerWebSocket, matchId: string): void {
  const tContext = getTournamentContext(ws);
  if (!tContext) return;

  const { tournament, participant } = tContext;
  const match = tournament.matches.find((m: any) => m.id === matchId);
  if (!match) return;

  let room = matchRooms.get(match.matchRoomId || '');
  if (!room) {
    const roomId = crypto.randomUUID();
    room = createMatchRoom(roomId, matchId);
    matchRooms.set(roomId, room);
    match.matchRoomId = roomId;
  }

  const isPlayerA = match.participantA === participant.id;
  const isPlayerB = match.participantB === participant.id;
  if (!isPlayerA && !isPlayerB) return;

  const existingPlayer =
    room.players[0]?.id === participant.id
      ? room.players[0]
      : room.players[1]?.id === participant.id
        ? room.players[1]
        : null;

  if (!existingPlayer) {
    addPlayerToMatchRoom(room, participant.id, participant.name, ws);
  } else {
    (existingPlayer as any).ws = ws;
  }

  wsToMatchRoom.set(ws, { room, playerId: participant.id });

  send(ws, { type: 'MATCH_STARTED', matchId });

  const roomState: ServerMessage = {
    type: 'ROOM_STATE',
    roomId: room.id,
    players: room.players
      .filter((p: any) => p !== null)
      .map((p: any) => ({ id: p.id, name: p.name, ready: p.ready })),
    phase: room.phase,
  };
  broadcastMatchRoom(room, roomState);

  if (room.phase === 'battle') {
    send(ws, { type: 'GAME_START', firstTurn: room.currentTurn, isTournamentMatch: true });
  }
}

export function handleTournamentClose(ws: ServerWebSocket): void {
  leaveTournament(ws);
  wsToMatchRoom.delete(ws);
}

// Match room game action handlers
function handleMatchPlaceShips(ws: ServerWebSocket, room: any, playerId: string, ships: any[]): boolean {
  if (room.phase !== 'placement') {
    send(ws, { type: 'ERROR', message: 'Not in placement phase' });
    return true;
  }

  const player = room.players.find((p: any) => p?.id === playerId);
  if (!player) return true;

  const validation = validateShipPlacement(ships);
  if (!validation.valid) {
    send(ws, { type: 'ERROR', message: validation.error || 'Invalid ship placement' });
    return true;
  }

  placeShips(player.board, ships);
  player.ready = true;

  broadcastMatchRoom(room, {
    type: 'ROOM_STATE',
    roomId: room.id,
    players: room.players
      .filter((p: any) => p !== null)
      .map((p: any) => ({ id: p.id, name: p.name, ready: p.ready })),
    phase: room.phase,
  });

  checkMatchGameStart(room);
  return true;
}

function handleMatchPlaceShipsAuto(ws: ServerWebSocket, room: any, playerId: string): boolean {
  if (room.phase !== 'placement') {
    send(ws, { type: 'ERROR', message: 'Not in placement phase' });
    return true;
  }

  const player = room.players.find((p: any) => p?.id === playerId);
  if (!player) return true;

  const ships = generateRandomShips();
  placeShips(player.board, ships);
  player.ready = true;

  broadcastMatchRoom(room, {
    type: 'ROOM_STATE',
    roomId: room.id,
    players: room.players
      .filter((p: any) => p !== null)
      .map((p: any) => ({ id: p.id, name: p.name, ready: p.ready })),
    phase: room.phase,
  });

  checkMatchGameStart(room);
  return true;
}

function handleMatchFire(ws: ServerWebSocket, room: any, playerId: string, x: number, y: number): boolean {
  if (room.phase !== 'battle') {
    send(ws, { type: 'ERROR', message: 'Not in battle phase' });
    return true;
  }
  if (room.currentTurn !== playerId) {
    send(ws, { type: 'ERROR', message: 'Not your turn' });
    return true;
  }

  const opponent = getOpponentInMatch(room, playerId);
  if (!opponent) {
    send(ws, { type: 'ERROR', message: 'No opponent' });
    return true;
  }

  const result = fire(opponent.board, { x, y });

  broadcastMatchRoom(room, {
    type: 'FIRE_RESULT',
    shooter: playerId,
    x,
    y,
    result: result.result,
    shipSunk: result.shipSunk,
    gotShell: result.gotShell,
    shellType: result.shellType,
  });

  if (result.gotShell && result.shellType) {
    const player = room.players.find((p: any) => p?.id === playerId);
    if (player) {
      player.inventory.push(result.shellType);
      send(ws, { type: 'INVENTORY_UPDATE', shells: player.inventory });
    }
  }

  if (checkWin(opponent.board)) {
    room.phase = 'ended';
    room.winner = playerId;
    handleMatchEnd(room, playerId);
    return true;
  }

  if (result.result === 'miss' || result.shipSunk) {
    room.turnCount++;
    switchMatchTurn(room);
  }

  return true;
}

function handleMatchUseShell(
  ws: ServerWebSocket,
  room: any,
  playerId: string,
  shellType: ShellType,
  x: number,
  y: number
): boolean {
  if (room.phase !== 'battle') {
    send(ws, { type: 'ERROR', message: 'Not in battle phase' });
    return true;
  }
  if (room.currentTurn !== playerId) {
    send(ws, { type: 'ERROR', message: 'Not your turn' });
    return true;
  }

  const player = room.players.find((p: any) => p?.id === playerId);
  if (!player) return true;

  const shellIndex = player.inventory.indexOf(shellType);
  if (shellIndex === -1) {
    send(ws, { type: 'ERROR', message: 'Shell not in inventory' });
    return true;
  }

  const opponent = getOpponentInMatch(room, playerId);
  if (!opponent) {
    send(ws, { type: 'ERROR', message: 'No opponent' });
    return true;
  }

  player.inventory.splice(shellIndex, 1);

  const result = useShell(opponent.board, shellType, { x, y });

  broadcastMatchRoom(room, {
    type: 'SHELL_RESULT',
    shooter: playerId,
    shellType,
    targets: result.targets.map((t: any) => ({
      x: t.coord.x,
      y: t.coord.y,
      result: t.result,
      shipSunk: t.shipSunk,
    })),
    gotShell: result.gotShell,
    newShellType: result.newShellType,
  });

  if (result.gotShell && result.newShellType) {
    player.inventory.push(result.newShellType);
    send(ws, { type: 'INVENTORY_UPDATE', shells: player.inventory });
  }

  if (checkWin(opponent.board)) {
    room.phase = 'ended';
    room.winner = playerId;
    handleMatchEnd(room, playerId);
    return true;
  }

  const centerTarget = result.targets.find((t: any) => t.coord.x === x && t.coord.y === y);
  const centerHit = centerTarget?.result === 'hit';
  const centerSunk = !!centerTarget?.shipSunk;

  if (!centerHit || centerSunk) {
    room.turnCount++;
    switchMatchTurn(room);
  }

  return true;
}

function switchMatchTurn(room: any): void {
  const opponent = getOpponentInMatch(room, room.currentTurn);
  if (opponent) {
    room.currentTurn = opponent.id;
  }
  broadcastMatchRoom(room, { type: 'TURN_CHANGE', currentTurn: room.currentTurn });
}

function handleMatchEnd(room: any, winnerId: string): void {
  const result = reportMatchResultToTournament(room.tournamentMatchId, winnerId);
  const matchComplete = result?.matchComplete ?? true;
  const scores = result?.scores ?? [0, 0];

  broadcastMatchRoom(room, {
    type: 'GAME_OVER',
    winner: winnerId,
    reason: 'All ships destroyed',
    scores,
    revealShips: room.players
      .filter((p: any) => p !== null)
      .map((p: any) => ({ playerId: p.id, ships: p.board.ships })),
    isTournamentMatch: true,
    matchComplete,
  });

  setTimeout(() => {
    if (matchComplete) {
      matchRooms.delete(room.id);
      return;
    }

    resetMatchRoom(room);
    broadcastMatchRoom(room, { type: 'RESTART_READY', isTournamentMatch: true });
    broadcastMatchRoom(room, {
      type: 'ROOM_STATE',
      roomId: room.id,
      players: room.players
        .filter((p: any) => p !== null)
        .map((p: any) => ({ id: p.id, name: p.name, ready: p.ready })),
      phase: room.phase,
    });
  }, matchComplete ? 3000 : 2000);
}

function reportMatchResultToTournament(
  tournamentMatchId: string,
  winnerId: string
): { matchComplete: boolean; scores: [number, number] } | null {
  for (const tournament of getAllTournaments().values()) {
    const match = tournament.matches.find((m) => m.id === tournamentMatchId);
    if (match) {
      const oldStatus = match.status;
      reportMatchResult(tournament, tournamentMatchId, winnerId);
      const scores: [number, number] = [match.winsA, match.winsB];

      // If the match just completed, check round completion
      if (oldStatus !== 'completed' && match.status === 'completed') {
        const standings = calculateStandings(tournament);
        broadcastToTournament(tournament, {
          type: 'STANDINGS_UPDATE',
          standings: standings.map((s) => ({
            participantId: s.participantId,
            name: s.name,
            score: s.score,
            matchesPlayed: s.matchesPlayed,
          })),
        });

        if (isRoundComplete(tournament)) {
          const hasNext = advanceRound(tournament);
          if (hasNext) {
            // Update next round matches to ongoing
            const nextMatches = getCurrentRoundMatches(tournament);
            for (const m of nextMatches) {
              m.status = 'ongoing';
            }

            broadcastSchedule(tournament);
            broadcastToTournament(tournament, {
              type: 'ROUND_COMPLETED',
              nextRound: tournament.currentRound,
            });

            setTimeout(() => {
              assignCurrentRoundMatches(tournament);
            }, 2000);
          } else {
            broadcastSchedule(tournament);
            const finalRankings = calculateStandings(tournament).map((s, i) => ({
              rank: i + 1,
              participantId: s.participantId,
              name: s.name,
              score: s.score,
            }));
            broadcastToTournament(tournament, {
              type: 'TOURNAMENT_ENDED',
              rankings: finalRankings,
            });
          }
        } else {
          broadcastSchedule(tournament);
        }
        return { matchComplete: true, scores };
      } else if (match.status === 'ongoing') {
        broadcastSchedule(tournament);
        return { matchComplete: false, scores };
      }
      return { matchComplete: match.status === 'completed', scores };
    }
  }
  return null;
}

