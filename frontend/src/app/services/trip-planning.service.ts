import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth';
import { FriendUserSummary } from './friend-community.service';

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
  selectedHotelStaysJson?: string;
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
  selectedHotelStaysJson?: string | null;
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
  flightSegmentsJson?: string;
  hotelName?: string;
  hotelCity?: string;
  hotelStars?: number | null;
  hotelDetails?: string;
  hotelTotal?: number;
  hotelStaysJson?: string;
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
  flightSegmentsJson?: string | null;
  hotelName?: string | null;
  hotelCity?: string | null;
  hotelStars?: number | null;
  hotelDetails?: string | null;
  hotelTotal?: number | null;
  hotelStaysJson?: string | null;
  activitiesTitle?: string | null;
  activitiesDetails?: string | null;
  activitiesJson?: string | null;
  activitiesTotal?: number | null;
  accessRole?: 'OWNER' | 'PARTICIPANT' | null;
}

export interface InviteTripFriendRequest {
  invitedUserId: number;
}

export interface MessageResponse {
  message: string;
}

export interface TripInvitationTripSummaryResponse {
  id: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: TripStatus;
}

export interface TripInvitationResponse {
  id: number;
  trip: TripInvitationTripSummaryResponse;
  invitedBy: FriendUserSummary;
  invitedUser: FriendUserSummary;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

export interface TripParticipantResponse {
  user: FriendUserSummary;
  role: 'OWNER' | 'PARTICIPANT';
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

  inviteFriendToTrip(tripId: number, request: InviteTripFriendRequest): Observable<TripInvitationResponse> {
    return this.http.post<TripInvitationResponse>(`${this.tripsUrl}/${tripId}/invitations`, request, {
      headers: this.authService.authHeader(),
    });
  }

  listIncomingTripInvitations(): Observable<TripInvitationResponse[]> {
    return this.http.get<TripInvitationResponse[]>(`${this.tripsUrl}/invitations/incoming`, {
      headers: this.authService.authHeader(),
    });
  }

  listSentTripInvitations(): Observable<TripInvitationResponse[]> {
    return this.http.get<TripInvitationResponse[]>(`${this.tripsUrl}/invitations/sent`, {
      headers: this.authService.authHeader(),
    });
  }

  listTripParticipants(tripId: number): Observable<TripParticipantResponse[]> {
    return this.http.get<TripParticipantResponse[]>(`${this.tripsUrl}/${tripId}/participants`, {
      headers: this.authService.authHeader(),
    });
  }

  acceptTripInvitation(invitationId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.tripsUrl}/invitations/${invitationId}/accept`, null, {
      headers: this.authService.authHeader(),
    });
  }

  declineTripInvitation(invitationId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.tripsUrl}/invitations/${invitationId}/decline`, null, {
      headers: this.authService.authHeader(),
    });
  }

  cancelTripInvitation(invitationId: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.tripsUrl}/invitations/${invitationId}`, {
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

  leaveTrip(tripId: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.tripsUrl}/${tripId}/leave`, {
      headers: this.authService.authHeader(),
    });
  }
}
