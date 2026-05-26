import type { ServerMessage } from '../src/types';
import { state, resetGameState } from './state';
import { initWebSocket } from './ws';
import { showScreen } from './utils';
import * as lobby from './screens/lobby';
import * as placement from './screens/placement';
import * as battle from './screens/battle';
import * as gameover from './screens/gameover';

function handleServerMessage(msg: ServerMessage) {
  switch (msg.type) {
    case 'ROOM_CREATED':
      state.roomId = msg.roomId;
      lobby.showRoomCreated(msg.roomId);
      break;

    case 'PLAYER_ASSIGNED':
      state.myId = msg.playerId;
      break;

    case 'ROOM_STATE':
      state.roomId = msg.roomId;
      lobby.updatePlayerList(msg.players);
      if (msg.phase === 'placement' && state.currentPhase === 'lobby') {
        showScreen('placement');
        placement.initBoard();
        placement.updatePalette();
      }
      break;

    case 'GAME_START':
      state.isMyTurn = msg.firstTurn === state.myId;
      showScreen('battle');
      battle.initBoards();
      battle.updateTurnIndicator();
      battle.updateShellInventory();
      break;

    case 'FIRE_RESULT':
      battle.handleFireResult(msg);
      break;

    case 'SHELL_RESULT':
      battle.handleShellResult(msg);
      break;

    case 'TURN_CHANGE':
      state.isMyTurn = msg.currentTurn === state.myId;
      battle.updateTurnIndicator();
      break;

    case 'ITEM_SPAWNED':
      battle.handleItemSpawned(msg.positions);
      break;

    case 'INVENTORY_UPDATE':
      state.inventory = msg.shells;
      battle.updateShellInventory();
      break;

    case 'GAME_OVER':
      gameover.showModal(msg.winner === state.myId, msg.scores, msg.revealShips);
      break;

    case 'RESTART_READY':
      resetGameState();
      gameover.hideModal();
      showScreen('placement');
      placement.initBoard();
      placement.updatePalette();
      break;

    case 'OPPONENT_LEFT':
      alert('对手已离开');
      break;

    case 'ERROR':
      console.error('Server error:', msg.message);
      break;
  }
}

// Initialize screen modules (bind one-time event listeners)
lobby.init();
placement.init();
gameover.init();

// Connect to WebSocket server
initWebSocket(handleServerMessage);
