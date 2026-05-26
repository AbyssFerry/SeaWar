import { BOARD_SIZE, SHIP_SIZES } from '../config';
import type { Ship } from '../../src/types';
import * as dom from '../dom';
import { state } from '../state';
import { send } from '../ws';
import { getPlacementCoords, isPlacementValid, generateRandomShips, getShipsToPlace } from '../core/ships';

export function initBoard() {
  dom.placementBoard.innerHTML = '';
  state.placementBoardCells.length = 0;
  state.placedShips = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: HTMLDivElement[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('click', () => onPlacementCellClick(x, y));
      cell.addEventListener('mouseenter', () => onPlacementCellHover(x, y));
      cell.addEventListener('mouseleave', () => clearPlacementPreview());
      dom.placementBoard.appendChild(cell);
      row.push(cell);
    }
    state.placementBoardCells.push(row);
  }
}

export function updatePalette() {
  const remaining = getShipsToPlace(state.placedShips);
  const options = dom.shipPalette.querySelectorAll('.ship-option');
  options.forEach((opt) => {
    const size = Number((opt as HTMLElement).dataset.size);
    const countRemaining = remaining.filter((s) => s === size).length;
    const isPlaced = countRemaining === 0;
    if (isPlaced) {
      opt.classList.add('placed');
    } else {
      opt.classList.remove('placed');
    }
    if (size === state.selectedShipSize && !isPlaced) {
      (opt as HTMLElement).style.borderColor = '#00d4ff';
    } else {
      (opt as HTMLElement).style.borderColor = '';
    }
  });
}

function onPlacementCellHover(x: number, y: number) {
  clearPlacementPreview();
  const coords = getPlacementCoords(x, y, state.selectedShipSize, state.selectedShipHorizontal);
  if (!coords) {
    state.placementBoardCells[y][x].classList.add('placing-invalid');
    return;
  }
  const valid = isPlacementValid(coords, state.placedShips);
  for (const c of coords) {
    state.placementBoardCells[c.y][c.x].classList.add(valid ? 'placing-valid' : 'placing-invalid');
  }
}

function clearPlacementPreview() {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      state.placementBoardCells[y][x].classList.remove('placing-valid', 'placing-invalid');
    }
  }
}

function clearPlacedShips() {
  state.placedShips = [];
  state.selectedShipSize = SHIP_SIZES[0];
  clearPlacementPreview();
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      state.placementBoardCells[y][x].classList.remove('ship');
    }
  }
  updatePalette();
}

function renderPlacedShips() {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      state.placementBoardCells[y][x].classList.remove('ship');
    }
  }
  for (const ship of state.placedShips) {
    for (const c of ship.coords) {
      state.placementBoardCells[c.y][c.x].classList.add('ship');
    }
  }
  updatePalette();
}

function onPlacementCellClick(x: number, y: number) {
  if (state.placedShips.length >= SHIP_SIZES.length) return;

  const coords = getPlacementCoords(x, y, state.selectedShipSize, state.selectedShipHorizontal);
  if (!coords || !isPlacementValid(coords, state.placedShips)) return;

  const ship: Ship = {
    id: `ship-${state.placedShips.length}`,
    size: state.selectedShipSize,
    coords: coords.map((c) => ({ ...c })),
    hits: [],
    sunk: false,
  };
  state.placedShips.push(ship);

  for (const c of coords) {
    state.placementBoardCells[c.y][c.x].classList.add('ship');
  }

  updatePalette();

  const remaining = getShipsToPlace(state.placedShips);
  if (remaining.length > 0) {
    state.selectedShipSize = remaining[0];
  }
  updatePalette();
}

export function init() {
  dom.shipPalette.addEventListener('click', (e) => {
    const option = (e.target as HTMLElement).closest('.ship-option') as HTMLElement | null;
    if (!option) return;
    if (option.classList.contains('placed')) return;
    state.selectedShipSize = Number(option.dataset.size);
    updatePalette();
  });

  dom.btnRotate.addEventListener('click', () => {
    state.selectedShipHorizontal = !state.selectedShipHorizontal;
  });

  dom.btnRandom.addEventListener('click', () => {
    state.placedShips = generateRandomShips();
    renderPlacedShips();
  });

  dom.btnClearPlacement.addEventListener('click', () => {
    clearPlacedShips();
  });

  dom.btnConfirm.addEventListener('click', () => {
    if (state.placedShips.length !== SHIP_SIZES.length) {
      alert(`请摆放全部${SHIP_SIZES.length}艘舰船`);
      return;
    }
    send({ type: 'PLACE_SHIPS', ships: state.placedShips });
    state.myShips = state.placedShips.map((s) => ({ ...s, coords: s.coords.map((c) => ({ ...c })) }));
  });
}
