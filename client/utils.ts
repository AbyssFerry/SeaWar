import { screens } from './dom';
import { state } from './state';

export function showToast(message: string, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

export function showScreen(
  name: 'lobby' | 'placement' | 'battle' | 'tournament-menu' | 'tournament-lobby' | 'tournament-main'
) {
  state.currentPhase = name;
  Object.values(screens).forEach((s) => s?.classList.add('hidden'));

  const keyMap: Record<typeof name, keyof typeof screens> = {
    'lobby': 'lobby',
    'placement': 'placement',
    'battle': 'battle',
    'tournament-menu': 'tournamentMenu',
    'tournament-lobby': 'tournamentLobby',
    'tournament-main': 'tournamentMain',
  };

  const screen = screens[keyMap[name]];
  if (!screen) {
    console.error(`Unknown screen: ${name}`);
    return;
  }
  screen.classList.remove('hidden');
}
