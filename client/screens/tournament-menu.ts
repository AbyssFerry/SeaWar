import { showScreen } from '../utils';

export function init(): void {
  // Tournament menu screen is no longer the default entry point.
  // Create/join handlers moved to lobby.ts.
}

export function show(): void {
  showScreen('tournament-menu');
}
