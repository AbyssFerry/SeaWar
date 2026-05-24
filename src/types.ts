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

export type Room = {
  id: string;
  players: [Player | null, Player | null];
  phase: RoomPhase;
  currentTurn: string;
  winner: string | null;
  turnCount: number;
  playAgainVotes: Set<string>;
  createdAt: number;
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
  | { type: 'PLAY_AGAIN' };

export type ServerMessage =
  | { type: 'ROOM_CREATED'; roomId: string }
  | { type: 'PLAYER_ASSIGNED'; playerId: string }
  | { type: 'ROOM_STATE'; roomId: string; players: { id: string; name: string; ready: boolean }[]; phase: RoomPhase }
  | { type: 'GAME_START'; firstTurn: string }
  | { type: 'FIRE_RESULT'; shooter: string; x: number; y: number; result: 'hit' | 'miss'; shipSunk?: Ship; gotShell?: boolean; shellType?: string }
  | { type: 'SHELL_RESULT'; shellType: string; targets: { x: number; y: number; result: 'hit' | 'miss'; shipSunk?: Ship }[]; gotShell?: boolean; newShellType?: string }
  | { type: 'TURN_CHANGE'; currentTurn: string }
  | { type: 'ITEM_SPAWNED'; positions: { playerId: string; x: number; y: number }[] }
  | { type: 'INVENTORY_UPDATE'; shells: string[] }
  | { type: 'GAME_OVER'; winner: string; reason: string }
  | { type: 'RESTART_READY' }
  | { type: 'OPPONENT_LEFT' }
  | { type: 'ERROR'; message: string };

export const SHELL_TYPES = ['cross', 'multi', 'nuke'] as const;
export type ShellType = typeof SHELL_TYPES[number];

export const SHIP_CONFIGS = [5, 4, 3, 3, 2] as const;
export const BOARD_SIZE = 10;
export const ITEM_SPAWN_CHANCE = 0.3;
export const ITEM_SPAWN_MIN_TURN = 5;
export const STARTING_SHELLS: ShellType[] = ['cross', 'cross'];
