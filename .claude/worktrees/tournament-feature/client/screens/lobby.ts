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

export function init() {
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
}
