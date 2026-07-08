import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { FriendCommunityService, SendFriendRequest } from './friend-community.service';

describe('FriendCommunityService', () => {
  let service: FriendCommunityService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FriendCommunityService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { authHeader: () => ({ Authorization: 'Bearer test-token' }) },
        },
      ],
    });

    service = TestBed.inject(FriendCommunityService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('searches users with the existing JWT header', () => {
    service.searchUsers('ada').subscribe((results) => {
      expect(results[0].user.username).toBe('traveler');
    });

    const request = httpTesting.expectOne('/api/friends/users?query=ada');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([
      {
        user: {
          id: 2,
          username: 'traveler',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'traveler@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        relationshipStatus: 'NONE',
      },
    ]);
  });

  it('sends a friend request with the existing JWT header', () => {
    const requestBody: SendFriendRequest = { receiverId: 2 };

    service.sendFriendRequest(requestBody).subscribe((response) => {
      expect(response.message).toBe('Friend request sent.');
    });

    const request = httpTesting.expectOne('/api/friends/requests');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ message: 'Friend request sent.' });
  });

  it('loads incoming requests with the existing JWT header', () => {
    service.listIncomingRequests().subscribe((results) => {
      expect(results[0].sender.username).toBe('friend');
    });

    const request = httpTesting.expectOne('/api/friends/requests/incoming');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([
      {
        id: 15,
        sender: {
          id: 2,
          username: 'friend',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'friend@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        createdAt: '2026-07-01T10:15:30',
      },
    ]);
  });

  it('accepts requests with the existing JWT header', () => {
    service.acceptFriendRequest(15).subscribe((response) => {
      expect(response.message).toBe('Friend request accepted.');
    });

    const request = httpTesting.expectOne('/api/friends/requests/15/accept');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ message: 'Friend request accepted.' });
  });

  it('loads friends with the existing JWT header', () => {
    service.listFriends().subscribe((results) => {
      expect(results[0].user.username).toBe('friend');
    });

    const request = httpTesting.expectOne('/api/friends');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([
      {
        id: 15,
        user: {
          id: 2,
          username: 'friend',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'friend@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        connectedAt: '2026-07-01T10:15:30',
      },
    ]);
  });

  it('deletes friends with the existing JWT header', () => {
    service.deleteFriend(7).subscribe((response) => {
      expect(response.message).toBe('Friend removed.');
    });

    const request = httpTesting.expectOne('/api/friends/7');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ message: 'Friend removed.' });
  });
});
