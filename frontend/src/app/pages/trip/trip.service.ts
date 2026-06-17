import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../../services/auth';

export type TripStatus = 'PLANNING' | 'UPCOMING';

export interface Trip {
  id: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: TripStatus;
  createdAt: string;
}

export interface CreateTripRequest {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: TripStatus;
}

/**
 * Small HTTP boundary for the authenticated Trips API.
 *
 * Keeping request construction here leaves the page component responsible only
 * for view state and form behavior.
 */
@Injectable({
  providedIn: 'root',
})
export class TripService {
  private readonly apiUrl = '/api/trips';

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  /** Loads trips belonging to the account represented by the current JWT. */
  getTrips(): Observable<Trip[]> {
    return this.http.get<Trip[]>(this.apiUrl, {
      headers: this.authService.authHeader(),
    });
  }

  /** Persists one trip and returns the server-generated id and creation time. */
  createTrip(request: CreateTripRequest): Observable<Trip> {
    return this.http.post<Trip>(this.apiUrl, request, {
      headers: this.authService.authHeader(),
    });
  }
}
