import { Tournament, TournamentParticipant, TournamentMatch, TournamentPhase } from '../types';

const tournaments = new Map<string, Tournament>();
const participantToTournament = new Map<any, { tournament: Tournament; participant: TournamentParticipant }>();

function generateTournamentCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createTournament(
  name: string,
  gamesToWin: number,
  hostWs: any,
  hostName: string
): { tournament: Tournament; participant: TournamentParticipant } {
  let code = generateTournamentCode();
  while (tournaments.has(code)) {
    code = generateTournamentCode();
  }

  const hostId = crypto.randomUUID();
  const participant: TournamentParticipant = {
    id: hostId,
    name: hostName,
    ws: hostWs,
    score: 0,
    matchesPlayed: 0,
  };

  const tournament: Tournament = {
    id: crypto.randomUUID(),
    name,
    code,
    hostId,
    phase: 'lobby',
    participants: new Map([[hostId, participant]]),
    matches: [],
    totalRounds: 0,
    currentRound: 0,
    gamesToWin,
  };

  tournaments.set(code, tournament);
  participantToTournament.set(hostWs, { tournament, participant });

  return { tournament, participant };
}

export function joinTournament(
  code: string,
  ws: any,
  playerName: string
): { tournament: Tournament; participant: TournamentParticipant } | null {
  const tournament = tournaments.get(code);
  if (!tournament || tournament.phase !== 'lobby') {
    return null;
  }

  const participant: TournamentParticipant = {
    id: crypto.randomUUID(),
    name: playerName,
    ws,
    score: 0,
    matchesPlayed: 0,
  };

  tournament.participants.set(participant.id, participant);
  participantToTournament.set(ws, { tournament, participant });

  return { tournament, participant };
}

export function getTournamentByCode(code: string): Tournament | undefined {
  return tournaments.get(code);
}

export function getTournamentContext(ws: any): { tournament: Tournament; participant: TournamentParticipant } | undefined {
  return participantToTournament.get(ws);
}

export function leaveTournament(ws: any): void {
  const context = participantToTournament.get(ws);
  if (!context) return;

  const { tournament, participant } = context;
  tournament.participants.delete(participant.id);
  participantToTournament.delete(ws);

  // If host leaves and there are other participants, transfer host
  if (tournament.hostId === participant.id && tournament.participants.size > 0) {
    const newHost = tournament.participants.values().next().value as TournamentParticipant | undefined;
    if (newHost) {
      tournament.hostId = newHost.id;
    }
  }

  // If no participants left, delete tournament
  if (tournament.participants.size === 0) {
    tournaments.delete(tournament.code);
  }
}

