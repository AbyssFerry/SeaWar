import { send } from '../ws';
import * as dom from '../dom';

export function updatePlayerList(players: { id: string; name: string; ready: boolean }[]) {
  dom.playerList.innerHTML = '';
  for (const p of players) {
    const div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = `<span>${p.name}</span><span class="ready-status">${p.ready ? '已准备' : '未准备'}</span>`;
    dom.playerList.appendChild(div);
  }
  dom.roomStatus.textContent = players.length < 2 ? '等待玩家加入...' : '玩家已集齐，准备开始!';
}

export function showRoomCreated(roomId: string) {
  dom.roomIdDisplay.textContent = roomId;
  dom.roomInfo.classList.remove('hidden');
}

let initialized = false;

export function init() {
  if (initialized) return;
  initialized = true;

  dom.btnCreateRoom.addEventListener('click', () => {
    const name = dom.playerNameInput.value.trim();
    if (!name) {
      alert('请输入你的名字');
      return;
    }
    send({ type: 'CREATE_ROOM', playerName: name });
  });

  dom.btnJoinRoom.addEventListener('click', () => {
    const name = dom.playerNameInput.value.trim();
    const rid = dom.roomIdInput.value.trim();
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

  // Tournament buttons
  const btnCreateTournament = document.getElementById('btn-create-tournament') as HTMLButtonElement;
  const btnJoinTournament = document.getElementById('btn-join-tournament') as HTMLButtonElement;
  const codeInput = document.getElementById('tournament-code-input') as HTMLInputElement;
  const modal = document.getElementById('tournament-config-modal') as HTMLDivElement;
  const confirmBtn = document.getElementById('btn-tournament-config-confirm') as HTMLButtonElement;
  const cancelBtn = document.getElementById('btn-tournament-config-cancel') as HTMLButtonElement;
  const nameInput = document.getElementById('tournament-name-input') as HTMLInputElement;
  const gamesSelect = document.getElementById('tournament-games-select') as HTMLSelectElement;

  btnCreateTournament?.addEventListener('click', () => {
    modal?.classList.remove('hidden');
  });

  cancelBtn?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  confirmBtn?.addEventListener('click', () => {
    const name = nameInput?.value.trim() || '我的锦标赛';
    const gamesToWin = parseInt(gamesSelect?.value ?? '3');
    send({ type: 'CREATE_TOURNAMENT', name, gamesToWin });
    modal?.classList.add('hidden');
  });

  btnJoinTournament?.addEventListener('click', () => {
    const code = codeInput?.value.trim() ?? '';
    if (code.length !== 6) {
      alert('请输入6位房间码');
      return;
    }
    const playerName = dom.playerNameInput.value.trim() || 'Player';
    send({ type: 'JOIN_TOURNAMENT', code, playerName });
  });
}
