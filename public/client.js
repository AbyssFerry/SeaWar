// client/config.ts
var BOARD_SIZE = 15;
var SHIP_SIZES = [5, 4, 3, 3, 2];
var SHELL_NAMES = {
  normal: "普通炮弹",
  cross: "十字",
  multi: "多头",
  nuke: "核弹"
};

// client/state.ts
var state = {
  myId: "",
  roomId: "",
  currentPhase: "lobby",
  isMyTurn: false,
  selectedShell: null,
  selectedShipSize: 5,
  selectedShipHorizontal: true,
  placedShips: [],
  inventory: [],
  myShips: [],
  myBoardCells: [],
  enemyBoardCells: [],
  placementBoardCells: [],
  enemyBoardState: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill("unknown")),
  myBoardHits: new Set,
  myBoardMisses: new Set,
  tournamentCode: "",
  tournamentPhase: "",
  tournamentHostId: "",
  isInTournamentMatch: false,
  currentMatchId: "",
  isSpectating: false
};
function resetGameState() {
  state.isMyTurn = false;
  state.selectedShell = null;
  state.selectedShipSize = 5;
  state.selectedShipHorizontal = true;
  state.placedShips = [];
  state.inventory = [];
  state.myShips = [];
  state.myBoardHits.clear();
  state.myBoardMisses.clear();
  for (let y = 0;y < BOARD_SIZE; y++) {
    state.enemyBoardState[y].fill("unknown");
  }
  state.isInTournamentMatch = false;
  state.currentMatchId = "";
  state.isSpectating = false;
}
function resetTournamentState() {
  state.tournamentCode = "";
  state.tournamentPhase = "";
  state.tournamentHostId = "";
  resetGameState();
}

// client/ws.ts
var ws = null;
var messageHandler = null;
function initWebSocket(handler) {
  messageHandler = handler;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onopen = () => {
    console.log("WebSocket connected");
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (messageHandler)
      messageHandler(msg);
  };
  ws.onclose = () => {
    alert("连接已断开，请刷新页面重试");
    location.reload();
  };
  ws.onerror = () => {
    alert("WebSocket 错误");
  };
}
function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
function closeConnection() {
  if (ws)
    ws.close();
}

// client/dom.ts
var screens = {
  lobby: document.getElementById("lobby"),
  placement: document.getElementById("placement"),
  battle: document.getElementById("battle"),
  tournamentMenu: document.getElementById("tournament-menu"),
  tournamentLobby: document.getElementById("tournament-lobby"),
  tournamentMain: document.getElementById("tournament-main")
};
var playerNameInput = document.getElementById("playerName");
var roomIdInput = document.getElementById("roomIdInput");
var btnCreateRoom = document.getElementById("btnCreateRoom");
var btnJoinRoom = document.getElementById("btnJoinRoom");
var roomInfo = document.getElementById("roomInfo");
var roomIdDisplay = document.getElementById("roomIdDisplay");
var roomStatus = document.getElementById("roomStatus");
var playerList = document.getElementById("playerList");
var placementBoard = document.getElementById("placementBoard");
var shipPalette = document.getElementById("shipPalette");
var btnRotate = document.getElementById("btnRotate");
var btnRandom = document.getElementById("btnRandom");
var btnConfirm = document.getElementById("btnConfirm");
var myBoard = document.getElementById("myBoard");
var enemyBoard = document.getElementById("enemyBoard");
var turnIndicator = document.getElementById("turnIndicator");
var shellInventory = document.getElementById("shellInventory");
var scoreDisplay = document.getElementById("scoreDisplay");
var gameOverModal = document.getElementById("gameOverModal");
var modalTitle = document.getElementById("modalTitle");
var modalScore = document.getElementById("modalScore");
var btnModalRestart = document.getElementById("btnModalRestart");
var btnModalExit = document.getElementById("btnModalExit");

