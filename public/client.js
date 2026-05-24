// ===== Config =====
const BOARD_SIZE = 15;
const SHIP_SIZES = [5, 4, 3, 3, 2];

// ===== State =====
let ws = null;
let myId = '';
let roomId = '';
let currentPhase = 'lobby';
let isMyTurn = false;
let selectedShell = null;
let selectedShipSize = 5;
let selectedShipHorizontal = true;
let placedShips = [];
let inventory = [];
let myShips = [];

// Board cell state tracking
const myBoardCells = [];
const enemyBoardCells = [];
const placementBoardCells = [];

// Track enemy board knowledge: 'unknown' | 'hit' | 'miss' | 'item'
const enemyBoardState = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill('unknown'));

// Track my board hits/misses from opponent
const myBoardHits = new Set();
const myBoardMisses = new Set();

// ===== DOM References =====
const screens = {
  lobby: document.getElementById('lobby'),
  placement: document.getElementById('placement'),
  battle: document.getElementById('battle'),
};

const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomIdInput');
const btnCreateRoom = document.getElementById('btnCreateRoom');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const roomInfo = document.getElementById('roomInfo');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const roomStatus = document.getElementById('roomStatus');
const playerList = document.getElementById('playerList');

const placementBoard = document.getElementById('placementBoard');
const shipPalette = document.getElementById('shipPalette');
const btnRotate = document.getElementById('btnRotate');
const btnRandom = document.getElementById('btnRandom');
const btnConfirm = document.getElementById('btnConfirm');

const myBoard = document.getElementById('myBoard');
const enemyBoard = document.getElementById('enemyBoard');
const turnIndicator = document.getElementById('turnIndicator');
const shellInventory = document.getElementById('shellInventory');

const scoreDisplay = document.getElementById('scoreDisplay');
const gameOverModal = document.getElementById('gameOverModal');
const modalTitle = document.getElementById('modalTitle');
const modalScore = document.getElementById('modalScore');
const btnModalRestart = document.getElementById('btnModalRestart');
const btnModalExit = document.getElementById('btnModalExit');