export function broadcastToTournament(
  tournament: Tournament,
  message: object,
  excludeParticipantId?: string
): void {
  for (const participant of tournament.participants.values()) {
    if (excludeParticipantId && participant.id === excludeParticipantId) continue;
    const ws = participant.ws;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}

// Round-robin schedule generation
export function generateRoundRobinSchedule(participantIds: string[]): TournamentMatch[] {
  const n = participantIds.length;
  const matches: TournamentMatch[] = [];

  if (n < 2) return matches;

  // If odd, add a "bye" placeholder
  const ids = [...participantIds];
  if (n % 2 === 1) {
    ids.push('__BYE__');
  }

  const totalRounds = ids.length - 1;
  const half = ids.length / 2;

  for (let round = 1; round <= totalRounds; round++) {
    for (let i = 0; i < half; i++) {
      const a = ids[i];
      const b = ids[ids.length - 1 - i];
      if (a !== '__BYE__' && b !== '__BYE__') {
        matches.push({
          id: crypto.randomUUID(),
          round,
          participantA: a,
          participantB: b,
          status: 'pending',
          winner: null,
          gamesToWin: 0,
          winsA: 0,
          winsB: 0,
          matchRoomId: null,
        });
      }
    }
    // Rotate: keep first fixed, rotate rest
    const last = ids.pop()!;
    ids.splice(1, 0, last);
  }

  return matches;
}

// Standings calculation with head-to-head tiebreaker
export function calculateStandings(
  tournament: Tournament
): {
  participantId: string;
  name: string;
  score: number;
  matchesPlayed: number;
  gameWins: number;
  gameLosses: number;
}[] {
  const standings: {
    participantId: string;
    name: string;
    score: number;
    matchesPlayed: number;
    gameWins: number;
    gameLosses: number;
  }[] = [];

  for (const [id, p] of tournament.participants) {
    standings.push({
      participantId: id,
      name: p.name,
      score: p.score,
      matchesPlayed: p.matchesPlayed,
      gameWins: 0,
      gameLosses: 0,
    });
  }

  // Calculate game wins/losses from completed matches
  for (const match of tournament.matches) {
    if (match.status !== 'completed') continue;
    const a = standings.find((s) => s.participantId === match.participantA);
    const b = standings.find((s) => s.participantId === match.participantB);
    if (a) {
      a.gameWins += match.winsA;
      a.gameLosses += match.winsB;
    }
    if (b) {
      b.gameWins += match.winsB;
      b.gameLosses += match.winsA;
    }
  }

  standings.sort((a, b) => {
    // 1. Higher score first
    if (b.score !== a.score) return b.score - a.score;

    // 2. Head-to-head
    const h2h = tournament.matches.find(
      (m) =>
        m.status === 'completed' &&
        ((m.participantA === a.participantId && m.participantB === b.participantId) ||
          (m.participantA === b.participantId && m.participantB === a.participantId))
    );
    if (h2h) {
      const aWon = h2h.winner === a.participantId;
      const bWon = h2h.winner === b.participantId;
      if (aWon && !bWon) return -1;
      if (bWon && !aWon) return 1;
    }

    // 3. Game win difference
    const aDiff = a.gameWins - a.gameLosses;
    const bDiff = b.gameWins - b.gameLosses;
    return bDiff - aDiff;
  });

  return standings;
}

export function startTournament(tournament: Tournament): void {
  if (tournament.phase !== 'lobby') return;
  if (tournament.participants.size < 2) return;

  const participantIds = Array.from(tournament.participants.keys());
  tournament.matches = generateRoundRobinSchedule(participantIds);
  tournament.totalRounds =
    tournament.matches.length > 0 ? tournament.matches[tournament.matches.length - 1].round : 0;
  tournament.currentRound = 1;
  tournament.phase = 'running';

  for (const match of tournament.matches) {
    match.gamesToWin = tournament.gamesToWin;
  }
}

export function getCurrentRoundMatches(tournament: Tournament): TournamentMatch[] {
  return tournament.matches.filter((m) => m.round === tournament.currentRound);
}

export function isRoundComplete(tournament: Tournament): boolean {
  const currentMatches = getCurrentRoundMatches(tournament);
  return currentMatches.every((m) => m.status === 'completed');
}

export function advanceRound(tournament: Tournament): boolean {
  if (!isRoundComplete(tournament)) return false;
  if (tournament.currentRound >= tournament.totalRounds) {
    tournament.phase = 'ended';
    return false;
  }
  tournament.currentRound++;
  return true;
}

export function reportMatchResult(
  tournament: Tournament,
  matchId: string,
  gameWinnerId: string | null
): void {
  const match = tournament.matches.find((m) => m.id === matchId);
  if (!match || match.status === 'completed') return;

  if (gameWinnerId === match.participantA) {
    match.winsA++;
  } else if (gameWinnerId === match.participantB) {
    match.winsB++;
  }

  // Check if series is complete
  if (match.winsA >= match.gamesToWin || match.winsB >= match.gamesToWin) {
    match.status = 'completed';
    match.winner = match.winsA >= match.gamesToWin ? match.participantA : match.participantB;

    const winner = tournament.participants.get(match.winner);
    const loser = tournament.participants.get(
      match.winner === match.participantA ? match.participantB : match.participantA
    );
    if (winner) {
      winner.score++;
      winner.matchesPlayed++;
    }
    if (loser) {
      loser.matchesPlayed++;
    }

    match.matchRoomId = null;
  }
}

export function getAllTournaments(): Map<string, Tournament> {
  return tournaments;
}
