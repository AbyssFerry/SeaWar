import { BOARD_SIZE, SHELL_NAMES } from '../config';
import type { ServerMessage } from '../../src/types';
import * as dom from '../dom';
import { state } from '../state';
import { send } from '../ws';
import { showToast } from '../utils';
import { getShellPreviewCoords } from '../core/shells';

export function initBoards() {
  dom.myBoard.innerHTML = '';
  state.myBoardCells.length = 0;
  state.myBoardHits.clear();
  state.myBoardMisses.clear();

  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: HTMLDivElement[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (state.myShips.some((s) => s.coords.some((c) => c.x === x && c.y === y))) {
        cell.classList.add('ship');
      }
      dom.myBoard.appendChild(cell);
      row.push(cell);
    }
    state.myBoardCells.push(row);
  }

  dom.enemyBoard.innerHTML = '';
  state.enemyBoardCells.length = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    state.enemyBoardState[y].fill('unknown');
    const row: HTMLDivElement[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('click', () => onEnemyCellClick(x, y));
      cell.addEventListener('mouseenter', () => onEnemyCellHover(x, y));
      cell.addEventListener('mouseleave', () => clearShellPreview());
      dom.enemyBoard.appendChild(cell);
      row.push(cell);
    }
    state.enemyBoardCells.push(row);
  }

  updateShellInventory();
}

export function updateTurnIndicator() {
  if (state.isMyTurn) {
    dom.turnIndicator.textContent = '你的回合 ⚔️';
    dom.turnIndicator.classList.remove('waiting');
  } else {
    dom.turnIndicator.textContent = '对手回合 ⏳';
    dom.turnIndicator.classList.add('waiting');
  }
}

export function updateShellInventory() {
  dom.shellInventory.innerHTML = '';

  const normalBtn = document.createElement('button');
  normalBtn.className = `shell-btn shell-normal ${state.selectedShell === null ? 'selected' : ''}`;
  normalBtn.textContent = SHELL_NAMES.normal;
  normalBtn.addEventListener('click', () => { state.selectedShell = null; updateShellInventory(); });
  dom.shellInventory.appendChild(normalBtn);

  const counts: Record<string, number> = {};
  for (const s of state.inventory) counts[s] = (counts[s] || 0) + 1;

  for (const type of ['cross', 'multi', 'nuke'] as const) {
    const count = counts[type] || 0;
    const btn = document.createElement('button');
    btn.className = `shell-btn shell-${type} ${state.selectedShell === type ? 'selected' : ''}`;
    btn.textContent = `${SHELL_NAMES[type]} (${count})`;
    btn.disabled = count === 0;
    btn.addEventListener('click', () => {
      state.selectedShell = state.selectedShell === type ? null : type;
      updateShellInventory();
    });
    dom.shellInventory.appendChild(btn);
  }
}

function onEnemyCellHover(x: number, y: number) {
  clearShellPreview();
  if (!state.selectedShell) return;
  const coords = getShellPreviewCoords(state.selectedShell, x, y);
  for (const c of coords) {
    const cell = state.enemyBoardCells[c.y][c.x];
    if (!cell.classList.contains('hit') && !cell.classList.contains('miss')) {
      cell.classList.add('shell-preview');
    }
  }
}

function clearShellPreview() {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      state.enemyBoardCells[y][x].classList.remove('shell-preview');
    }
  }
}

function onEnemyCellClick(x: number, y: number) {
  if (!state.isMyTurn) return;
  if (state.enemyBoardState[y][x] !== 'unknown' && state.enemyBoardState[y][x] !== 'item') return;

  if (state.selectedShell) {
    const idx = state.inventory.indexOf(state.selectedShell);
    if (idx !== -1) {
      state.inventory.splice(idx, 1);
      updateShellInventory();
    }
    send({ type: 'USE_SHELL', shellType: state.selectedShell, x, y });
    state.selectedShell = null;
  } else {
    send({ type: 'FIRE', x, y });
  }
}

export function handleFireResult(msg: Extract<ServerMessage, { type: 'FIRE_RESULT' }>) {
  const key = `${msg.x},${msg.y}`;

  if (msg.shooter === state.myId) {
    state.enemyBoardState[msg.y][msg.x] = msg.result;
    const cell = state.enemyBoardCells[msg.y][msg.x];
    cell.classList.remove('item');
    cell.classList.add(msg.result);

    if (msg.shipSunk) {
      for (const c of msg.shipSunk.coords) {
        state.enemyBoardCells[c.y][c.x].classList.add('sunk');
      }
      showToast(`击沉敌方 ${msg.shipSunk.size} 格战舰！`, 'success');
    }
  } else {
    const cell = state.myBoardCells[msg.y][msg.x];
    if (msg.result === 'hit') {
      state.myBoardHits.add(key);
      cell.classList.add('hit');
      if (msg.shipSunk) {
        for (const c of msg.shipSunk.coords) {
          state.myBoardCells[c.y][c.x].classList.add('sunk');
        }
        showToast(`你的 ${msg.shipSunk.size} 格战舰被击沉！`, 'danger');
      }
    } else {
      state.myBoardMisses.add(key);
      cell.classList.add('miss');
    }
  }
}

export function handleShellResult(msg: Extract<ServerMessage, { type: 'SHELL_RESULT' }>) {
  const isMyShell = msg.shooter === state.myId;
  const sunkShips = new Set<number>();

  for (const target of msg.targets) {
    if (isMyShell) {
      state.enemyBoardState[target.y][target.x] = target.result;
      const cell = state.enemyBoardCells[target.y][target.x];
      cell.classList.remove('item');
      cell.classList.add(target.result);
      if (target.shipSunk) {
        for (const c of target.shipSunk.coords) {
          state.enemyBoardCells[c.y][c.x].classList.add('sunk');
        }
        sunkShips.add(target.shipSunk.size);
      }
    } else {
      const cell = state.myBoardCells[target.y][target.x];
      if (target.result === 'hit') {
        cell.classList.add('hit');
        if (target.shipSunk) {
          for (const c of target.shipSunk.coords) {
            state.myBoardCells[c.y][c.x].classList.add('sunk');
          }
          sunkShips.add(target.shipSunk.size);
        }
      } else {
        cell.classList.add('miss');
      }
    }
  }

  for (const size of sunkShips) {
    if (isMyShell) {
      showToast(`击沉敌方 ${size} 格战舰！`, 'success');
    } else {
      showToast(`你的 ${size} 格战舰被击沉！`, 'danger');
    }
  }
}

export function handleItemSpawned(positions: { playerId: string; x: number; y: number }[]) {
  for (const pos of positions) {
    if (pos.playerId !== state.myId) {
      if (state.enemyBoardState[pos.y][pos.x] === 'unknown') {
        state.enemyBoardState[pos.y][pos.x] = 'item';
        state.enemyBoardCells[pos.y][pos.x].classList.add('item');
      }
    }
  }
}

export function showTournamentInfo(show: boolean): void {
  const infoBar = document.getElementById('tournament-battle-info');
  if (infoBar) {
    infoBar.classList.toggle('hidden', !show);
  }
}