// ===== Toast Notification =====
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ===== Screen Management =====
function showScreen(name) {
  currentPhase = name;
  Object.values(screens).forEach((s) => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// ===== WebSocket =====
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
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

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ===== Message Handlers =====
function handleServerMessage(msg) {
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
      updateShellInventory();
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
      showGameOverModal(msg.winner === myId, msg.scores, msg.revealShips);
      break;

    case 'RESTART_READY':
      resetGameState();
      gameOverModal.classList.add('hidden');
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
function updatePlayerList(players) {
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
  const rid = roomIdInput.value.trim();
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

  for (let y = 0; y < BOARD_SIZE; y++) {
    const row = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
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

function getShipsToPlace() {
  const allSizes = [...SHIP_SIZES];
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
    const size = Number(opt.dataset.size);
    const countRemaining = remaining.filter((s) => s === size).length;
    const isPlaced = countRemaining === 0;
    if (isPlaced) {
      opt.classList.add('placed');
    } else {
      opt.classList.remove('placed');
    }
    if (size === selectedShipSize && !isPlaced) {
      opt.style.borderColor = '#00d4ff';
    } else {
      opt.style.borderColor = '';
    }
  });
}

shipPalette.addEventListener('click', (e) => {
  const option = e.target.closest('.ship-option');
  if (!option) return;
  if (option.classList.contains('placed')) return;
  selectedShipSize = Number(option.dataset.size);
  updateShipPalette();
});

function getPlacementCoords(x, y, size, horizontal) {
  const coords = [];
  for (let i = 0; i < size; i++) {
    const cx = horizontal ? x + i : x;
    const cy = horizontal ? y : y + i;
    if (cx < 0 || cx >= BOARD_SIZE || cy < 0 || cy >= BOARD_SIZE) return null;
    coords.push({ x: cx, y: cy });
  }
  return coords;
}

function isPlacementValid(coords) {
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

function onPlacementCellHover(x, y) {
  clearPlacementPreview();
  const coords = getPlacementCoords(x, y, selectedShipSize, selectedShipHorizontal);
  if (!coords) {
    placementBoardCells[y][x].classList.add('placing-invalid');
    return;
  }
  const valid = isPlacementValid(coords);
  for (const c of coords) {
    placementBoardCells[c.y][c.x].classList.add(valid ? 'placing-valid' : 'placing-invalid');
  }
}

function clearPlacementPreview() {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      placementBoardCells[y][x].classList.remove('placing-valid', 'placing-invalid');
    }
  }
}

function onPlacementCellClick(x, y) {
  if (placedShips.length >= SHIP_SIZES.length) return;

  const coords = getPlacementCoords(x, y, selectedShipSize, selectedShipHorizontal);
  if (!coords || !isPlacementValid(coords)) return;

  const ship = {
    id: `ship-${placedShips.length}`,
    size: selectedShipSize,
    coords: coords.map((c) => ({ ...c })),
    hits: [],
    sunk: false,
  };
  placedShips.push(ship);

  for (const c of coords) {
    placementBoardCells[c.y][c.x].classList.add('ship');
  }

  updateShipPalette();

  const remaining = getShipsToPlace();
  if (remaining.length > 0) {
    selectedShipSize = remaining[0];
  }
  updateShipPalette();
}

btnRotate.addEventListener('click', () => {
  selectedShipHorizontal = !selectedShipHorizontal;
});

function generateRandomShips() {
  const sizes = [...SHIP_SIZES];
  const ships = [];

  function canPlace(coords) {
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
      let x, y;
      if (horizontal) {
        x = Math.floor(Math.random() * (BOARD_SIZE - size + 1));
        y = Math.floor(Math.random() * BOARD_SIZE);
      } else {
        x = Math.floor(Math.random() * BOARD_SIZE);
        y = Math.floor(Math.random() * (BOARD_SIZE - size + 1));
      }
      const coords = [];
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

btnRandom.addEventListener('click', () => {
  placedShips = generateRandomShips();
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      placementBoardCells[y][x].classList.remove('ship');
    }
  }
  for (const ship of placedShips) {
    for (const c of ship.coords) {
      placementBoardCells[c.y][c.x].classList.add('ship');
    }
  }
  updateShipPalette();
});

btnConfirm.addEventListener('click', () => {
  if (placedShips.length !== SHIP_SIZES.length) {
    alert(`请摆放全部${SHIP_SIZES.length}艘舰船`);
    return;
  }
  send({ type: 'PLACE_SHIPS', ships: placedShips });
  myShips = placedShips.map((s) => ({ ...s, coords: s.coords.map((c) => ({ ...c })) }));
});

// ===== Battle =====
function initBattleBoards() {
  myBoard.innerHTML = '';
  myBoardCells.length = 0;
  myBoardHits.clear();
  myBoardMisses.clear();

  for (let y = 0; y < BOARD_SIZE; y++) {
    const row = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (myShips.some((s) => s.coords.some((c) => c.x === x && c.y === y))) {
        cell.classList.add('ship');
      }
      myBoard.appendChild(cell);
      row.push(cell);
    }
    myBoardCells.push(row);
  }

  enemyBoard.innerHTML = '';
  enemyBoardCells.length = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    enemyBoardState[y].fill('unknown');
    const row = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('click', () => onEnemyCellClick(x, y));
      cell.addEventListener('mouseenter', () => onEnemyCellHover(x, y));
      cell.addEventListener('mouseleave', () => clearShellPreview());
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
  const shellNames = { normal: '普通炮弹', cross: '十字', multi: '多头', nuke: '核弹' };
  shellInventory.innerHTML = '';

  const normalBtn = document.createElement('button');
  normalBtn.className = `shell-btn shell-normal ${selectedShell === null ? 'selected' : ''}`;
  normalBtn.textContent = shellNames.normal;
  normalBtn.addEventListener('click', () => { selectedShell = null; updateShellInventory(); });
  shellInventory.appendChild(normalBtn);

  const counts = {};
  for (const s of inventory) counts[s] = (counts[s] || 0) + 1;

  for (const type of ['cross', 'multi', 'nuke']) {
    const count = counts[type] || 0;
    const btn = document.createElement('button');
    btn.className = `shell-btn shell-${type} ${selectedShell === type ? 'selected' : ''}`;
    btn.textContent = `${shellNames[type]} (${count})`;
    btn.disabled = count === 0;
    btn.addEventListener('click', () => {
      selectedShell = selectedShell === type ? null : type;
      updateShellInventory();
    });
    shellInventory.appendChild(btn);
  }
}

// ===== Shell Preview =====
function getShellPreviewCoords(shellType, x, y) {
  const coords = [];
  if (shellType === 'cross') {
    const dirs = [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    for (const d of dirs) {
      const cx = x + d.x, cy = y + d.y;
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

function onEnemyCellHover(x, y) {
  clearShellPreview();
  if (!selectedShell) return;
  const coords = getShellPreviewCoords(selectedShell, x, y);
  for (const c of coords) {
    const cell = enemyBoardCells[c.y][c.x];
    if (!cell.classList.contains('hit') && !cell.classList.contains('miss')) {
      cell.classList.add('shell-preview');
    }
  }
}

function clearShellPreview() {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      enemyBoardCells[y][x].classList.remove('shell-preview');
    }
  }
}

function onEnemyCellClick(x, y) {
  if (!isMyTurn) return;
  if (enemyBoardState[y][x] !== 'unknown' && enemyBoardState[y][x] !== 'item') return;

  if (selectedShell) {
    const idx = inventory.indexOf(selectedShell);
    if (idx !== -1) {
      inventory.splice(idx, 1);
      updateShellInventory();
    }
    send({ type: 'USE_SHELL', shellType: selectedShell, x, y });
    selectedShell = null;
  } else {
    send({ type: 'FIRE', x, y });
  }
}

function handleFireResult(msg) {
  const key = `${msg.x},${msg.y}`;

  if (msg.shooter === myId) {
    enemyBoardState[msg.y][msg.x] = msg.result;
    const cell = enemyBoardCells[msg.y][msg.x];
    cell.classList.remove('item');
    cell.classList.add(msg.result);

    if (msg.shipSunk) {
      for (const c of msg.shipSunk.coords) {
        enemyBoardCells[c.y][c.x].classList.add('sunk');
      }
      showToast(`击沉敌方 ${msg.shipSunk.size} 格战舰！`, 'success');
    }
  } else {
    const cell = myBoardCells[msg.y][msg.x];
    if (msg.result === 'hit') {
      myBoardHits.add(key);
      cell.classList.add('hit');
      if (msg.shipSunk) {
        for (const c of msg.shipSunk.coords) {
          myBoardCells[c.y][c.x].classList.add('sunk');
        }
        showToast(`你的 ${msg.shipSunk.size} 格战舰被击沉！`, 'danger');
      }
    } else {
      myBoardMisses.add(key);
      cell.classList.add('miss');
    }
  }
}

function handleShellResult(msg) {
  const isMyShell = msg.shooter === myId;
  const sunkShips = new Set();

  for (const target of msg.targets) {
    if (isMyShell) {
      enemyBoardState[target.y][target.x] = target.result;
      const cell = enemyBoardCells[target.y][target.x];
      cell.classList.remove('item');
      cell.classList.add(target.result);
      if (target.shipSunk) {
        for (const c of target.shipSunk.coords) {
          enemyBoardCells[c.y][c.x].classList.add('sunk');
        }
        sunkShips.add(target.shipSunk.size);
      }
    } else {
      const cell = myBoardCells[target.y][target.x];
      if (target.result === 'hit') {
        cell.classList.add('hit');
        if (target.shipSunk) {
          for (const c of target.shipSunk.coords) {
            myBoardCells[c.y][c.x].classList.add('sunk');
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

function handleItemSpawned(positions) {
  for (const pos of positions) {
    if (pos.playerId !== myId) {
      if (enemyBoardState[pos.y][pos.x] === 'unknown') {
        enemyBoardState[pos.y][pos.x] = 'item';
        enemyBoardCells[pos.y][pos.x].classList.add('item');
      }
    }
  }
}

// ===== Game Over Modal =====
function showGameOverModal(isWinner, scores, revealShips) {
  scoreDisplay.textContent = `${scores[0]} : ${scores[1]}`;
  modalTitle.textContent = isWinner ? '胜利!' : '失败!';
  modalTitle.className = isWinner ? 'win' : 'lose';
  modalScore.textContent = `${scores[0]} : ${scores[1]}`;
  gameOverModal.classList.remove('hidden');

  if (revealShips) {
    for (const rs of revealShips) {
      const isMyShip = rs.playerId === myId;
      const boardCells = isMyShip ? myBoardCells : enemyBoardCells;
      for (const ship of rs.ships) {
        for (const c of ship.coords) {
          const cell = boardCells[c.y][c.x];
          if (!cell.classList.contains('hit') && !cell.classList.contains('sunk')) {
            cell.classList.add('ship-revealed');
          }
        }
      }
    }
  }
}

btnModalRestart.addEventListener('click', () => {
  send({ type: 'PLAY_AGAIN' });
});

btnModalExit.addEventListener('click', () => {
  send({ type: 'LEAVE_ROOM' });
  ws.close();
  location.reload();
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
  for (let y = 0; y < BOARD_SIZE; y++) {
    enemyBoardState[y].fill('unknown');
  }
  gameOverModal.classList.add('hidden');
}

// ===== Init =====
connect();
