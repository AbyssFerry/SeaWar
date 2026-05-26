import type { ServerMessage } from '../src/types';
import { state, resetGameState, resetTournamentState } from './state';
import { initWebSocket } from './ws';
import { showScreen } from './utils';
import * as lobby from './screens/lobby';
import * as placement from './screens/placement';
import * as battle from './screens/battle';
import * as gameover from './screens/gameover';
import * as tournamentMenu from './screens/tournament-menu';
import * as tournamentLobby from './screens/tournament-lobby';
import * as tournamentMain from './screens/tournament-main';

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
      if (
        msg.phase === 'placement' &&
        state.currentPhase !== 'placement' &&
        (state.currentPhase !== 'battle' || state.isInTournamentMatch)
      ) {
        showScreen('placement');
        placement.initBoard();
        placement.updatePalette();
      }
      break;

    case 'GAME_START':
      state.isInTournamentMatch = msg.isTournamentMatch === true;
      state.isMyTurn = msg.firstTurn === state.myId;
      showScreen('battle');
      battle.initBoards();
      battle.updateTurnIndicator();
      battle.updateShellInventory();
      battle.showTournamentInfo(state.isInTournamentMatch);
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
      if (state.isInTournamentMatch) {
        battle.updateScore(msg.scores);
        if (msg.matchComplete === false) {
          break;
        }
        battle.showTournamentInfo(false);
        setTimeout(() => {
          tournamentMain.showTournamentMain('', state.tournamentCode);
        }, 2000);
      } else {
        gameover.showModal(msg.winner === state.myId, msg.scores, msg.revealShips);
      }
      break;

    case 'RESTART_READY':
      const isTournamentRestart = msg.isTournamentMatch === true;
      const currentMatchId = state.currentMatchId;
      resetGameState();
      if (isTournamentRestart) {
        state.isInTournamentMatch = true;
        state.currentMatchId = currentMatchId;
      }
      gameover.hideModal();
      showScreen('placement');
      placement.initBoard();
      placement.updatePalette();
      break;

    case 'OPPONENT_LEFT':
      alert('对手已离开');
      break;

    case 'TOURNAMENT_CREATED':
      state.tournamentCode = msg.code;
      break;

    case 'TOURNAMENT_STATE':
      state.tournamentName = msg.name;
      state.tournamentCode = msg.code;
      state.tournamentPhase = msg.phase;
      state.tournamentHostId = msg.hostId;
      if (msg.phase === 'lobby') {
        tournamentLobby.showTournamentLobby(msg.name, msg.code, msg.hostId, msg.participants);
      }
      break;

    case 'TOURNAMENT_STARTED':
      state.tournamentPhase = 'running';
      tournamentMain.showTournamentMain(state.tournamentName || '锦标赛', state.tournamentCode);
      tournamentMain.updateSchedule(msg.matches, 1);
      break;

    case 'TOURNAMENT_SCHEDULE_UPDATE':
      tournamentMain.updateSchedule(msg.matches, msg.currentRound);
      break;

    case 'MATCH_ASSIGNED':
      tournamentMain.showMatchAssigned(msg.matchId);
      break;

    case 'MATCH_ENDED':
      tournamentMain.handleMatchEnded(msg.matchId);
      break;

    case 'STANDINGS_UPDATE':
      tournamentMain.updateStandings(msg.standings);
      break;

    case 'ROUND_COMPLETED':
      tournamentMain.showRoundCompleted(msg.nextRound);
      break;

    case 'TOURNAMENT_ENDED':
      state.tournamentPhase = 'ended';
      tournamentMain.showTournamentEnded(msg.rankings);
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
tournamentMenu.init();
tournamentLobby.init();
tournamentMain.init();

// Show lobby by default
showScreen('lobby');

// Connect to WebSocket server
initWebSocket(handleServerMessage);
