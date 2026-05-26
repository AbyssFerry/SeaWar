export const screens = {
  lobby: document.getElementById('lobby')!,
  placement: document.getElementById('placement')!,
  battle: document.getElementById('battle')!,
  tournamentMenu: document.getElementById('tournament-menu')!,
  tournamentLobby: document.getElementById('tournament-lobby')!,
  tournamentMain: document.getElementById('tournament-main')!,
};

export const playerNameInput = document.getElementById('playerName') as HTMLInputElement;
export const roomIdInput = document.getElementById('roomIdInput') as HTMLInputElement;
export const btnCreateRoom = document.getElementById('btnCreateRoom') as HTMLButtonElement;
export const btnJoinRoom = document.getElementById('btnJoinRoom') as HTMLButtonElement;
export const roomInfo = document.getElementById('roomInfo')!;
export const roomIdDisplay = document.getElementById('roomIdDisplay')!;
export const roomStatus = document.getElementById('roomStatus')!;
export const playerList = document.getElementById('playerList')!;

export const placementBoard = document.getElementById('placementBoard')!;
export const shipPalette = document.getElementById('shipPalette')!;
export const btnRotate = document.getElementById('btnRotate') as HTMLButtonElement;
export const btnRandom = document.getElementById('btnRandom') as HTMLButtonElement;
export const btnConfirm = document.getElementById('btnConfirm') as HTMLButtonElement;

export const myBoard = document.getElementById('myBoard')!;
export const enemyBoard = document.getElementById('enemyBoard')!;
export const turnIndicator = document.getElementById('turnIndicator')!;
export const shellInventory = document.getElementById('shellInventory')!;

export const scoreDisplay = document.getElementById('scoreDisplay')!;
export const gameOverModal = document.getElementById('gameOverModal')!;
export const modalTitle = document.getElementById('modalTitle')!;
export const modalScore = document.getElementById('modalScore')!;
export const btnModalRestart = document.getElementById('btnModalRestart') as HTMLButtonElement;
export const btnModalExit = document.getElementById('btnModalExit') as HTMLButtonElement;
