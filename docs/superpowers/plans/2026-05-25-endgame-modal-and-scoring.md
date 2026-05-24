# Endgame Modal and Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cumulative scoring within a room and replace the game-over screen with a modal overlay that reveals all ship positions.

**Architecture:** Extend the Room model with a `scores` array. Update the GAME_OVER message to include scores and both players' full ship layouts. The frontend renders a modal on top of the battle screen and uses the revealed ships to show the opponent's unsunk fleet.

**Tech Stack:** TypeScript, Bun, WebSocket, DOM.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types.ts` | Add `scores` to Room type; extend GAME_OVER with `scores` and `revealShips` |
| `src/server/room-manager.ts` | Initialize scores on room creation; preserve scores on restart |
| `src/server/message-handler.ts` | Increment score on win; broadcast scores and full ship layouts in GAME_OVER |
| `public/index.html` | Add modal overlay DOM inside #battle |
| `public/style.css` | Modal, overlay, score display, .ship-revealed styles |
| `public/client.js` | Render score bar, handle GAME_OVER modal, reveal ships, exit/restart buttons |

---

## Task 1: Update Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add scores to Room type**

```typescript
export type Room = {
  id: string;
  players: [Player | null, Player | null];
  phase: RoomPhase;
  currentTurn: string;
  winner: string | null;
  turnCount: number;
  playAgainVotes: Set<string>;
  createdAt: number;
  scores: [number, number]; // NEW
};
```

- [ ] **Step 2: Extend GAME_OVER message**

```typescript
| { type: 'GAME_OVER'; winner: string; reason: string; scores: number[]; revealShips: { playerId: string; ships: Ship[] }[] }
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add scores to Room and extend GAME_OVER message"
```

---

## Task 2: Update Room Manager

**Files:**
- Modify: `src/server/room-manager.ts`

- [ ] **Step 1: Initialize scores on room creation**

In `createRoom`, add `scores: [0, 0]` to the Room object:

```typescript
const room: Room = {
  id: roomId,
  players: [player, null],
  phase: 'lobby',
  currentTurn: '',
  winner: null,
  turnCount: 0,
  playAgainVotes: new Set(),
  createdAt: Date.now(),
  scores: [0, 0], // NEW
};
```

- [ ] **Step 2: Preserve scores on restart**

In `resetRoomForRestart`, do NOT reset scores. Remove any line that clears scores (there shouldn't be one yet, but verify).

- [ ] **Step 3: Commit**

```bash
git add src/server/room-manager.ts
git commit -m "feat: initialize and preserve room scores"
```

---

## Task 3: Update Message Handler

**Files:**
- Modify: `src/server/message-handler.ts`

- [ ] **Step 1: Increment score on win in handleFire**

After `room.winner = player.id`, find the winner's index and increment their score:

```typescript
const winnerIndex = room.players[0]?.id === player.id ? 0 : 1;
room.scores[winnerIndex]++;
```

Do the same in `handleUseShell` (after the win check).

- [ ] **Step 2: Build GAME_OVER with scores and revealShips**

In `handleFire`, replace the GAME_OVER broadcast with:

```typescript
const gameOver: ServerMessage = {
  type: 'GAME_OVER',
  winner: player.id,
  reason: 'All ships destroyed',
  scores: [...room.scores],
  revealShips: room.players
    .filter((p): p is Player => p !== null)
    .map((p) => ({ playerId: p.id, ships: p.board.ships })),
};
broadcast(room, gameOver);
```

Apply the same pattern to `handleUseShell`.

- [ ] **Step 3: Commit**

```bash
git add src/server/message-handler.ts
git commit -m "feat: broadcast scores and full ship layouts on GAME_OVER"
```

---

## Task 4: Update Frontend HTML

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add score display and modal inside #battle**

Replace the current `#battle` screen with:

```html
<!-- Battle Screen -->
<div id="battle" class="screen hidden">
  <div class="battle-content">
    <div class="battle-header">
      <div id="scoreDisplay" class="score-display">0 : 0</div>
      <div id="turnIndicator" class="turn-indicator">你的回合</div>
    </div>
    <div id="shellInventory" class="shell-inventory">
      <button class="shell-btn shell-normal selected" data-shell="normal">普通炮弹</button>
      <button class="shell-btn shell-cross" data-shell="cross">十字炮弹</button>
      <button class="shell-btn shell-multi" data-shell="multi">散射炮弹</button>
      <button class="shell-btn shell-nuke" data-shell="nuke">核弹</button>
    </div>
    <div class="boards-container">
      <div class="board-panel">
        <h3>你的海域</h3>
        <div id="myBoard" class="board"></div>
      </div>
      <div class="board-panel">
        <h3>敌方海域</h3>
        <div id="enemyBoard" class="board"></div>
      </div>
    </div>

    <!-- Game Over Modal -->
    <div id="gameOverModal" class="modal-overlay hidden">
      <div class="modal">
        <h2 id="modalTitle">胜利!</h2>
        <div id="modalScore" class="modal-score">0 : 0</div>
        <div class="modal-buttons">
          <button id="btnModalRestart" class="btn btn-primary">再来一局</button>
          <button id="btnModalExit" class="btn btn-secondary">退出</button>
        </div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Remove the old standalone #gameOver screen**

Delete or comment out the old `#gameOver` div.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add score display and game-over modal to battle screen"
```

---

## Task 5: Update Frontend CSS

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Add score display style**

```css
.battle-header {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
}

