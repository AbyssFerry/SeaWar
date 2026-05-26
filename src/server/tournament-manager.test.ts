import { describe, it, expect } from 'bun:test';
import {
  generateRoundRobinSchedule,
  calculateStandings,
  createTournament,
  startTournament,
} from './tournament-manager';

describe('generateRoundRobinSchedule', () => {
  it('generates correct number of matches for 4 players', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const matches = generateRoundRobinSchedule(ids);
    expect(matches.length).toBe(6);
    expect(matches.filter((m) => m.round === 1).length).toBe(2);
    expect(matches.filter((m) => m.round === 2).length).toBe(2);
    expect(matches.filter((m) => m.round === 3).length).toBe(2);
  });

  it('generates correct number of matches for 5 players', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const matches = generateRoundRobinSchedule(ids);
    expect(matches.length).toBe(10);
  });

  it('each player plays every other player exactly once', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const matches = generateRoundRobinSchedule(ids);
    const pairs = new Set<string>();
    for (const m of matches) {
      const key = [m.participantA, m.participantB].sort().join('-');
      pairs.add(key);
    }
    expect(pairs.size).toBe(6);
  });
});

describe('calculateStandings', () => {
  it('ranks by score', () => {
    const { tournament } = createTournament('Test', 1, {}, 'Host');
    tournament.participants.get(tournament.hostId)!.score = 2;
    tournament.participants.get(tournament.hostId)!.matchesPlayed = 2;

    const standings = calculateStandings(tournament);
    expect(standings.length).toBeGreaterThan(0);
    expect(standings[0].score).toBeGreaterThanOrEqual(
      standings[standings.length - 1].score
    );
  });
});

describe('startTournament', () => {
  it('generates matches for all participants', () => {
    const { tournament } = createTournament('Test', 1, {}, 'Host');
    // Add another participant
    const p2Id = crypto.randomUUID();
    tournament.participants.set(p2Id, {
      id: p2Id,
      name: 'P2',
      ws: {},
      score: 0,
      matchesPlayed: 0,
    });

    startTournament(tournament);
    expect(tournament.phase).toBe('running');
    expect(tournament.matches.length).toBe(1);
    expect(tournament.matches[0].gamesToWin).toBe(1);
  });
});
