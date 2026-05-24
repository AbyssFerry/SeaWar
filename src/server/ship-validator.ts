import { Ship, Coord, BOARD_SIZE, SHIP_CONFIGS } from '../types';

/**
 * Validate a complete ship placement.
 * Checks: size match, bounds, straightness, contiguity, overlap, spacing.
 */
export function validateShipPlacement(ships: Ship[]): { valid: boolean; error?: string } {
  if (ships.length !== SHIP_CONFIGS.length) {
    return { valid: false, error: `Expected ${SHIP_CONFIGS.length} ships, got ${ships.length}` };
  }

  // Check each ship individually
  for (const ship of ships) {
    if (ship.coords.length !== ship.size) {
      return { valid: false, error: `Ship ${ship.id} size mismatch: expected ${ship.size}, got ${ship.coords.length}` };
    }

    for (const c of ship.coords) {
      if (c.x < 0 || c.x >= BOARD_SIZE || c.y < 0 || c.y >= BOARD_SIZE) {
        return { valid: false, error: `Ship ${ship.id} out of bounds at (${c.x}, ${c.y})` };
      }
    }

    if (!isStraightAndContiguous(ship.coords)) {
      return { valid: false, error: `Ship ${ship.id} is not straight and contiguous` };
    }
  }

  // Check overlap
  const occupied = new Set<string>();
  for (const ship of ships) {
    for (const c of ship.coords) {
      const key = `${c.x},${c.y}`;
      if (occupied.has(key)) {
        return { valid: false, error: `Overlapping cells at (${c.x}, ${c.y})` };
      }
      occupied.add(key);
    }
  }

  // Check spacing: no two cells from different ships are edge-adjacent (4-directional)
  // Diagonal placement is allowed.
  const directions = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      for (const a of ships[i].coords) {
        for (const b of ships[j].coords) {
          const isEdgeAdjacent = directions.some(d => a.x + d.x === b.x && a.y + d.y === b.y);
          if (isEdgeAdjacent) {
            return { valid: false, error: `Ships ${ships[i].id} and ${ships[j].id} too close at (${a.x},${a.y}) and (${b.x},${b.y})` };
          }
        }
      }
    }
  }

  return { valid: true };
}

function isStraightAndContiguous(coords: Coord[]): boolean {
  if (coords.length === 0) return false;
  if (coords.length === 1) return true;

  const xs = coords.map(c => c.x);
  const ys = coords.map(c => c.y);

  const allSameX = xs.every(x => x === xs[0]);
  const allSameY = ys.every(y => y === ys[0]);

  if (!allSameX && !allSameY) return false;

  const sorted = allSameX
    ? [...coords].sort((a, b) => a.y - b.y)
    : [...coords].sort((a, b) => a.x - b.x);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const diff = allSameX ? curr.y - prev.y : curr.x - prev.x;
    if (diff !== 1) return false;
  }

  return true;
}

/**
 * Generate a random valid ship placement.
 * Uses recursive retry: if a ship cannot be placed, restart from the first ship.
 */
export function generateRandomShips(): Ship[] {
  const sizes = [...SHIP_CONFIGS];
  const ships: Ship[] = [];
  const forbidden = new Set<string>();

  function placeShip(size: number, index: number): boolean {
    const attempts = 200;
    for (let i = 0; i < attempts; i++) {
      const horizontal = Math.random() < 0.5;
      let coords: Coord[];

      if (horizontal) {
        const x = Math.floor(Math.random() * (BOARD_SIZE - size + 1));
        const y = Math.floor(Math.random() * BOARD_SIZE);
        coords = Array.from({ length: size }, (_, k) => ({ x: x + k, y }));
      } else {
        const x = Math.floor(Math.random() * BOARD_SIZE);
        const y = Math.floor(Math.random() * (BOARD_SIZE - size + 1));
        coords = Array.from({ length: size }, (_, k) => ({ x, y: y + k }));
      }

      if (isValidPlacement(coords, forbidden)) {
        const ship: Ship = {
          id: `ship-${index}`,
          size,
          coords,
          hits: [],
          sunk: false,
        };
        ships.push(ship);
        addForbidden(coords, forbidden);
        return true;
      }
    }
    return false;
  }

  for (let i = 0; i < sizes.length; i++) {
    if (!placeShip(sizes[i], i)) {
      // Retry from scratch
      return generateRandomShips();
    }
  }

  return ships;
}

function isValidPlacement(coords: Coord[], forbidden: Set<string>): boolean {
  for (const c of coords) {
    if (c.x < 0 || c.x >= BOARD_SIZE || c.y < 0 || c.y >= BOARD_SIZE) {
      return false;
    }
    if (forbidden.has(`${c.x},${c.y}`)) {
      return false;
    }
  }
  return true;
}

function addForbidden(coords: Coord[], forbidden: Set<string>): void {
  const directions = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
  for (const c of coords) {
    forbidden.add(`${c.x},${c.y}`);
    for (const d of directions) {
      const nx = c.x + d.x;
      const ny = c.y + d.y;
      if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
        forbidden.add(`${nx},${ny}`);
      }
    }
  }
}