.score-display {
  font-size: 20px;
  font-weight: 700;
  color: #f1c40f;
  background: #16213e;
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid #3a3a5e;
}
```

- [ ] **Step 2: Add modal styles**

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.modal-overlay.hidden {
  display: none;
}

.modal {
  background: #1a1a2e;
  border: 2px solid #00d4ff;
  border-radius: 12px;
  padding: 40px 60px;
  text-align: center;
  min-width: 300px;
}

.modal h2 {
  font-size: 36px;
  margin-bottom: 16px;
}

.modal h2.win {
  color: #27ae60;
}

.modal h2.lose {
  color: #e74c3c;
}

.modal-score {
  font-size: 28px;
  font-weight: 700;
  color: #f1c40f;
  margin-bottom: 24px;
}

.modal-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
}
```

- [ ] **Step 3: Add .ship-revealed style**

```css
.cell.ship-revealed {
  background: #4a90d9;
  opacity: 0.5;
}
```

- [ ] **Step 4: Commit**

```bash
git add public/style.css
git commit -m "feat: add score, modal, and revealed-ship styles"
```

---

## Task 6: Update Frontend Client Logic

**Files:**
- Modify: `public/client.js`

- [ ] **Step 1: Add DOM references for new elements**

After existing DOM references, add:

```javascript
const scoreDisplay = document.getElementById('scoreDisplay');
const gameOverModal = document.getElementById('gameOverModal');
const modalTitle = document.getElementById('modalTitle');
const modalScore = document.getElementById('modalScore');
const btnModalRestart = document.getElementById('btnModalRestart');
const btnModalExit = document.getElementById('btnModalExit');
```

- [ ] **Step 2: Update handleServerMessage for GAME_OVER**

Replace the old `case 'GAME_OVER':` handler:

```javascript
case 'GAME_OVER':
  showGameOverModal(msg.winner === myId, msg.scores, msg.revealShips);
  break;
```

Also remove the old `case 'RESTART_READY':` that calls `showScreen('placement')` directly — it should now just close the modal and reset the board in-place.

- [ ] **Step 3: Implement showGameOverModal**

```javascript
function showGameOverModal(isWinner, scores, revealShips) {
  // Update score display
  scoreDisplay.textContent = `${scores[0]} : ${scores[1]}`;

  // Show modal
  modalTitle.textContent = isWinner ? '胜利!' : '失败!';
  modalTitle.className = isWinner ? 'win' : 'lose';
  modalScore.textContent = `${scores[0]} : ${scores[1]}`;
  gameOverModal.classList.remove('hidden');

  // Reveal all ships on both boards
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
```

- [ ] **Step 4: Update RESTART_READY handler**

```javascript
case 'RESTART_READY':
  resetGameState();
  gameOverModal.classList.add('hidden');
  initPlacementBoard();
  updateShipPalette();
  break;
```

- [ ] **Step 5: Wire up modal buttons**

```javascript
btnModalRestart.addEventListener('click', () => {
  send({ type: 'PLAY_AGAIN' });
});

btnModalExit.addEventListener('click', () => {
  send({ type: 'LEAVE_ROOM' });
  ws.close();
  location.reload();
});
```

- [ ] **Step 6: Remove old game-over screen references**

Delete or comment out references to the old `#gameOver` screen (`screens.gameOver`, `gameOverResult`, `gameOverReason`, `btnPlayAgain`, `showGameOver` function).

- [ ] **Step 7: Update resetGameState**

Ensure `resetGameState` hides the modal:

```javascript
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
```

- [ ] **Step 8: Commit**

```bash
git add public/client.js
git commit -m "feat: render score bar, game-over modal, and ship revelation"
```

---

## Task 7: Run and Verify

**Files:**
- All files

- [ ] **Step 1: Type check**

```bash
bunx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Start server**

```bash
bun server.ts
```

- [ ] **Step 3: Open two browser tabs to http://localhost:3000**

Test flow:
1. Create room / Join room
2. Place ships (both players)
3. Verify score shows `0 : 0`
4. Play until someone wins
5. Verify:
   - Modal appears with correct win/lose message
   - Score updated (e.g., `1 : 0`)
   - Both boards show all ships (unsunk enemy ships visible with `.ship-revealed`)
6. Click "再来一局" → both players click → verify modal closes, back to placement
7. Verify score persists (e.g., `1 : 0`)
8. Click "退出" → verify back to lobby

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete endgame modal and scoring system"
```

---

## Self-Review

**Spec coverage:**
- Score persistence within room → Task 2
- Score display on battle screen → Task 4, 5, 6
- GAME_OVER with scores and revealShips → Task 1, 3
- Modal overlay on battle screen → Task 4, 5, 6
- Reveal all ships after game → Task 3, 6
- Exit button returns to lobby → Task 6
- Play again preserves scores → Task 2, 6

**Placeholder scan:** None found.

**Type consistency:** `scores` is `[number, number]` everywhere; `revealShips` shape matches in types.ts and message-handler.ts.