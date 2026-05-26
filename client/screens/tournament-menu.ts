import { send } from '../ws';
import { showScreen } from '../utils';

export function init(): void {
  const normalBtn = document.getElementById('btn-normal-game') as HTMLButtonElement;
  const createBtn = document.getElementById('btn-create-tournament') as HTMLButtonElement;
  const joinBtn = document.getElementById('btn-join-tournament') as HTMLButtonElement;
  const codeInput = document.getElementById('tournament-code-input') as HTMLInputElement;

  normalBtn?.addEventListener('click', () => {
    showScreen('lobby');
  });

  createBtn?.addEventListener('click', () => {
    const name = prompt('锦标赛名称:', '我的锦标赛') || '我的锦标赛';
    const gamesStr = prompt('每轮几局决胜负? (1/2/3)', '1') || '1';
    const gamesToWin = parseInt(gamesStr);
    if (gamesToWin < 1 || gamesToWin > 3) {
      alert('请输入 1, 2 或 3');
      return;
    }
    send({ type: 'CREATE_TOURNAMENT', name, gamesToWin });
  });

  joinBtn?.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (code.length !== 6) {
      alert('请输入6位房间码');
      return;
    }
    const playerName = prompt('你的名字:', 'Player') || 'Player';
    send({ type: 'JOIN_TOURNAMENT', code, playerName });
  });
}

export function show(): void {
  showScreen('tournament-menu');
}
