import { state, resetTournamentState } from '../state';
import { send } from '../ws';
import { showScreen } from '../utils';

export function init(): void {
  const startBtn = document.getElementById('btn-start-tournament') as HTMLButtonElement;
  const leaveBtn = document.getElementById('btn-leave-tournament-lobby') as HTMLButtonElement;

  startBtn?.addEventListener('click', () => {
    send({ type: 'START_TOURNAMENT' });
  });

  leaveBtn?.addEventListener('click', () => {
    send({ type: 'LEAVE_TOURNAMENT' });
    resetTournamentState();
    showScreen('tournament-menu');
  });
}

export function showTournamentLobby(
  name: string,
  code: string,
  hostId: string,
  participants: { id: string; name: string }[]
): void {
  showScreen('tournament-lobby');

  const nameEl = document.getElementById('tournament-lobby-name');
  const codeEl = document.getElementById('tournament-lobby-code');
  const listEl = document.getElementById('tournament-lobby-players');
  const startBtn = document.getElementById('btn-start-tournament');

  if (nameEl) nameEl.textContent = name;
  if (codeEl) codeEl.textContent = code;

  if (listEl) {
    listEl.innerHTML = '';
    for (const p of participants) {
      const li = document.createElement('li');
      li.textContent = p.name + (p.id === hostId ? ' (房主)' : '');
      listEl.appendChild(li);
    }
  }

  if (startBtn) {
    startBtn.classList.toggle('hidden', state.myId !== hostId);
  }
}
