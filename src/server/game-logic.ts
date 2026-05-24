import { Board, Ship, Coord, ShellType, SHELL_TYPES, STARTING_SHELLS, Player } from '../types';
import { resolveCross, resolveMulti, resolveNuke } from './shell-resolver';

export function createBoard(): Board {
  return {
    ships: [],
    shots: new Map(),
    items: new Set(),
  };
}

export function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    board: createBoard(),
    ready: false,
    inventory: [...STARTING_SHELLS],
  };
}

export function placeShips(board: Board, ships: Ship[]): void {
  board.ships = ships;
}

function coordKey(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

function coordsEqual(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function checkHit(board: Board, coord: Coord): { hit: boolean; ship?: Ship } {
  for (const ship of board.ships) {
    for (const shipCoord of ship.coords) {
      if (coordsEqual(shipCoord, coord)) {
        return { hit: true, ship };
      }
    }
  }
  return { hit: false };
}

export function fire(board: Board, coord: Coord): {
  result: 'hit' | 'miss';
  shipSunk?: Ship;
  gotShell?: boolean;
  shellType?: ShellType;
} {
  const key = coordKey(coord);

  if (board.shots.has(key)) {
    throw new Error('Already fired');
  }

  const { hit, ship } = checkHit(board, coord);

  if (hit && ship) {
    board.shots.set(key, 'hit');
    ship.hits.push(coord);

    if (ship.hits.length === ship.size) {
      ship.sunk = true;
    }

    let gotShell = false;
    let shellType: ShellType | undefined;

    if (board.items.has(key)) {
      board.items.delete(key);
      gotShell = true;
      shellType = getRandomShellType();
    }

    return {
      result: 'hit',
      shipSunk: ship.sunk ? ship : undefined,
      gotShell,
      shellType,
    };
  } else {
    board.shots.set(key, 'miss');
    let gotShell = false;
    let shellType: ShellType | undefined;

    if (board.items.has(key)) {
      board.items.delete(key);
      gotShell = true;
      shellType = getRandomShellType();
    }

    return {
      result: 'miss',
      gotShell,
      shellType,
    };
  }
}

export function useShell(
  board: Board,
  shellType: ShellType,
  coord: Coord
): {
  targets: { coord: Coord; result: 'hit' | 'miss'; shipSunk?: Ship }[];
  gotShell?: boolean;
  newShellType?: ShellType;
} {
  let affectedCoords: Coord[];

  switch (shellType) {
    case 'cross':
      affectedCoords = resolveCross(coord);
      break;
    case 'multi':
      affectedCoords = resolveMulti(coord, new Set(board.shots.keys()));
      break;
    case 'nuke':
      affectedCoords = resolveNuke(coord);
      break;
    default:
      throw new Error(`Unknown shell type: ${shellType}`);
  }

  const targets: { coord: Coord; result: 'hit' | 'miss'; shipSunk?: Ship }[] = [];
  let gotShell = false;
  let newShellType: ShellType | undefined;

  for (const targetCoord of affectedCoords) {
    const key = coordKey(targetCoord);

    if (board.shots.has(key)) {
      continue;
    }

    const { hit, ship } = checkHit(board, targetCoord);

    if (hit && ship) {
      board.shots.set(key, 'hit');
      ship.hits.push(targetCoord);

      if (ship.hits.length === ship.size) {
        ship.sunk = true;
      }

      if (board.items.has(key)) {
        board.items.delete(key);
        gotShell = true;
      }

      targets.push({
        coord: targetCoord,
        result: 'hit',
        shipSunk: ship.sunk ? ship : undefined,
      });
    } else {
      board.shots.set(key, 'miss');

      if (board.items.has(key)) {
        board.items.delete(key);
        gotShell = true;
      }

      targets.push({
        coord: targetCoord,
        result: 'miss',
      });
    }
  }

  if (gotShell) {
    newShellType = getRandomShellType();
  }

  return { targets, gotShell: gotShell || undefined, newShellType };
}

export function checkWin(board: Board): boolean {
  if (board.ships.length === 0) {
    return false;
  }
  return board.ships.every((ship) => ship.sunk);
}

export function getRandomShellType(): ShellType {
  return SHELL_TYPES[Math.floor(Math.random() * SHELL_TYPES.length)];
}

export { shouldSpawnItem, spawnItem } from './item-spawner';
