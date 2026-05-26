import { describe, expect, it } from 'bun:test';
import { shouldReturnToTournamentMainAfterMatch } from './tournament-navigation';

describe('tournament navigation', () => {
  it('does not let a completed match timeout override a newly entered match', () => {
    expect(
      shouldReturnToTournamentMainAfterMatch('match-1', {
        currentMatchId: 'match-2',
        currentPhase: 'placement',
      })
    ).toBe(false);
  });

  it('returns to the tournament main screen when still viewing the completed match', () => {
    expect(
      shouldReturnToTournamentMainAfterMatch('match-1', {
        currentMatchId: 'match-1',
        currentPhase: 'battle',
      })
    ).toBe(true);
  });
});
