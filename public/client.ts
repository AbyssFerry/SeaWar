import type { ServerMessage, Ship } from '../src/types';

// ===== State =====
let ws: WebSocket | null = null;
let myId = '';
let roomId = '';
let currentPhase = 'lobby';
let isMyTurn = false;
let selectedShell: string | null = null;
let selectedShipSize = 5;
let selectedShipHorizontal = true;
let placedShips: Ship[] = [];
let inventory: string[] = [];
let myShips: Ship[] = [];

// Board cell state tracking (reuse DOM elements)
const myBoardCells: HTMLDivElement[][] = [];
const enemyBoardCells: HTMLDivElement[][] = [];
const placementBoardCells: HTMLDivElement[][] = [];

// Track enemy board knowledge: 'unknown' | 'hit' | 'miss' | 'item'
const enemyBoardState: string[][] = Array.from({ length: 10 }, () => Array(10).fill('unknown'));

// Track my board hits/misses from opponent
const myBoardHits = new Set<string>();
const myBoardMisses = new Set<string>();

// ===== DOM References =====
const screens = {
  lobby: document.getElementById('lobby')!,
  placement: document.getElementById('placement')!,
  battle: document.getElementById('battle')!,
  gameOver: document.getElementById('gameOver')!,
};

const playerNameInput = document.getElementById('playerName') as HTMLInputElement;
const roomIdInput = document.getElementById('roomIdInput') as HTMLInputElement;
const btnCreateRoom = document.getElementById('btnCreateRoom') as HTMLButtonElement;
const btnJoinRoom = document.getElementById('btnJoinRoom') as HTMLButtonElement;
const roomInfo = document.getElementById('roomInfo')!;
const roomIdDisplay = document.getElementById('roomIdDisplay')!;
const roomStatus = document.getElementById('roomStatus')!;
const playerList = document.getElementById('playerList')!;

const placementBoard = document.getElementById('placementBoard')!;
const shipPalette = document.getElementById('shipPalette')!;
const btnRotate = document.getElementById('btnRotate') as HTMLButtonElement;
const btnRandom = document.getElementById('btnRandom') as HTMLButtonElement;
const btnConfirm = document.getElementById('btnConfirm') as HTMLButtonElement;

const myBoard = document.getElementById('myBoard')!;
const enemyBoard = document.getElementById('enemyBoard')!;
const turnIndicator = document.getElementById('turnIndicator')!;
const shellInventory = document.getElementById('shellInventory')!;

const gameOverResult = document.getElementById('gameOverResult')!;
const gameOverReason = document.getElementById('gameOverReason')!;
const btnPlayAgain = document.getElementById('btnPlayAgain') as HTMLButtonElement;

// ===== Screen Management =====
function showScreen(name: 'lobby' | 'placement' | 'battle' | 'gameOver') {
  currentPhase = name;
  Object.values(screens).forEach((s) => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// ===== WebSocket =====
function connect() {
  ws = new WebSocket(`ws://${location.host}/ws`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const msg: ServerMessage = JSON.parse(event.data);
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    alert('连接已断开，请刷新页面重试');
    location.reload();
  };

  ws.onerror = () => {
    alert('WebSocket 错误');
  };
}

function send(msg: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ===== Message Handlers =====
function handleServerMessage(msg: ServerMessage) {
  switch (msg.type) {
    case 'ROOM_CREATED':
      roomId = msg.roomId;
      roomIdDisplay.textContent = roomId;
      roomInfo.classList.remove('hidden');
      break;

    case 'PLAYER_ASSIGNED':
      myId = msg.playerId;
      break;

    case 'ROOM_STATE':
      roomId = msg.roomId;
      updatePlayerList(msg.players);
      if (msg.phase === 'placement' && currentPhase === 'lobby') {
        showScreen('placement');
        initPlacementBoard();
        updateShipPalette();
      }
      break;

    case 'GAME_START':
      isMyTurn = msg.firstTurn === myId;
      showScreen('battle');
      initBattleBoards();
      updateTurnIndicator();
      break;

    case 'FIRE_RESULT':
      handleFireResult(msg);
      break;

    case 'SHELL_RESULT':
      handleShellResult(msg);
      break;

    case 'TURN_CHANGE':
      isMyTurn = msg.currentTurn === myId;
      updateTurnIndicator();
      break;

    case 'ITEM_SPAWNED':
      handleItemSpawned(msg.positions);
      break;

    case 'INVENTORY_UPDATE':
      inventory = msg.shells;
      updateShellInventory();
      break;

    case 'GAME_OVER':
      showGameOver(msg.winner === myId, msg.reason);
      break;

    case 'RESTART_READY':
      resetGameState();
      showScreen('placement');
      initPlacementBoard();
      updateShipPalette();
      break;

    case 'OPPONENT_LEFT':
      alert('对手已离开');
      break;

    case 'ERROR':
      console.error('Server error:', msg.message);
      break;
  }
}

// ===== Lobby =====
function updatePlayerList(players: { id: string; name: string; ready: boolean }[]) {
  playerList.innerHTML = '';
  for (const p of players) {
    const div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = `<span>${p.name}</span><span class="ready-status">${p.ready ? '已准备' : '未准备'}</span>`;
    playerList.appendChild(div);
  }
  roomStatus.textContent = players.length < 2 ? '等待玩家加入...' : '玩家已集齐，准备开始!';
}

btnCreateRoom.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    alert('请输入你的名字');
    return;
  }
  send({ type: 'CREATE_ROOM', playerName: name });
});

