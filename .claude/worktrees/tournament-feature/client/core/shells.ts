import { BOARD_SIZE } from '../config';

export function getShellPreviewCoords(shellType: string, x: number, y: number): { x: number; y: number }[] {
  const coords: { x: number; y: number }[] = [];
  if (shellType === 'cross') {
    const dirs = [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    for (const d of dirs) {
      const cx = x + d.x;
      const cy = y + d.y;
      if (cx >= 0 && cx < BOARD_SIZE && cy >= 0 && cy < BOARD_SIZE) coords.push({ x: cx, y: cy });
    }
  } else if (shellType === 'nuke') {
    const pattern = [{ dy: -2, width: 1 }, { dy: -1, width: 3 }, { dy: 0, width: 5 }, { dy: 1, width: 3 }, { dy: 2, width: 1 }];
    for (const row of pattern) {
      const cy = y + row.dy;
      if (cy < 0 || cy >= BOARD_SIZE) continue;
      const half = Math.floor(row.width / 2);
      for (let dx = -half; dx <= half; dx++) {
        const cx = x + dx;
        if (cx >= 0 && cx < BOARD_SIZE) coords.push({ x: cx, y: cy });
      }
    }
  } else {
    coords.push({ x, y });
  }
  return coords;
}
