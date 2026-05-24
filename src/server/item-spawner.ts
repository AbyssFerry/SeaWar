import { Board, ITEM_SPAWN_CHANCE, ITEM_SPAWN_MIN_TURN, BOARD_SIZE } from '../types';

export function shouldSpawnItem(turnCount: number): boolean {
  if (turnCount < ITEM_SPAWN_MIN_TURN) {
    return false;
  }
  return Math.random() < ITEM_SPAWN_CHANCE;
}

export function spawnItem(board: Board): { x: number; y: number } | null {
  const available: { x: number; y: number }[] = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const key = `${x},${y}`;
      if (!board.shots.has(key)) {
        available.push({ x, y });
      }
    }
  }

  if (available.length === 0) {
    return null;
  }

  const pick = available[Math.floor(Math.random() * available.length)];
  board.items.add(`${pick.x},${pick.y}`);
  return pick;
}