btnJoinRoom.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  const rid = roomIdInput.value.trim().toUpperCase();
  if (!name) {
    alert('请输入你的名字');
    return;
  }
  if (!rid) {
    alert('请输入房间号');
    return;
  }
  send({ type: 'JOIN_ROOM', roomId: rid, playerName: name });
});

// ===== Placement =====
function initPlacementBoard() {
  placementBoard.innerHTML = '';
  placementBoardCells.length = 0;
  placedShips = [];

  for (let y = 0; y < 10; y++) {
    const row: HTMLDivElement[] = [];
    for (let x = 0; x < 10; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('click', () => onPlacementCellClick(x, y));
      cell.addEventListener('mouseenter', () => onPlacementCellHover(x, y));
      cell.addEventListener('mouseleave', () => clearPlacementPreview());
      placementBoard.appendChild(cell);
      row.push(cell);
    }
    placementBoardCells.push(row);
  }
}

function getShipsToPlace(): number[] {
  const allSizes = [5, 4, 3, 3, 2];
  const placedSizes = placedShips.map((s) => s.size);
  const remaining = [...allSizes];
  for (const size of placedSizes) {
    const idx = remaining.indexOf(size);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return remaining;
}

function updateShipPalette() {
  const remaining = getShipsToPlace();
  const options = shipPalette.querySelectorAll('.ship-option');
  options.forEach((opt) => {
    const size = Number((opt as HTMLElement).dataset.size);
    const isPlaced = !remaining.includes(size);
    if (isPlaced) {
      opt.classList.add('placed');
    } else {
      opt.classList.remove('placed');
    }
    // Highlight selected
    if (size === selectedShipSize && !isPlaced) {
      (opt as HTMLElement).style.borderColor = '#00d4ff';
    } else {
      (opt as HTMLElement).style.borderColor = '';
    }
  });
}

shipPalette.addEventListener('click', (e) => {
  const option = (e.target as HTMLElement).closest('.ship-option') as HTMLElement | null;
  if (!option) return;
  if (option.classList.contains('placed')) return;
  selectedShipSize = Number(option.dataset.size);
  updateShipPalette();
});

function getPlacementCoords(x: number, y: number, size: number, horizontal: boolean): { x: number; y: number }[] | null {
  const coords: { x: number; y: number }[] = [];
  for (let i = 0; i < size; i++) {
    const cx = horizontal ? x + i : x;
    const cy = horizontal ? y : y + i;
    if (cx < 0 || cx >= 10 || cy < 0 || cy >= 10) return null;
    coords.push({ x: cx, y: cy });
  }
  return coords;
}

function isPlacementValid(coords: { x: number; y: number }[]): boolean {
  // Check overlap and 1-cell spacing (including diagonals)
  const occupied = new Set<string>();
  for (const ship of placedShips) {
    for (const c of ship.coords) {
      occupied.add(`${c.x},${c.y}`);
      // Add surrounding cells for spacing check
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          occupied.add(`${c.x + dx},${c.y + dy}`);
        }
      }
    }
  }

  for (const c of coords) {
    if (occupied.has(`${c.x},${c.y}`)) return false;
  }
  return true;
}