// client/utils.ts
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
function showScreen(name) {
  state.currentPhase = name;
  Object.values(screens).forEach((s) => s?.classList.add("hidden"));
  const keyMap = {
    lobby: "lobby",
    placement: "placement",
    battle: "battle",
    "tournament-menu": "tournamentMenu",
    "tournament-lobby": "tournamentLobby",
    "tournament-main": "tournamentMain"
  };
  const screen = screens[keyMap[name]];
  if (!screen) {
    console.error(`Unknown screen: ${name}`);
    return;
  }
  screen.classList.remove("hidden");
}

// client/screens/lobby.ts
function updatePlayerList(players) {
  playerList.innerHTML = "";
  for (const p of players) {
    const div = document.createElement("div");
    div.className = "player-item";
    div.innerHTML = `<span>${p.name}</span><span class="ready-status">${p.ready ? "已准备" : "未准备"}</span>`;
    playerList.appendChild(div);
  }
  roomStatus.textContent = players.length < 2 ? "等待玩家加入..." : "玩家已集齐，准备开始!";
}
function showRoomCreated(roomId) {
  roomIdDisplay.textContent = roomId;
  roomInfo.classList.remove("hidden");
}
var initialized = false;
function init() {
  if (initialized)
    return;
  initialized = true;
  btnCreateRoom.addEventListener("click", () => {
    const name = playerNameInput.value.trim();
    if (!name) {
      alert("请输入你的名字");
      return;
    }
    send({ type: "CREATE_ROOM", playerName: name });
  });
  btnJoinRoom.addEventListener("click", () => {
    const name = playerNameInput.value.trim();
    const rid = roomIdInput.value.trim();
    if (!name) {
      alert("请输入你的名字");
      return;
    }
    if (!rid) {
      alert("请输入房间号");
      return;
    }
    send({ type: "JOIN_ROOM", roomId: rid, playerName: name });
  });
  const btnCreateTournament = document.getElementById("btn-create-tournament");
  const btnJoinTournament = document.getElementById("btn-join-tournament");
  const codeInput = document.getElementById("tournament-code-input");
  const modal = document.getElementById("tournament-config-modal");
  const confirmBtn = document.getElementById("btn-tournament-config-confirm");
  const cancelBtn = document.getElementById("btn-tournament-config-cancel");
  const nameInput = document.getElementById("tournament-name-input");
  const gamesSelect = document.getElementById("tournament-games-select");
  btnCreateTournament?.addEventListener("click", () => {
    modal?.classList.remove("hidden");
  });
  cancelBtn?.addEventListener("click", () => {
    modal?.classList.add("hidden");
  });
  confirmBtn?.addEventListener("click", () => {
    const name = nameInput?.value.trim() || "我的锦标赛";
    const gamesToWin = parseInt(gamesSelect?.value ?? "3");
    send({ type: "CREATE_TOURNAMENT", name, gamesToWin });
    modal?.classList.add("hidden");
  });
  btnJoinTournament?.addEventListener("click", () => {
    const code = codeInput?.value.trim() ?? "";
    if (code.length !== 6) {
      alert("请输入6位房间码");
      return;
    }
    const playerName = playerNameInput.value.trim() || "Player";
    send({ type: "JOIN_TOURNAMENT", code, playerName });
  });
}

