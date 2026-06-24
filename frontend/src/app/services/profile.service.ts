import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  passportNumber?: string | null;
  travelAchievements?: string[] | null;
  homeAirport?: string | null;
  verified: boolean;
  hasProfilePicture: boolean;
  profilePictureUpdatedAt?: string | null;
}

export interface UpdateProfileRequest {
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  passportNumber?: string;
  travelAchievements: string[];
  homeAirport: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface DeleteAccountRequest {
  currentPassword: string;
}

export interface MessageResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = '/api/profile';

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiUrl, {
      headers: this.authHeaders()
    });
  }

  updateProfile(request: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.apiUrl, request, {
      headers: this.authHeaders()
    });
  }

  uploadProfilePicture(file: File): Observable<UserProfile> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<UserProfile>(`${this.apiUrl}/picture`, formData, {
      headers: this.authHeaders()
    });
  }

  // The binary picture is loaded separately so normal profile data stays small and fast.
  getProfilePicture(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/picture`, {
      headers: this.authHeaders(),
      responseType: 'blob'
    });
  }

  deleteProfilePicture(): Observable<UserProfile> {
    return this.http.delete<UserProfile>(`${this.apiUrl}/picture`, {
      headers: this.authHeaders()
    });
  }

  changePassword(request: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.apiUrl}/password`, request, {
      headers: this.authHeaders()
    });
  }

  deleteAccount(request: DeleteAccountRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/delete-account`, request, {
      headers: this.authHeaders()
    });
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders(this.authService.authHeader());
  }
}
