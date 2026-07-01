import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

export interface FriendUserSummary {
  id: number;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  verified: boolean;
  profilePictureUpdatedAt?: string | null;
}

export type FriendRelationshipStatus = 'NONE' | 'OUTGOING_PENDING' | 'INCOMING_PENDING' | 'FRIEND';

export interface FriendSearchResult {
  user: FriendUserSummary;
  relationshipStatus: FriendRelationshipStatus;
}

export interface FriendRequestItem {
  id: number;
  sender: FriendUserSummary;
  createdAt: string;
}

export interface FriendItem {
  id: number;
  user: FriendUserSummary;
  connectedAt: string;
}

export interface SendFriendRequest {
  receiverId: number;
}

export interface MessageResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class FriendCommunityService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = '/api/friends';

  searchUsers(query: string): Observable<FriendSearchResult[]> {
    return this.http.get<FriendSearchResult[]>(`${this.apiUrl}/users`, {
      headers: this.authHeaders(),
      params: { query }
    });
  }

  sendFriendRequest(request: SendFriendRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/requests`, request, {
      headers: this.authHeaders()
    });
  }

  listIncomingRequests(): Observable<FriendRequestItem[]> {
    return this.http.get<FriendRequestItem[]>(`${this.apiUrl}/requests/incoming`, {
      headers: this.authHeaders()
    });
  }

  acceptFriendRequest(requestId: number): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/requests/${requestId}/accept`, null, {
      headers: this.authHeaders()
    });
  }

  declineFriendRequest(requestId: number): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/requests/${requestId}/decline`, null, {
      headers: this.authHeaders()
    });
  }

  listFriends(): Observable<FriendItem[]> {
    return this.http.get<FriendItem[]>(this.apiUrl, {
      headers: this.authHeaders()
    });
  }

  deleteFriend(friendId: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/${friendId}`, {
      headers: this.authHeaders()
    });
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders(this.authService.authHeader());
  }
}
