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
}
