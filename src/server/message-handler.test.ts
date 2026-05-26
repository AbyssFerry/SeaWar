import { describe, expect, it } from 'bun:test';
import { handleMessage } from './message-handler';
import type { ClientMessage, Coord, ServerMessage, Ship } from '../types';

type FakeWs = {
  readyState: number;
  sent: ServerMessage[];
  send: (data: string) => void;
};

function createWs(): FakeWs {
  return {
    readyState: 1,
    sent: [],
    send(data: string) {
      this.sent.push(JSON.parse(data) as ServerMessage);
    },
  };
}

function send(ws: FakeWs, message: ClientMessage): void {
  handleMessage(ws as any, JSON.stringify(message));
}

function latest<T extends ServerMessage['type']>(
  ws: FakeWs,
  type: T
): Extract<ServerMessage, { type: T }> {
  const message = ws.sent.findLast((m) => m.type === type);
  expect(message).toBeTruthy();
  return message as Extract<ServerMessage, { type: T }>;
}

describe('message handler', () => {
  it('marks normal room game starts as non-tournament matches', () => {
    const p1 = createWs();
    const p2 = createWs();

    send(p1, { type: 'CREATE_ROOM', playerName: 'P1' });
    const { roomId } = latest(p1, 'ROOM_CREATED');
    send(p2, { type: 'JOIN_ROOM', roomId, playerName: 'P2' });

    send(p1, { type: 'PLACE_SHIPS_AUTO' });
    send(p2, { type: 'PLACE_SHIPS_AUTO' });

    expect(latest(p1, 'GAME_START').isTournamentMatch).toBe(false);
    expect(latest(p2, 'GAME_START').isTournamentMatch).toBe(false);
  });

  it('clears tournament match context before starting a normal room on the same connection', () => {
    const p1 = createWs();
    const p2 = createWs();
    const normalOpponent = createWs();

    send(p1, { type: 'CREATE_TOURNAMENT', name: 'Cup', playerName: 'P1', gamesToWin: 1 });
    const { code } = latest(p1, 'TOURNAMENT_CREATED');
    send(p2, { type: 'JOIN_TOURNAMENT', code, playerName: 'P2' });
    send(p1, { type: 'START_TOURNAMENT' });
    const matchId = latest(p1, 'MATCH_ASSIGNED').matchId;
    send(p1, { type: 'ENTER_MATCH', matchId });
    send(p2, { type: 'ENTER_MATCH', matchId });

    send(p1, { type: 'CREATE_ROOM', playerName: 'P1' });
    const { roomId } = latest(p1, 'ROOM_CREATED');
    send(normalOpponent, { type: 'JOIN_ROOM', roomId, playerName: 'P3' });
    send(p1, { type: 'PLACE_SHIPS_AUTO' });
    send(normalOpponent, { type: 'PLACE_SHIPS_AUTO' });

    expect(latest(p1, 'GAME_START').isTournamentMatch).toBe(false);
    expect(latest(normalOpponent, 'GAME_START').isTournamentMatch).toBe(false);
  });

  it('keeps a best-of tournament match in the same room until the series is won', () => {
    const p1 = createWs();
    const p2 = createWs();

    send(p1, { type: 'CREATE_TOURNAMENT', name: 'Cup', playerName: 'P1', gamesToWin: 2 });
    const { code } = latest(p1, 'TOURNAMENT_CREATED');
    send(p2, { type: 'JOIN_TOURNAMENT', code, playerName: 'P2' });
    send(p1, { type: 'START_TOURNAMENT' });
    const matchId = latest(p1, 'MATCH_ASSIGNED').matchId;
    send(p1, { type: 'ENTER_MATCH', matchId });
    send(p2, { type: 'ENTER_MATCH', matchId });

    const ships = createShips();
    send(p1, { type: 'PLACE_SHIPS', ships: cloneShips(ships) });
    send(p2, { type: 'PLACE_SHIPS', ships: cloneShips(ships) });
    winGameBySinkingAllShips(p1, p2, ships);

    const gameOver = latest(p1, 'GAME_OVER');
    expect(gameOver.matchComplete).toBe(false);
    expect(gameOver.scores).toEqual([1, 0]);
  });

  it('broadcasts schedule updates after a tournament match completes', () => {
    const p1 = createWs();
    const p2 = createWs();

    send(p1, { type: 'CREATE_TOURNAMENT', name: 'Cup', playerName: 'P1', gamesToWin: 1 });
    const { code } = latest(p1, 'TOURNAMENT_CREATED');
    send(p2, { type: 'JOIN_TOURNAMENT', code, playerName: 'P2' });
    send(p1, { type: 'START_TOURNAMENT' });
    const matchId = latest(p1, 'MATCH_ASSIGNED').matchId;
    send(p1, { type: 'ENTER_MATCH', matchId });
    send(p2, { type: 'ENTER_MATCH', matchId });

    const ships = createShips();
    send(p1, { type: 'PLACE_SHIPS', ships: cloneShips(ships) });
    send(p2, { type: 'PLACE_SHIPS', ships: cloneShips(ships) });
    winGameBySinkingAllShips(p1, p2, ships);

    const scheduleUpdate = p1.sent.findLast((m: any) => m.type === 'TOURNAMENT_SCHEDULE_UPDATE') as any;
    expect(scheduleUpdate).toBeTruthy();
    expect(scheduleUpdate.matches[0]).toMatchObject({
      id: matchId,
      status: 'completed',
      winsA: 1,
      winsB: 0,
    });
  });
});

function createShips(): Ship[] {
  return [
    createShip('ship-0', 5, range(0, 0, 5)),
    createShip('ship-1', 4, range(0, 2, 4)),
    createShip('ship-2', 3, range(0, 4, 3)),
    createShip('ship-3', 3, range(0, 6, 3)),
    createShip('ship-4', 2, range(0, 8, 2)),
  ];
}

function createShip(id: string, size: number, coords: Coord[]): Ship {
  return { id, size, coords, hits: [], sunk: false };
}

function range(x: number, y: number, length: number): Coord[] {
  return Array.from({ length }, (_, i) => ({ x: x + i, y }));
}

function cloneShips(ships: Ship[]): Ship[] {
  return ships.map((ship) => ({
    ...ship,
    coords: ship.coords.map((coord) => ({ ...coord })),
    hits: [],
    sunk: false,
  }));
}

function winGameBySinkingAllShips(winner: FakeWs, loser: FakeWs, loserShips: Ship[]): void {
  const missShots = [
    { x: 14, y: 14 },
    { x: 13, y: 14 },
    { x: 12, y: 14 },
    { x: 11, y: 14 },
  ];

  loserShips.forEach((ship, index) => {
    for (const coord of ship.coords) {
      send(winner, { type: 'FIRE', x: coord.x, y: coord.y });
    }

    if (index < loserShips.length - 1) {
      const miss = missShots[index];
      send(loser, { type: 'FIRE', x: miss.x, y: miss.y });
    }
  });
}