function onPlacementCellHover(x: number, y: number) {
  clearPlacementPreview();
  const coords = getPlacementCoords(x, y, selectedShipSize, selectedShipHorizontal);
  if (!coords) {
    // Out of bounds - mark starting cell red
    placementBoardCells[y][x].classList.add('placing-invalid');
    return;
  }
  const valid = isPlacementValid(coords);
  for (const c of coords) {
    placementBoardCells[c.y][c.x].classList.add(valid ? 'placing-valid' : 'placing-invalid');
  }
}

function clearPlacementPreview() {
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      placementBoardCells[y][x].classList.remove('placing-valid', 'placing-invalid');
    }
  }
}

function onPlacementCellClick(x: number, y: number) {
  const coords = getPlacementCoords(x, y, selectedShipSize, selectedShipHorizontal);
  if (!coords || !isPlacementValid(coords)) return;

  const ship: Ship = {
    id: `ship-${placedShips.length}`,
    size: selectedShipSize,
    coords: coords.map((c) => ({ ...c })),
    hits: [],
    sunk: false,
  };
  placedShips.push(ship);

  // Render placed ship
  for (const c of coords) {
    placementBoardCells[c.y][c.x].classList.add('ship');
  }

  updateShipPalette();

  // Auto-select next available size
  const remaining = getShipsToPlace();
  if (remaining.length > 0) {
    selectedShipSize = remaining[0];
  }
  updateShipPalette();
}

btnRotate.addEventListener('click', () => {
  selectedShipHorizontal = !selectedShipHorizontal;
});

btnRandom.addEventListener('click', () => {
  send({ type: 'PLACE_SHIPS_AUTO' });
});

btnConfirm.addEventListener('click', () => {
  if (placedShips.length !== 5) {
    alert('请摆放全部5艘舰船');
    return;
  }
  send({ type: 'PLACE_SHIPS', ships: placedShips });
  myShips = placedShips.map((s) => ({ ...s, coords: s.coords.map((c) => ({ ...c })) }));
});

// ===== Battle =====
function initBattleBoards() {
  // My board
  myBoard.innerHTML = '';
  myBoardCells.length = 0;
  myBoardHits.clear();
  myBoardMisses.clear();

  for (let y = 0; y < 10; y++) {
    const row: HTMLDivElement[] = [];
    for (let x = 0; x < 10; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      // Show my ships
      if (myShips.some((s) => s.coords.some((c) => c.x === x && c.y === y))) {
        cell.classList.add('ship');
      }
      myBoard.appendChild(cell);
      row.push(cell);
    }
    myBoardCells.push(row);
  }

  // Enemy board
  enemyBoard.innerHTML = '';
  enemyBoardCells.length = 0;
  for (let y = 0; y < 10; y++) {
    enemyBoardState[y].fill('unknown');
    const row: HTMLDivElement[] = [];
    for (let x = 0; x < 10; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('click', () => onEnemyCellClick(x, y));
      enemyBoard.appendChild(cell);
      row.push(cell);
    }
    enemyBoardCells.push(row);
  }

  updateShellInventory();
}

function updateTurnIndicator() {
  if (isMyTurn) {
    turnIndicator.textContent = '你的回合 ⚔️';
    turnIndicator.classList.remove('waiting');
  } else {
    turnIndicator.textContent = '对手回合 ⏳';
    turnIndicator.classList.add('waiting');
  }
}

