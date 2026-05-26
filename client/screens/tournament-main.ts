import { state } from '../state';
import { send } from '../ws';
import { showScreen } from '../utils';

let currentMatches: any[] = [];
let currentRound = 1;

export function init(): void {
  // No persistent event listeners needed
}

export function showTournamentMain(name: string, code: string): void {
  showScreen('tournament-main');

  const nameEl = document.getElementById('tournament-main-name');
  const codeEl = document.getElementById('tournament-main-code');

  if (nameEl) nameEl.textContent = name;
  if (codeEl) codeEl.textContent = code;
}

export function updateStandings(
  standings: { participantId: string; name: string; score: number; matchesPlayed: number }[]
): void {
  const tbody = document.querySelector('#standings-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  standings.forEach((s, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${index + 1}</td><td>${s.name}</td><td>${s.score}</td><td>${s.matchesPlayed}</td>`;
    tbody.appendChild(tr);
  });
}

export function updateSchedule(matches: any[], round: number): void {
  currentMatches = matches;
  currentRound = round;

  const roundEl = document.getElementById('tournament-current-round');
  if (roundEl) roundEl.textContent = String(round);

  const listEl = document.getElementById('schedule-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  for (const match of matches) {
    const div = document.createElement('div');
    div.className = `match-card ${match.status}`;

    const isMyMatch = match.participantA === state.myId || match.participantB === state.myId;
    const canSpectate = match.status === 'ongoing' && !isMyMatch;

    let html = `<div class="match-players">${match.participantAName || '???'} vs ${match.participantBName || '???'}</div>`;
    html += `<div class="match-status">${getStatusText(match)}</div>`;

    if (match.status === 'completed') {
      html += `<div class="match-result">${match.winsA} - ${match.winsB}</div>`;
    }

    if (canSpectate) {
      html += `<button class="btn-spectate" data-match-id="${match.id}">观战</button>`;
    }

    div.innerHTML = html;
    listEl.appendChild(div);
  }

  // Bind spectate buttons
  listEl.querySelectorAll('.btn-spectate').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const matchId = (e.target as HTMLElement).dataset.matchId;
      if (matchId) {
        send({ type: 'SPECTATE_MATCH', matchId });
        state.isSpectating = true;
        state.currentMatchId = matchId;
      }
    });
  });
}

function getStatusText(match: any): string {
  if (match.status === 'pending') return '未开始';
  if (match.status === 'ongoing') return '进行中';
  if (match.status === 'completed') return '已结束';
  return match.status;
}

export function showMatchAssigned(matchId: string): void {
  state.isInTournamentMatch = true;
  state.currentMatchId = matchId;
  state.isSpectating = false;

  const statusText = document.getElementById('tournament-status-text');
  if (statusText) statusText.textContent = '你已分配到对战，正在进入...';

  send({ type: 'ENTER_MATCH', matchId });
}

export function showForceEnterMatch(matchId: string): void {
  if (state.isSpectating) {
    send({ type: 'STOP_SPECTATING' });
  }
  showMatchAssigned(matchId);
}

export function handleMatchEnded(matchId: string): void {
  state.isInTournamentMatch = false;
  state.currentMatchId = '';
  state.isSpectating = false;

  const statusText = document.getElementById('tournament-status-text');
  if (statusText) statusText.textContent = '对战结束，等待下一轮...';
}

export function showRoundCompleted(nextRound: number): void {
  const statusText = document.getElementById('tournament-status-text');
  if (statusText) statusText.textContent = `第 ${nextRound} 轮即将开始`;
}

export function showTournamentEnded(
  rankings: { rank: number; name: string; score: number }[]
): void {
  const statusText = document.getElementById('tournament-status-text');
  if (statusText) {
    let html = '<h3>锦标赛结束！</h3><ol>';
    for (const r of rankings) {
      html += `<li>${r.name} - ${r.score} 分</li>`;
    }
    html += '</ol>';
    statusText.innerHTML = html;
  }
}
