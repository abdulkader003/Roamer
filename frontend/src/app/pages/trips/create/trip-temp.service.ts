import { Injectable } from '@angular/core';

/**
 * Temporary storage for the create-trip wizard.
 *
 * Budget, destination, and later steps live on different routes, so this service
 * keeps the unfinished trip values available while the user moves between pages.
 */
export interface TripTemp {
  tripPlanningId?: number | null;
  draftTripId?: number | null;
  tripName: string;
  budget: number | null;
  currency: string;
  durationNights: number;
  travelStyle: string;
  origin: string;
  destination: string;
  destinationCities: string[];
  departureDate: string;
  returnDate: string;
  travelers: number;
  selectedFlightId: string;
  selectedFlightAirline: string;
  selectedFlightNumber: string;
  selectedFlightDepartureTime: string;
  selectedFlightArrivalTime: string;
  selectedFlightDuration: string;
  selectedFlightStops: string;
  selectedFlightTotal: number | null;
  selectedHotelName: string;
  selectedHotelCity: string;
  selectedHotelStars: number | null;
  selectedHotelTotal: number | null;
  selectedActivities: TripTempActivity[];
  selectedActivitiesTotal: number;
}

export interface TripTempActivity {
  name: string;
  category: string;
  price: number;
  duration: string;
  city: string;
}

const EMPTY_TRIP_TEMP: TripTemp = {
  tripPlanningId: null,
  draftTripId: null,
  tripName: '',
  budget: null,
  currency: 'EUR',
  durationNights: 0,
  travelStyle: 'Mid-range',
  origin: '',
  destination: '',
  destinationCities: [],
  departureDate: '',
  returnDate: '',
  travelers: 2,
  selectedFlightId: '',
  selectedFlightAirline: '',
  selectedFlightNumber: '',
  selectedFlightDepartureTime: '',
  selectedFlightArrivalTime: '',
  selectedFlightDuration: '',
  selectedFlightStops: '',
  selectedFlightTotal: null,
  selectedHotelName: '',
  selectedHotelCity: '',
  selectedHotelStars: null,
  selectedHotelTotal: null,
  selectedActivities: [],
  selectedActivitiesTotal: 0,
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

  clearTripTemp(): TripTemp {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(this.storageKey);
    }

    return { ...EMPTY_TRIP_TEMP };
  }
}
