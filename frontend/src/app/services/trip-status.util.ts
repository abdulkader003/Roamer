import { TripResponse } from './trip-planning.service';

export function isTripCompleted(trip: Pick<TripResponse, 'endDate'>, today = new Date()): boolean {
  const endDate = parseTripDate(trip.endDate);
  const localToday = startOfDay(today);

  return endDate !== null && endDate < localToday;
}

export function isTripUpcomingOrActive(trip: Pick<TripResponse, 'startDate' | 'endDate' | 'status'>, today = new Date()): boolean {
  if (isTripCompleted(trip, today)) {
    return false;
  }

  const startDate = parseTripDate(trip.startDate);
  const localToday = startOfDay(today);

  return trip.status === 'UPCOMING' || (startDate !== null && startDate >= localToday);
}

export function tripStatusLabel(trip: Pick<TripResponse, 'endDate' | 'status'>): 'Confirmed' | 'Draft' | 'Completed' {
  if (isTripCompleted(trip)) {
    return 'Completed';
  }

  return trip.status === 'UPCOMING' ? 'Confirmed' : 'Draft';
}

export function tripStatusKind(trip: Pick<TripResponse, 'endDate' | 'status'>): 'upcoming' | 'draft' | 'completed' {
  if (isTripCompleted(trip)) {
    return 'completed';
  }

  return trip.status === 'UPCOMING' ? 'upcoming' : 'draft';
}

function parseTripDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}
