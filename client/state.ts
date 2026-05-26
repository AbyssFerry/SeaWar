import { BOARD_SIZE } from './config';
import type { Ship } from '../src/types';

export const state = {
  myId: '',
  roomId: '',
  currentPhase: 'lobby' as
    | 'lobby'
    | 'placement'
    | 'battle'
    | 'tournament-menu'
    | 'tournament-lobby'
    | 'tournament-main',
  isMyTurn: false,
  selectedShell: null as string | null,
  selectedShipSize: 5,
  selectedShipHorizontal: true,
  placedShips: [] as Ship[],
  inventory: [] as string[],
  myShips: [] as Ship[],

  myBoardCells: [] as HTMLDivElement[][],
  enemyBoardCells: [] as HTMLDivElement[][],
  placementBoardCells: [] as HTMLDivElement[][],

  enemyBoardState: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill('unknown')) as string[][],
  myBoardHits: new Set<string>(),
  myBoardMisses: new Set<string>(),

  // Tournament state
  tournamentName: '',
  tournamentCode: '',
  tournamentPhase: '' as 'lobby' | 'running' | 'ended' | '',
  tournamentHostId: '',
  isInTournamentMatch: false,
  currentMatchId: '',
};

export function resetGameState() {
  state.isMyTurn = false;
  state.selectedShell = null;
  state.selectedShipSize = 5;
  state.selectedShipHorizontal = true;
  state.placedShips = [];
  state.inventory = [];
  state.myShips = [];
  state.myBoardHits.clear();
  state.myBoardMisses.clear();
  for (let y = 0; y < BOARD_SIZE; y++) {
    state.enemyBoardState[y].fill('unknown');
  }
  state.isInTournamentMatch = false;
  state.currentMatchId = '';
}

export function resetTournamentState() {
  state.tournamentName = '';
  state.tournamentCode = '';
  state.tournamentPhase = '';
  state.tournamentHostId = '';
  resetGameState();
}
