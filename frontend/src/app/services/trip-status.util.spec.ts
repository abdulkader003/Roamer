import { isTripCompleted, isTripUpcomingOrActive, tripStatusLabel } from './trip-status.util';

describe('trip status helpers', () => {
  const today = new Date(2026, 6, 15);

  it('marks past trips completed', () => {
    const trip = { startDate: '2026-07-01', endDate: '2026-07-14', status: 'UPCOMING' as const };

    expect(isTripCompleted(trip, today)).toBeTrue();
    expect(isTripUpcomingOrActive(trip, today)).toBeFalse();
    expect(tripStatusLabel(trip)).toBe('Completed');
  });

  it('does not mark trips ending today completed', () => {
    const trip = { startDate: '2026-07-10', endDate: '2026-07-15', status: 'UPCOMING' as const };

    expect(isTripCompleted(trip, today)).toBeFalse();
    expect(isTripUpcomingOrActive(trip, today)).toBeTrue();
  });

  it('keeps future trips upcoming', () => {
    const trip = { startDate: '2026-07-20', endDate: '2026-07-25', status: 'UPCOMING' as const };

    expect(isTripCompleted(trip, today)).toBeFalse();
    expect(isTripUpcomingOrActive(trip, today)).toBeTrue();
  });
});