function updateShellInventory() {
  const shellNames: Record<string, string> = {
    normal: '普通炮弹',
    cross: '十字',
    multi: '多头',
    nuke: '核弹',
  };

  shellInventory.innerHTML = '';

  // Normal shell is always available
  const normalBtn = document.createElement('button');
  normalBtn.className = `shell-btn shell-normal ${selectedShell === null ? 'selected' : ''}`;
  normalBtn.textContent = shellNames.normal;
  normalBtn.addEventListener('click', () => {
    selectedShell = null;
    updateShellInventory();
  });
  shellInventory.appendChild(normalBtn);

  // Count shells in inventory
  const counts: Record<string, number> = {};
  for (const s of inventory) {
    counts[s] = (counts[s] || 0) + 1;
  }

  for (const type of ['cross', 'multi', 'nuke'] as const) {
    const count = counts[type] || 0;
    const btn = document.createElement('button');
    btn.className = `shell-btn shell-${type} ${selectedShell === type ? 'selected' : ''}`;
    btn.textContent = `${shellNames[type]} (${count})`;
    btn.disabled = count === 0;
    btn.addEventListener('click', () => {
      if (selectedShell === type) {
        selectedShell = null;
      } else {
        selectedShell = type;
      }
      updateShellInventory();
    });
    shellInventory.appendChild(btn);
  }
}

function onEnemyCellClick(x: number, y: number) {
  if (!isMyTurn) return;
  if (enemyBoardState[y][x] !== 'unknown' && enemyBoardState[y][x] !== 'item') return;

  if (selectedShell) {
    send({ type: 'USE_SHELL', shellType: selectedShell, x, y });
    selectedShell = null;
    updateShellInventory();
  } else {
    send({ type: 'FIRE', x, y });
  }
}

function handleFireResult(msg: Extract<ServerMessage, { type: 'FIRE_RESULT' }>) {
  const key = `${msg.x},${msg.y}`;

  if (msg.shooter === myId) {
    // I shot the enemy - update enemy board
    enemyBoardState[msg.y][msg.x] = msg.result;
    const cell = enemyBoardCells[msg.y][msg.x];
    cell.classList.remove('item');
    cell.classList.add(msg.result);
  } else {
    // Enemy shot me - update my board
    const cell = myBoardCells[msg.y][msg.x];
    if (msg.result === 'hit') {
      myBoardHits.add(key);
      cell.classList.add('hit');
      // Check if ship sunk
      if (msg.shipSunk) {
        for (const c of msg.shipSunk.coords) {
          myBoardCells[c.y][c.x].classList.add('sunk');
        }
      }
    } else {
      myBoardMisses.add(key);
      cell.classList.add('miss');
    }
  }
}

function handleShellResult(msg: Extract<ServerMessage, { type: 'SHELL_RESULT' }>) {
  for (const target of msg.targets) {
    enemyBoardState[target.y][target.x] = target.result;
    const cell = enemyBoardCells[target.y][target.x];
    cell.classList.remove('item');
    cell.classList.add(target.result);

    if (target.shipSunk) {
      for (const c of target.shipSunk.coords) {
        enemyBoardCells[c.y][c.x].classList.add('sunk');
      }
    }
  }
}

function handleItemSpawned(positions: { playerId: string; x: number; y: number }[]) {
  for (const pos of positions) {
    // Only show items on enemy board (items on my board are invisible to me)
    if (pos.playerId !== myId) {
      // Check if cell is still unknown before showing item
      if (enemyBoardState[pos.y][pos.x] === 'unknown') {
        enemyBoardState[pos.y][pos.x] = 'item';
        enemyBoardCells[pos.y][pos.x].classList.add('item');
      }
    }
  }
}

// ===== Game Over =====
function showGameOver(isWinner: boolean, reason: string) {
  showScreen('gameOver');
  if (isWinner) {
    gameOverResult.textContent = '胜利!';
    gameOverResult.className = 'win';
    gameOverReason.textContent = reason;
  } else {
    gameOverResult.textContent = '失败!';
    gameOverResult.className = 'lose';
    gameOverReason.textContent = reason;
  }
}

btnPlayAgain.addEventListener('click', () => {
  send({ type: 'PLAY_AGAIN' });
});

// ===== Reset =====
function resetGameState() {
  isMyTurn = false;
  selectedShell = null;
  selectedShipSize = 5;
  selectedShipHorizontal = true;
  placedShips = [];
  inventory = [];
  myShips = [];
  myBoardHits.clear();
  myBoardMisses.clear();
  for (let y = 0; y < 10; y++) {
    enemyBoardState[y].fill('unknown');
  }
}

// ===== Init =====
connect();
