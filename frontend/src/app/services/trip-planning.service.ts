import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth';

export interface CreateTripBudgetRequest {
  tripName: string;
  budget: number;
  currency: string;
  duration: number;
  travelStyle: string;
}

export interface TripBudgetResponse {
  id: number;
  tripName: string;
  budget: number;
  currency: string;
  duration: number;
  travelStyle: string;
}

export interface SelectTripHotelRequest {
  hotelId: number;
}

export interface TripHotelResponse {
  tripPlanningId: number;
  hotelId: number;
  hotelName: string;
  hotelCity: string;
  pricePerNight: number;
  stars: number;
  ratingScore: number;
  ratingLabel: string;
}

export interface SelectedTripActivity {
  name: string;
  category: string;
  price: number;
  duration: string;
  city: string;
}

export interface SelectTripActivitiesRequest {
  activities: SelectedTripActivity[];
}

export interface TripActivitiesResponse {
  tripPlanningId: number;
  selectedActivities: SelectedTripActivity[];
  totalActivitiesCost: number;
  selectedActivitiesCount: number;
}

export interface TripOverviewResponse {
  id: number;
  tripName: string;
  budget: number;
  currency: string;
  duration: number;
  travelStyle: string;
  selectedHotel: TripHotelResponse | null;
  selectedActivities: SelectedTripActivity[];
  totalActivitiesCost: number;
}

export type TripStatus = 'PLANNING' | 'UPCOMING';

export interface CreateTripRequest {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: TripStatus;
  tripPlanningId?: number | null;
  origin?: string;
  destinationCities?: string;
  currency?: string;
  durationNights?: number;
  travelStyle?: string;
  travelers?: number;
  flightId?: string;
  flightTitle?: string;
  flightAirline?: string;
  flightNumber?: string;
  flightDepartureTime?: string;
  flightArrivalTime?: string;
  flightDuration?: string;
  flightStops?: string;
  flightDetails?: string;
  flightTotal?: number;
  hotelName?: string;
  hotelCity?: string;
  hotelStars?: number | null;
  hotelDetails?: string;
  hotelTotal?: number;
  activitiesTitle?: string;
  activitiesDetails?: string;
  activitiesJson?: string;
  activitiesTotal?: number;
}

export interface TripResponse {
  id: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: TripStatus;
  createdAt: string;
  tripPlanningId?: number | null;
  origin?: string | null;
  destinationCities?: string | null;
  currency?: string | null;
  durationNights?: number | null;
  travelStyle?: string | null;
  travelers?: number | null;
  flightId?: string | null;
  flightTitle?: string | null;
  flightAirline?: string | null;
  flightNumber?: string | null;
  flightDepartureTime?: string | null;
  flightArrivalTime?: string | null;
  flightDuration?: string | null;
  flightStops?: string | null;
  flightDetails?: string | null;
  flightTotal?: number | null;
  hotelName?: string | null;
  hotelCity?: string | null;
  hotelStars?: number | null;
  hotelDetails?: string | null;
  hotelTotal?: number | null;
  activitiesTitle?: string | null;
  activitiesDetails?: string | null;
  activitiesJson?: string | null;
  activitiesTotal?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class TripPlanningService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = '/api/trip-planning';
  private readonly tripsUrl = '/api/trips';

  saveBudgetStep(request: CreateTripBudgetRequest): Observable<TripBudgetResponse> {
    // Uses the existing JWT header pattern because no auth interceptor exists.
    return this.http.post<TripBudgetResponse>(`${this.apiUrl}/budget`, request, {
      headers: this.authService.authHeader(),
    });
  }

  saveHotelStep(tripPlanningId: number, request: SelectTripHotelRequest): Observable<TripHotelResponse> {
    return this.http.post<TripHotelResponse>(`${this.apiUrl}/${tripPlanningId}/hotel`, request, {
      headers: this.authService.authHeader(),
    });
  }

  saveActivitiesStep(
    tripPlanningId: number,
    request: SelectTripActivitiesRequest,
  ): Observable<TripActivitiesResponse> {
    return this.http.post<TripActivitiesResponse>(`${this.apiUrl}/${tripPlanningId}/activities`, request, {
      headers: this.authService.authHeader(),
    });
  }

  listTrips(): Observable<TripBudgetResponse[]> {
    return this.http.get<TripBudgetResponse[]>(this.apiUrl, {
      headers: this.authService.authHeader(),
    });
  }

  getOverview(tripPlanningId: number): Observable<TripOverviewResponse> {
    return this.http.get<TripOverviewResponse>(`${this.apiUrl}/${tripPlanningId}/overview`, {
      headers: this.authService.authHeader(),
    });
  }

  createTrip(request: CreateTripRequest): Observable<TripResponse> {
    return this.http.post<TripResponse>(this.tripsUrl, request, {
      headers: this.authService.authHeader(),
    });
  }

  listSavedTrips(): Observable<TripResponse[]> {
    return this.http.get<TripResponse[]>(this.tripsUrl, {
      headers: this.authService.authHeader(),
    });
  }

  updateTrip(tripId: number, request: CreateTripRequest): Observable<TripResponse> {
    return this.http.put<TripResponse>(`${this.tripsUrl}/${tripId}`, request, {
      headers: this.authService.authHeader(),
    });
  }

  deleteTrip(tripId: number): Observable<void> {
    return this.http.delete(`${this.tripsUrl}/${tripId}`, {
      headers: this.authService.authHeader(),
      responseType: 'text',
    }).pipe(map(() => undefined));
  }
}
