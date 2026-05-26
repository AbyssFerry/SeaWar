import type { Ship } from '../../src/types';
import * as dom from '../dom';
import { state } from '../state';
import { send, closeConnection } from '../ws';

export function showModal(isWinner: boolean, scores: number[], revealShips: { playerId: string; ships: Ship[] }[] | undefined) {
  dom.scoreDisplay.textContent = `${scores[0]} : ${scores[1]}`;
  dom.modalTitle.textContent = isWinner ? '胜利!' : '失败!';
  dom.modalTitle.className = isWinner ? 'win' : 'lose';
  dom.modalScore.textContent = `${scores[0]} : ${scores[1]}`;
  dom.gameOverModal.classList.remove('hidden');

  if (revealShips) {
    for (const rs of revealShips) {
      const isMyShip = rs.playerId === state.myId;
      const boardCells = isMyShip ? state.myBoardCells : state.enemyBoardCells;
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

export function init() {
  dom.btnModalRestart.addEventListener('click', () => {
    send({ type: 'PLAY_AGAIN' });
  });

  dom.btnModalExit.addEventListener('click', () => {
    send({ type: 'LEAVE_ROOM' });
    closeConnection();
    location.reload();
  });
}

export function hideModal() {
  dom.gameOverModal.classList.add('hidden');
}
