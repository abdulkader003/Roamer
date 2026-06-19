import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root',
})
export class TripPlanningService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = '/api/trip-planning';

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
  }