// client/core/ships.ts
function getPlacementCoords(x, y, size, horizontal) {
  const coords = [];
  for (let i = 0;i < size; i++) {
    const cx = horizontal ? x + i : x;
    const cy = horizontal ? y : y + i;
    if (cx < 0 || cx >= BOARD_SIZE || cy < 0 || cy >= BOARD_SIZE)
      return null;
    coords.push({ x: cx, y: cy });
  }
  return coords;
}
function isPlacementValid(coords, placedShips) {
  for (const ship of placedShips) {
    for (const sc of ship.coords) {
      for (const c of coords) {
        if (sc.x === c.x && sc.y === c.y)
          return false;
        const dx = Math.abs(sc.x - c.x);
        const dy = Math.abs(sc.y - c.y);
        if (dx + dy === 1)
          return false;
      }
    }
  }
  return true;
}
function generateRandomShips() {
  const sizes = [...SHIP_SIZES];
  const ships = [];
  function canPlace(coords) {
    for (const c of coords) {
      if (c.x < 0 || c.x >= BOARD_SIZE || c.y < 0 || c.y >= BOARD_SIZE)
        return false;
    }
    for (const ship of ships) {
      for (const sc of ship.coords) {
        for (const c of coords) {
          if (sc.x === c.x && sc.y === c.y)
            return false;
          const dx = Math.abs(sc.x - c.x);
          const dy = Math.abs(sc.y - c.y);
          if (dx + dy === 1)
            return false;
        }
      }
    }
    return true;
  }
  for (let i = 0;i < sizes.length; i++) {
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
      for (let j = 0;j < size; j++) {
        coords.push(horizontal ? { x: x + j, y } : { x, y: y + j });
      }
      if (canPlace(coords)) {
        ships.push({ id: `ship-${i}`, size, coords, hits: [], sunk: false });
        placed = true;
      }
    }
    if (!placed)
      return generateRandomShips();
  }
  return ships;
}
function getShipsToPlace(placedShips) {
  const allSizes = [...SHIP_SIZES];
  const placedSizes = placedShips.map((s) => s.size);
  const remaining = [...allSizes];
  for (const size of placedSizes) {
    const idx = remaining.indexOf(size);
    if (idx !== -1)
      remaining.splice(idx, 1);
  }
  return remaining;
}

// client/screens/placement.ts
function initBoard() {
  placementBoard.innerHTML = "";
  state.placementBoardCells.length = 0;
  state.placedShips = [];
  for (let y = 0;y < BOARD_SIZE; y++) {
    const row = [];
    for (let x = 0;x < BOARD_SIZE; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener("click", () => onPlacementCellClick(x, y));
      cell.addEventListener("mouseenter", () => onPlacementCellHover(x, y));
      cell.addEventListener("mouseleave", () => clearPlacementPreview());
      placementBoard.appendChild(cell);
      row.push(cell);
    }
    state.placementBoardCells.push(row);
  }
}
function updatePalette() {
  const remaining = getShipsToPlace(state.placedShips);
  const options = shipPalette.querySelectorAll(".ship-option");
  options.forEach((opt) => {
    const size = Number(opt.dataset.size);
    const countRemaining = remaining.filter((s) => s === size).length;
    const isPlaced = countRemaining === 0;
    if (isPlaced) {
      opt.classList.add("placed");
    } else {
      opt.classList.remove("placed");
    }
    if (size === state.selectedShipSize && !isPlaced) {
      opt.style.borderColor = "#00d4ff";
    } else {
      opt.style.borderColor = "";
    }
  });
}
function onPlacementCellHover(x, y) {
  clearPlacementPreview();
  const coords = getPlacementCoords(x, y, state.selectedShipSize, state.selectedShipHorizontal);
  if (!coords) {
    state.placementBoardCells[y][x].classList.add("placing-invalid");
    return;
  }
  const valid = isPlacementValid(coords, state.placedShips);
  for (const c of coords) {
    state.placementBoardCells[c.y][c.x].classList.add(valid ? "placing-valid" : "placing-invalid");
  }
}
function clearPlacementPreview() {
  for (let y = 0;y < BOARD_SIZE; y++) {
    for (let x = 0;x < BOARD_SIZE; x++) {
      state.placementBoardCells[y][x].classList.remove("placing-valid", "placing-invalid");
    }
  }
}
function onPlacementCellClick(x, y) {
  if (state.placedShips.length >= SHIP_SIZES.length)
    return;
  const coords = getPlacementCoords(x, y, state.selectedShipSize, state.selectedShipHorizontal);
  if (!coords || !isPlacementValid(coords, state.placedShips))
    return;
  const ship = {
    id: `ship-${state.placedShips.length}`,
    size: state.selectedShipSize,
    coords: coords.map((c) => ({ ...c })),
    hits: [],
    sunk: false
  };
  state.placedShips.push(ship);
  for (const c of coords) {
    state.placementBoardCells[c.y][c.x].classList.add("ship");
  }
  updatePalette();
  const remaining = getShipsToPlace(state.placedShips);
  if (remaining.length > 0) {
    state.selectedShipSize = remaining[0];
  }
  updatePalette();
}
function init2() {
  shipPalette.addEventListener("click", (e) => {
    const option = e.target.closest(".ship-option");
    if (!option)
      return;
    if (option.classList.contains("placed"))
      return;
    state.selectedShipSize = Number(option.dataset.size);
    updatePalette();
  });
  btnRotate.addEventListener("click", () => {
    state.selectedShipHorizontal = !state.selectedShipHorizontal;
  });
  btnRandom.addEventListener("click", () => {
    state.placedShips = generateRandomShips();
    for (let y = 0;y < BOARD_SIZE; y++) {
      for (let x = 0;x < BOARD_SIZE; x++) {
        state.placementBoardCells[y][x].classList.remove("ship");
      }
    }
    for (const ship of state.placedShips) {
      for (const c of ship.coords) {
        state.placementBoardCells[c.y][c.x].classList.add("ship");
      }
    }
    updatePalette();
  });
  btnConfirm.addEventListener("click", () => {
    if (state.placedShips.length !== SHIP_SIZES.length) {
      alert(`请摆放全部${SHIP_SIZES.length}艘舰船`);
      return;
    }
    send({ type: "PLACE_SHIPS", ships: state.placedShips });
    state.myShips = state.placedShips.map((s) => ({ ...s, coords: s.coords.map((c) => ({ ...c })) }));
  });
}

