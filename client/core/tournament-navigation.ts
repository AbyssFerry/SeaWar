type TournamentNavigationState = {
  currentMatchId: string;
  currentPhase: string;
};

export function shouldReturnToTournamentMainAfterMatch(
  completedMatchId: string,
  state: TournamentNavigationState
): boolean {
  return state.currentPhase === 'battle' && state.currentMatchId === completedMatchId;
}
