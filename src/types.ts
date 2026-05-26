export type Coord = { x: number; y: number };

export type Ship = {
  id: string;
  size: number;
  coords: Coord[];
  hits: Coord[];
  sunk: boolean;
};

export type Board = {
  ships: Ship[];
  shots: Map<string, 'hit' | 'miss'>;
  items: Set<string>;
};

export type Player = {
  id: string;
  name: string;
  board: Board;
  ready: boolean;
  inventory: string[];
};

export type RoomPhase = 'lobby' | 'placement' | 'battle' | 'ended';

export type TournamentPhase = 'lobby' | 'running' | 'ended';

export type TournamentParticipant = {
  id: string;
  name: string;
  ws: any;
  score: number;
  matchesPlayed: number;
};

export type TournamentMatchStatus = 'pending' | 'ongoing' | 'completed';

export type TournamentMatch = {
  id: string;
  round: number;
  participantA: string;
  participantB: string;
  status: TournamentMatchStatus;
  winner: string | null;
  gamesToWin: number;
  winsA: number;
  winsB: number;
  matchRoomId: string | null;
};

export type Tournament = {
  id: string;
  name: string;
  code: string;
  hostId: string;
  phase: TournamentPhase;
  participants: Map<string, TournamentParticipant>;
  matches: TournamentMatch[];
  totalRounds: number;
  currentRound: number;
  gamesToWin: number;
};

export type Room = {
  id: string;
  players: [Player | null, Player | null];
  phase: RoomPhase;
  currentTurn: string;
  winner: string | null;
  turnCount: number;
  playAgainVotes: Set<string>;
  createdAt: number;
  scores: [number, number];
};

export type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'JOIN_ROOM'; roomId: string; playerName: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'READY' }
  | { type: 'PLACE_SHIPS'; ships: Ship[] }
  | { type: 'PLACE_SHIPS_AUTO' }
  | { type: 'FIRE'; x: number; y: number }
  | { type: 'USE_SHELL'; shellType: string; x: number; y: number }
  | { type: 'PLAY_AGAIN' }
  | { type: 'CREATE_TOURNAMENT'; name: string; gamesToWin: number }
  | { type: 'JOIN_TOURNAMENT'; code: string; playerName: string }
  | { type: 'LEAVE_TOURNAMENT' }
  | { type: 'START_TOURNAMENT' }
  | { type: 'ENTER_MATCH'; matchId: string }
  | { type: 'SPECTATE_MATCH'; matchId: string }
  | { type: 'STOP_SPECTATING' };

export type ServerMessage =
  | { type: 'ROOM_CREATED'; roomId: string }
  | { type: 'PLAYER_ASSIGNED'; playerId: string }
  | { type: 'ROOM_STATE'; roomId: string; players: { id: string; name: string; ready: boolean }[]; phase: RoomPhase }
  | { type: 'GAME_START'; firstTurn: string }
  | { type: 'FIRE_RESULT'; shooter: string; x: number; y: number; result: 'hit' | 'miss'; shipSunk?: Ship; gotShell?: boolean; shellType?: string }
  | { type: 'SHELL_RESULT'; shooter: string; shellType: string; targets: { x: number; y: number; result: 'hit' | 'miss'; shipSunk?: Ship }[]; gotShell?: boolean; newShellType?: string }
  | { type: 'TURN_CHANGE'; currentTurn: string }
  | { type: 'ITEM_SPAWNED'; positions: { playerId: string; x: number; y: number }[] }
  | { type: 'INVENTORY_UPDATE'; shells: string[] }
  | { type: 'GAME_OVER'; winner: string; reason: string; scores: number[]; revealShips: { playerId: string; ships: Ship[] }[] }
  | { type: 'RESTART_READY' }
  | { type: 'OPPONENT_LEFT' }
  | { type: 'TOURNAMENT_CREATED'; code: string }
  | { type: 'TOURNAMENT_STATE'; name: string; code: string; hostId: string; participants: { id: string; name: string }[]; phase: TournamentPhase }
  | { type: 'TOURNAMENT_STARTED'; matches: Omit<TournamentMatch, 'matchRoomId'>[] }
  | { type: 'MATCH_ASSIGNED'; matchId: string }
  | { type: 'MATCH_STARTED'; matchId: string }
  | { type: 'MATCH_ENDED'; matchId: string; winnerId: string | null; winsA: number; winsB: number }
  | { type: 'STANDINGS_UPDATE'; standings: { participantId: string; name: string; score: number; matchesPlayed: number }[] }
  | { type: 'ROUND_COMPLETED'; nextRound: number }
  | { type: 'TOURNAMENT_ENDED'; rankings: { rank: number; participantId: string; name: string; score: number }[] }
  | { type: 'FORCE_ENTER_MATCH'; matchId: string }
  | { type: 'ERROR'; message: string };

export const SHELL_TYPES = ['cross', 'multi', 'nuke'] as const;
export type ShellType = typeof SHELL_TYPES[number];

export const SHIP_CONFIGS = [5, 4, 3, 3, 2] as const;
export const BOARD_SIZE = 15;
export const ITEM_SPAWN_CHANCE = 0.3;
export const ITEM_SPAWN_MIN_TURN = 5;
export const STARTING_SHELLS: ShellType[] = ['cross', 'cross'];
