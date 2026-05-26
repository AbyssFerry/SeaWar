import { describe, expect, it } from 'bun:test';
import { handleTournamentMessage } from './tournament-handler';
import { handleClose, handleMessage } from './message-handler';
import type { ClientMessage, ServerMessage } from '../types';

type FakeWs = {
  readyState: number;
  sent: ServerMessage[];
  send: (data: string) => void;
};

function createWs(): FakeWs {
  const ws: FakeWs = {
    readyState: 1,
    sent: [],
    send(data: string) {
      this.sent.push(JSON.parse(data) as ServerMessage);
    },
  };
  return ws;
}

function send(ws: FakeWs, message: ClientMessage): void {
  handleTournamentMessage(ws as any, message);
}

function sendServer(ws: FakeWs, message: ClientMessage): void {
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

describe('tournament handler', () => {
  it('includes participant names in the started schedule', () => {
    const host = createWs();
    const player2 = createWs();

    send(host, { type: 'CREATE_TOURNAMENT', name: 'Cup', playerName: 'Host', gamesToWin: 1 });
    const { code } = latest(host, 'TOURNAMENT_CREATED');

    send(player2, { type: 'JOIN_TOURNAMENT', code, playerName: 'P2' });
    send(host, { type: 'START_TOURNAMENT' });

    const started = latest(host, 'TOURNAMENT_STARTED');
    expect(started.matches[0]).toMatchObject({
      participantAName: 'Host',
      participantBName: 'P2',
    });
  });

  it('broadcasts placement state to both players after a tournament match room fills', () => {
    const host = createWs();
    const player2 = createWs();

    send(host, { type: 'CREATE_TOURNAMENT', name: 'Cup', playerName: 'Host', gamesToWin: 1 });
    const { code } = latest(host, 'TOURNAMENT_CREATED');

    send(player2, { type: 'JOIN_TOURNAMENT', code, playerName: 'P2' });
    send(host, { type: 'START_TOURNAMENT' });

    const matchId = latest(host, 'MATCH_ASSIGNED').matchId;

    send(host, { type: 'ENTER_MATCH', matchId });
    send(player2, { type: 'ENTER_MATCH', matchId });

    const hostRoomStates = host.sent.filter((m) => m.type === 'ROOM_STATE');
    expect(hostRoomStates.at(-1)).toMatchObject({ phase: 'placement' });
  });

  it('does not handle spectator messages', () => {
    const ws = createWs();

    const handled = handleTournamentMessage(ws as any, {
      type: 'SPECTATE_MATCH',
      matchId: 'match-1',
    } as any);

    expect(handled).toBe(false);
  });

  it('removes a participant from a tournament when their connection closes', () => {
    const host = createWs();
    const joiner = createWs();

    sendServer(host, { type: 'CREATE_TOURNAMENT', name: 'Cup', playerName: 'Host', gamesToWin: 1 });
    const { code } = latest(host, 'TOURNAMENT_CREATED');

    handleClose(host as any);
    sendServer(joiner, { type: 'JOIN_TOURNAMENT', code, playerName: 'P2' });

    expect(latest(joiner, 'ERROR').message).toBe('Tournament not found or already started');
  });
});