// client/core/shells.ts
function getShellPreviewCoords(shellType, x, y) {
  const coords = [];
  if (shellType === "cross") {
    const dirs = [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    for (const d of dirs) {
      const cx = x + d.x;
      const cy = y + d.y;
      if (cx >= 0 && cx < BOARD_SIZE && cy >= 0 && cy < BOARD_SIZE)
        coords.push({ x: cx, y: cy });
    }
  } else if (shellType === "nuke") {
    const pattern = [{ dy: -2, width: 1 }, { dy: -1, width: 3 }, { dy: 0, width: 5 }, { dy: 1, width: 3 }, { dy: 2, width: 1 }];
    for (const row of pattern) {
      const cy = y + row.dy;
      if (cy < 0 || cy >= BOARD_SIZE)
        continue;
      const half = Math.floor(row.width / 2);
      for (let dx = -half;dx <= half; dx++) {
        const cx = x + dx;
        if (cx >= 0 && cx < BOARD_SIZE)
          coords.push({ x: cx, y: cy });
      }
    }
  } else {
    coords.push({ x, y });
  }
  return coords;
}

// client/screens/battle.ts
function initBoards() {
  myBoard.innerHTML = "";
  state.myBoardCells.length = 0;
  state.myBoardHits.clear();
  state.myBoardMisses.clear();
  for (let y = 0;y < BOARD_SIZE; y++) {
    const row = [];
    for (let x = 0;x < BOARD_SIZE; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (state.myShips.some((s) => s.coords.some((c) => c.x === x && c.y === y))) {
        cell.classList.add("ship");
      }
      myBoard.appendChild(cell);
      row.push(cell);
    }
    state.myBoardCells.push(row);
  }
  enemyBoard.innerHTML = "";
  state.enemyBoardCells.length = 0;
  for (let y = 0;y < BOARD_SIZE; y++) {
    state.enemyBoardState[y].fill("unknown");
    const row = [];
    for (let x = 0;x < BOARD_SIZE; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener("click", () => onEnemyCellClick(x, y));
      cell.addEventListener("mouseenter", () => onEnemyCellHover(x, y));
      cell.addEventListener("mouseleave", () => clearShellPreview());
      enemyBoard.appendChild(cell);
      row.push(cell);
    }
    state.enemyBoardCells.push(row);
  }
  updateShellInventory();
}
function updateTurnIndicator() {
  if (state.isMyTurn) {
    turnIndicator.textContent = "你的回合 ⚔️";
    turnIndicator.classList.remove("waiting");
  } else {
    turnIndicator.textContent = "对手回合 ⏳";
    turnIndicator.classList.add("waiting");
  }
}
function updateShellInventory() {
  shellInventory.innerHTML = "";
  const normalBtn = document.createElement("button");
  normalBtn.className = `shell-btn shell-normal ${state.selectedShell === null ? "selected" : ""}`;
  normalBtn.textContent = SHELL_NAMES.normal;
  normalBtn.addEventListener("click", () => {
    state.selectedShell = null;
    updateShellInventory();
  });
  shellInventory.appendChild(normalBtn);
  const counts = {};
  for (const s of state.inventory)
    counts[s] = (counts[s] || 0) + 1;
  for (const type of ["cross", "multi", "nuke"]) {
    const count = counts[type] || 0;
    const btn = document.createElement("button");
    btn.className = `shell-btn shell-${type} ${state.selectedShell === type ? "selected" : ""}`;
    btn.textContent = `${SHELL_NAMES[type]} (${count})`;
    btn.disabled = count === 0;
    btn.addEventListener("click", () => {
      state.selectedShell = state.selectedShell === type ? null : type;
      updateShellInventory();
    });
    shellInventory.appendChild(btn);
  }
}
function onEnemyCellHover(x, y) {
  clearShellPreview();
  if (!state.selectedShell)
    return;
  const coords = getShellPreviewCoords(state.selectedShell, x, y);
  for (const c of coords) {
    const cell = state.enemyBoardCells[c.y][c.x];
    if (!cell.classList.contains("hit") && !cell.classList.contains("miss")) {
      cell.classList.add("shell-preview");
    }
  }
}
function clearShellPreview() {
  for (let y = 0;y < BOARD_SIZE; y++) {
    for (let x = 0;x < BOARD_SIZE; x++) {
      state.enemyBoardCells[y][x].classList.remove("shell-preview");
    }
  }
}
function onEnemyCellClick(x, y) {
  if (!state.isMyTurn)
    return;
  if (state.enemyBoardState[y][x] !== "unknown" && state.enemyBoardState[y][x] !== "item")
    return;
  if (state.selectedShell) {
    const idx = state.inventory.indexOf(state.selectedShell);
    if (idx !== -1) {
      state.inventory.splice(idx, 1);
      updateShellInventory();
    }
    send({ type: "USE_SHELL", shellType: state.selectedShell, x, y });
    state.selectedShell = null;
  } else {
    send({ type: "FIRE", x, y });
  }
}
function handleFireResult(msg) {
  const key = `${msg.x},${msg.y}`;
  if (msg.shooter === state.myId) {
    state.enemyBoardState[msg.y][msg.x] = msg.result;
    const cell = state.enemyBoardCells[msg.y][msg.x];
    cell.classList.remove("item");
    cell.classList.add(msg.result);
    if (msg.shipSunk) {
      for (const c of msg.shipSunk.coords) {
        state.enemyBoardCells[c.y][c.x].classList.add("sunk");
      }
      showToast(`击沉敌方 ${msg.shipSunk.size} 格战舰！`, "success");
    }
  } else {
    const cell = state.myBoardCells[msg.y][msg.x];
    if (msg.result === "hit") {
      state.myBoardHits.add(key);
      cell.classList.add("hit");
      if (msg.shipSunk) {
        for (const c of msg.shipSunk.coords) {
          state.myBoardCells[c.y][c.x].classList.add("sunk");
        }
        showToast(`你的 ${msg.shipSunk.size} 格战舰被击沉！`, "danger");
      }
    } else {
      state.myBoardMisses.add(key);
      cell.classList.add("miss");
    }
  }
}
function handleShellResult(msg) {
  const isMyShell = msg.shooter === state.myId;
  const sunkShips = new Set;
  for (const target of msg.targets) {
    if (isMyShell) {
      state.enemyBoardState[target.y][target.x] = target.result;
      const cell = state.enemyBoardCells[target.y][target.x];
      cell.classList.remove("item");
      cell.classList.add(target.result);
      if (target.shipSunk) {
        for (const c of target.shipSunk.coords) {
          state.enemyBoardCells[c.y][c.x].classList.add("sunk");
        }
        sunkShips.add(target.shipSunk.size);
      }
    } else {
      const cell = state.myBoardCells[target.y][target.x];
      if (target.result === "hit") {
        cell.classList.add("hit");
        if (target.shipSunk) {
          for (const c of target.shipSunk.coords) {
            state.myBoardCells[c.y][c.x].classList.add("sunk");
          }
          sunkShips.add(target.shipSunk.size);
        }
      } else {
        cell.classList.add("miss");
      }
    }
  }
  for (const size of sunkShips) {
    if (isMyShell) {
      showToast(`击沉敌方 ${size} 格战舰！`, "success");
    } else {
      showToast(`你的 ${size} 格战舰被击沉！`, "danger");
    }
  }
}
function handleItemSpawned(positions) {
  for (const pos of positions) {
    if (pos.playerId !== state.myId) {
      if (state.enemyBoardState[pos.y][pos.x] === "unknown") {
        state.enemyBoardState[pos.y][pos.x] = "item";
        state.enemyBoardCells[pos.y][pos.x].classList.add("item");
      }
    }
  }
}
function showTournamentInfo(show) {
  const infoBar = document.getElementById("tournament-battle-info");
  if (infoBar) {
    infoBar.classList.toggle("hidden", !show);
  }
}

// client/screens/gameover.ts
function showModal(isWinner, scores, revealShips) {
  scoreDisplay.textContent = `${scores[0]} : ${scores[1]}`;
  modalTitle.textContent = isWinner ? "胜利!" : "失败!";
  modalTitle.className = isWinner ? "win" : "lose";
  modalScore.textContent = `${scores[0]} : ${scores[1]}`;
  gameOverModal.classList.remove("hidden");
  if (revealShips) {
    for (const rs of revealShips) {
      const isMyShip = rs.playerId === state.myId;
      const boardCells = isMyShip ? state.myBoardCells : state.enemyBoardCells;
      for (const ship of rs.ships) {
        for (const c of ship.coords) {
          const cell = boardCells[c.y][c.x];
          if (!cell.classList.contains("hit") && !cell.classList.contains("sunk")) {
            cell.classList.add("ship-revealed");
          }
        }
      }
    }
  }
}
function init3() {
  btnModalRestart.addEventListener("click", () => {
    send({ type: "PLAY_AGAIN" });
  });
  btnModalExit.addEventListener("click", () => {
    send({ type: "LEAVE_ROOM" });
    closeConnection();
    location.reload();
  });
}
function hideModal() {
  gameOverModal.classList.add("hidden");
}

// client/screens/tournament-menu.ts
function init4() {}

// client/screens/tournament-lobby.ts
function init5() {
  const startBtn = document.getElementById("btn-start-tournament");
  const leaveBtn = document.getElementById("btn-leave-tournament-lobby");
  startBtn?.addEventListener("click", () => {
    send({ type: "START_TOURNAMENT" });
  });
  leaveBtn?.addEventListener("click", () => {
    send({ type: "LEAVE_TOURNAMENT" });
    resetTournamentState();
    showScreen("lobby");
  });
}
function showTournamentLobby(name, code, hostId, participants) {
  showScreen("tournament-lobby");
  const nameEl = document.getElementById("tournament-lobby-name");
  const codeEl = document.getElementById("tournament-lobby-code");
  const listEl = document.getElementById("tournament-lobby-players");
  const startBtn = document.getElementById("btn-start-tournament");
  if (nameEl)
    nameEl.textContent = name;
  if (codeEl)
    codeEl.textContent = code;
  if (listEl) {
    listEl.innerHTML = "";
    for (const p of participants) {
      const li = document.createElement("li");
      li.textContent = p.name + (p.id === hostId ? " (房主)" : "");
      listEl.appendChild(li);
    }
  }
  if (startBtn) {
    startBtn.classList.toggle("hidden", state.myId !== hostId);
  }
}

// client/screens/tournament-main.ts
var currentMatches = [];
var currentRound = 1;
function init6() {}
function showTournamentMain(name, code) {
  showScreen("tournament-main");
  const nameEl = document.getElementById("tournament-main-name");
  const codeEl = document.getElementById("tournament-main-code");
  if (nameEl)
    nameEl.textContent = name;
  if (codeEl)
    codeEl.textContent = code;
}
function updateStandings(standings) {
  const tbody = document.querySelector("#standings-table tbody");
  if (!tbody)
    return;
  tbody.innerHTML = "";
  standings.forEach((s, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${index + 1}</td><td>${s.name}</td><td>${s.score}</td><td>${s.matchesPlayed}</td>`;
    tbody.appendChild(tr);
  });
}
function updateSchedule(matches, round) {
  currentMatches = matches;
  currentRound = round;
  const roundEl = document.getElementById("tournament-current-round");
  if (roundEl)
    roundEl.textContent = String(round);
  const listEl = document.getElementById("schedule-list");
  if (!listEl)
    return;
  listEl.innerHTML = "";
  for (const match of matches) {
    const div = document.createElement("div");
    div.className = `match-card ${match.status}`;
    const isMyMatch = match.participantA === state.myId || match.participantB === state.myId;
    const canSpectate = match.status === "ongoing" && !isMyMatch;
    let html = `<div class="match-players">${match.participantAName || "???"} vs ${match.participantBName || "???"}</div>`;
    html += `<div class="match-status">${getStatusText(match)}</div>`;
    if (match.status === "completed") {
      html += `<div class="match-result">${match.winsA} - ${match.winsB}</div>`;
    }
    if (canSpectate) {
      html += `<button class="btn-spectate" data-match-id="${match.id}">观战</button>`;
    }
    div.innerHTML = html;
    listEl.appendChild(div);
  }
  listEl.querySelectorAll(".btn-spectate").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const matchId = e.target.dataset.matchId;
      if (matchId) {
        send({ type: "SPECTATE_MATCH", matchId });
        state.isSpectating = true;
        state.currentMatchId = matchId;
      }
    });
  });
}
function getStatusText(match) {
  if (match.status === "pending")
    return "未开始";
  if (match.status === "ongoing")
    return "进行中";
  if (match.status === "completed")
    return "已结束";
  return match.status;
}
function showMatchAssigned(matchId) {
  state.isInTournamentMatch = true;
  state.currentMatchId = matchId;
  state.isSpectating = false;
  const statusText = document.getElementById("tournament-status-text");
  if (statusText)
    statusText.textContent = "你已分配到对战，正在进入...";
  send({ type: "ENTER_MATCH", matchId });
}
function showForceEnterMatch(matchId) {
  if (state.isSpectating) {
    send({ type: "STOP_SPECTATING" });
  }
  showMatchAssigned(matchId);
}
function handleMatchEnded(matchId) {
  state.isInTournamentMatch = false;
  state.currentMatchId = "";
  state.isSpectating = false;
  const statusText = document.getElementById("tournament-status-text");
  if (statusText)
    statusText.textContent = "对战结束，等待下一轮...";
}
function showRoundCompleted(nextRound) {
  const statusText = document.getElementById("tournament-status-text");
  if (statusText)
    statusText.textContent = `第 ${nextRound} 轮即将开始`;
}
function showTournamentEnded(rankings) {
  const statusText = document.getElementById("tournament-status-text");
  if (statusText) {
    let html = "<h3>锦标赛结束！</h3><ol>";
    for (const r of rankings) {
      html += `<li>${r.name} - ${r.score} 分</li>`;
    }
    html += "</ol>";
    statusText.innerHTML = html;
  }
}

// client/main.ts
function handleServerMessage(msg) {
  switch (msg.type) {
    case "ROOM_CREATED":
      state.roomId = msg.roomId;
      showRoomCreated(msg.roomId);
      break;
    case "PLAYER_ASSIGNED":
      state.myId = msg.playerId;
      break;
    case "ROOM_STATE":
      state.roomId = msg.roomId;
      updatePlayerList(msg.players);
      if (msg.phase === "placement" && state.currentPhase === "lobby") {
        showScreen("placement");
        initBoard();
        updatePalette();
      }
      break;
    case "GAME_START":
      state.isMyTurn = msg.firstTurn === state.myId;
      showScreen("battle");
      initBoards();
      updateTurnIndicator();
      updateShellInventory();
      if (state.isInTournamentMatch) {
        showTournamentInfo(true);
      }
      break;
    case "FIRE_RESULT":
      handleFireResult(msg);
      break;
    case "SHELL_RESULT":
      handleShellResult(msg);
      break;
    case "TURN_CHANGE":
      state.isMyTurn = msg.currentTurn === state.myId;
      updateTurnIndicator();
      break;
    case "ITEM_SPAWNED":
      handleItemSpawned(msg.positions);
      break;
    case "INVENTORY_UPDATE":
      state.inventory = msg.shells;
      updateShellInventory();
      break;
    case "GAME_OVER":
      if (state.isInTournamentMatch) {
        showTournamentInfo(false);
        setTimeout(() => {
          showTournamentMain("", state.tournamentCode);
        }, 2000);
      } else {
        showModal(msg.winner === state.myId, msg.scores, msg.revealShips);
      }
      break;
    case "RESTART_READY":
      resetGameState();
      hideModal();
      showScreen("placement");
      initBoard();
      updatePalette();
      break;
    case "OPPONENT_LEFT":
      alert("对手已离开");
      break;
    case "TOURNAMENT_CREATED":
      state.tournamentCode = msg.code;
      break;
    case "TOURNAMENT_STATE":
      state.tournamentPhase = msg.phase;
      state.tournamentHostId = msg.hostId;
      if (msg.phase === "lobby") {
        showTournamentLobby(msg.name, msg.code, msg.hostId, msg.participants);
      }
      break;
    case "TOURNAMENT_STARTED":
      state.tournamentPhase = "running";
      showTournamentMain(msg.matches[0]?.name || "锦标赛", state.tournamentCode);
      updateSchedule(msg.matches, 1);
      break;
    case "MATCH_ASSIGNED":
      showMatchAssigned(msg.matchId);
      break;
    case "MATCH_ENDED":
      handleMatchEnded(msg.matchId);
      break;
    case "STANDINGS_UPDATE":
      updateStandings(msg.standings);
      break;
    case "ROUND_COMPLETED":
      showRoundCompleted(msg.nextRound);
      break;
    case "TOURNAMENT_ENDED":
      state.tournamentPhase = "ended";
      showTournamentEnded(msg.rankings);
      break;
    case "FORCE_ENTER_MATCH":
      showForceEnterMatch(msg.matchId);
      break;
    case "ERROR":
      console.error("Server error:", msg.message);
      break;
  }
}
init();
init2();
init3();
init4();
init5();
init6();
showScreen("lobby");
initWebSocket(handleServerMessage);
