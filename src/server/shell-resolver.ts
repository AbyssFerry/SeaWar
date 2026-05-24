import { Coord, BOARD_SIZE } from '../types';

export function resolveCross(center: Coord): Coord[] {
  const result: Coord[] = [];
  const directions = [
    { x: 0, y: 0 },   // center
    { x: 0, y: -1 },  // up
    { x: 0, y: 1 },   // down
    { x: -1, y: 0 },  // left
    { x: 1, y: 0 },   // right
  ];

  for (const d of directions) {
    const x = center.x + d.x;
    const y = center.y + d.y;
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
      result.push({ x, y });
    }
  }

  return result;
}

export function resolveMulti(center: Coord, allShots: Set<string>): Coord[] {
  const available: Coord[] = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (x === center.x && y === center.y) continue;
      const key = `${x},${y}`;
      if (!allShots.has(key)) {
        available.push({ x, y });
      }
    }
  }

  // Fisher-Yates shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  const picks = available.slice(0, 4);
  return [{ x: center.x, y: center.y }, ...picks];
}

export function resolveNuke(center: Coord): Coord[] {
  const result: Coord[] = [];
  // Diamond shape: row offsets from center and their horizontal spans
  // Row -2: 1 cell (center.x)
  // Row -1: 3 cells (center.x-1 to center.x+1)
  // Row  0: 5 cells (center.x-2 to center.x+2)
  // Row +1: 3 cells (center.x-1 to center.x+1)
  // Row +2: 1 cell (center.x)
  const rows = [
    { dy: -2, width: 1 },
    { dy: -1, width: 3 },
    { dy: 0,  width: 5 },
    { dy: 1,  width: 3 },
    { dy: 2,  width: 1 },
  ];

  for (const { dy, width } of rows) {
    const y = center.y + dy;
    if (y < 0 || y >= BOARD_SIZE) continue;
    const half = Math.floor(width / 2);
    for (let dx = -half; dx <= half; dx++) {
      const x = center.x + dx;
      if (x >= 0 && x < BOARD_SIZE) {
        result.push({ x, y });
      }
    }
  }

  return result;
}
