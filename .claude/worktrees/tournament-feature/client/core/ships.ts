import { BOARD_SIZE, SHIP_SIZES } from '../config';
import type { Ship } from '../../src/types';

export function getPlacementCoords(
  x: number,
  y: number,
  size: number,
  horizontal: boolean,
): { x: number; y: number }[] | null {
  const coords: { x: number; y: number }[] = [];
  for (let i = 0; i < size; i++) {
    const cx = horizontal ? x + i : x;
    const cy = horizontal ? y : y + i;
    if (cx < 0 || cx >= BOARD_SIZE || cy < 0 || cy >= BOARD_SIZE) return null;
    coords.push({ x: cx, y: cy });
  }
  return coords;
}

export function isPlacementValid(
  coords: { x: number; y: number }[],
  placedShips: Ship[],
): boolean {
  for (const ship of placedShips) {
    for (const sc of ship.coords) {
      for (const c of coords) {
        if (sc.x === c.x && sc.y === c.y) return false;
        const dx = Math.abs(sc.x - c.x);
        const dy = Math.abs(sc.y - c.y);
        if (dx + dy === 1) return false;
      }
    }
  }
  return true;
}

export function generateRandomShips(): Ship[] {
  const sizes = [...SHIP_SIZES];
  const ships: Ship[] = [];

  function canPlace(coords: { x: number; y: number }[]): boolean {
    for (const c of coords) {
      if (c.x < 0 || c.x >= BOARD_SIZE || c.y < 0 || c.y >= BOARD_SIZE) return false;
    }
    for (const ship of ships) {
      for (const sc of ship.coords) {
        for (const c of coords) {
          if (sc.x === c.x && sc.y === c.y) return false;
          const dx = Math.abs(sc.x - c.x);
          const dy = Math.abs(sc.y - c.y);
          if (dx + dy === 1) return false;
        }
      }
    }
    return true;
  }

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 1000) {
      attempts++;
      const horizontal = Math.random() < 0.5;
      let x: number, y: number;
      if (horizontal) {
        x = Math.floor(Math.random() * (BOARD_SIZE - size + 1));
        y = Math.floor(Math.random() * BOARD_SIZE);
      } else {
        x = Math.floor(Math.random() * BOARD_SIZE);
        y = Math.floor(Math.random() * (BOARD_SIZE - size + 1));
      }
      const coords: { x: number; y: number }[] = [];
      for (let j = 0; j < size; j++) {
        coords.push(horizontal ? { x: x + j, y } : { x, y: y + j });
      }
      if (canPlace(coords)) {
        ships.push({ id: `ship-${i}`, size, coords, hits: [], sunk: false });
        placed = true;
      }
    }
    if (!placed) return generateRandomShips();
  }
  return ships;
}

export function getShipsToPlace(placedShips: Ship[]): number[] {
  const allSizes = [...SHIP_SIZES];
  const placedSizes = placedShips.map((s) => s.size);
  const remaining = [...allSizes];
  for (const size of placedSizes) {
    const idx = remaining.indexOf(size);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return remaining;
}
