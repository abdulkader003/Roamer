import { Injectable } from '@angular/core';

/**
 * Temporary storage for the create-trip wizard.
 *
 * Budget, destination, and later steps live on different routes, so this service
 * keeps the unfinished trip values available while the user moves between pages.
 */
export interface TripTemp {
  tripName: string;
  budget: number | null;
  currency: string;
  durationNights: number;
  travelStyle: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  travelers: number;
  selectedFlightId: string;
  selectedFlightTotal: number | null;
}

const EMPTY_TRIP_TEMP: TripTemp = {
  tripName: '',
  budget: null,
  currency: 'EUR',
  durationNights: 7,
  travelStyle: 'Mid-range',
  origin: '',
  destination: '',
  departureDate: '',
  returnDate: '',
  travelers: 2,
  selectedFlightId: '',
  selectedFlightTotal: null,
};

@Injectable({
  providedIn: 'root',
})
export class TripTempService {
  private readonly storageKey = 'roamer.create-trip-temp';

  getTripTemp(): TripTemp {
    if (typeof window === 'undefined') {
      return { ...EMPTY_TRIP_TEMP };
    }

    const storedTripTemp = window.sessionStorage.getItem(this.storageKey);

    if (!storedTripTemp) {
      return { ...EMPTY_TRIP_TEMP };
    }

    try {
      return {
        ...EMPTY_TRIP_TEMP,
        ...JSON.parse(storedTripTemp) as Partial<TripTemp>,
      };
    } catch {
      return { ...EMPTY_TRIP_TEMP };
    }
  }

  updateTripTemp(changes: Partial<TripTemp>): TripTemp {
    const nextTripTemp = {
      ...this.getTripTemp(),
      ...changes,
    };

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(this.storageKey, JSON.stringify(nextTripTemp));
    }

    return nextTripTemp;
  }
}
