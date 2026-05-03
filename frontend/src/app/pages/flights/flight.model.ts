// flights/flight.model.ts

export type TripType = 'one-way' | 'round-trip' | 'multi-city';
export type CabinClass = 'economy' | 'premium' | 'business' | 'first';
export type SortMode = 'best' | 'cheapest' | 'fastest';
export type BadgeType = 'cheapest' | 'fastest' | 'recommended';
export type DepartureWindow = 'early' | 'morning' | 'afternoon' | 'evening';

export interface Airport {
  code: string;       // 'DUS'
  city: string;       // 'Düsseldorf'
  fullName: string;   // 'Düsseldorf Intl.'
}

export interface Airline {
  code: string;       // 'LH'
  name: string;       // 'Lufthansa'
  colorClass: string; // 'lh' — used for logo gradient
}

export interface FlightEndpoint {
  time: string;       // '07:25'
  airport: string;    // 'DUS'
  city: string;       // 'Düsseldorf'
}

export interface Flight {
  id: string;
  airline: Airline;
  departure: FlightEndpoint;
  arrival: FlightEndpoint;
  duration: string;     // '1h 35m'
  stops: number;        // 0 for direct
  stopDetails?: string; // '1 stop · AMS · 1h 10m layover'
  price: number;        // 132
  currency: string;     // 'EUR'
  badge?: { type: BadgeType; label: string };
}

export interface SearchParams {
  tripType: TripType;
  from: Airport;
  to: Airport;
  departureDate: Date | null;
  returnDate: Date | null;
  travelers: number;
  cabinClass: CabinClass;
}

export interface FlightFilters {
  priceMin: number;
  priceMax: number;
  stops: { direct: boolean; oneStop: boolean; twoPlus: boolean };
  airlines: Record<string, boolean>; // keyed by airline code
  departureWindows: Record<DepartureWindow, boolean>;
  carryOnIncluded: boolean;
  checkedBagIncluded: boolean;
}
