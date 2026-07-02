import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from './auth';
import { FriendCommunityService } from './friend-community.service';
import { FriendNotificationService } from './friend-notification.service';
import { TripPlanningService } from './trip-planning.service';

describe('FriendNotificationService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const authService = {
    email: () => 'traveler@example.com',
  };

  it('syncs incoming friend requests into notifications', () => {
    const friendRequests = [
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
    ];
    const friendCommunityService = {
      listIncomingRequests: () => of(friendRequests),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([]),
    };

    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    service.refresh();

    expect(service.items().length).toBe(1);
    expect(service.items()[0].description).toContain('Ada Lovelace sent you a friend request.');
    expect(service.unreadCount()).toBe(1);

    friendRequests.splice(0, friendRequests.length);
    service.refresh();

    expect(service.items().length).toBe(1);
    expect(service.items()[0].title).toBe('New friend request');

    service.markAllAsRead();
    expect(service.unreadCount()).toBe(0);
  });

  it('syncs incoming trip invitations into notifications', () => {
    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([
        {
          id: 44,
          trip: {
            id: 20,
            name: 'Shared Rome',
            destination: 'Rome',
            startDate: '2026-07-14',
            endDate: '2026-07-21',
            budget: 2000,
            status: 'UPCOMING',
          },
          invitedBy: {
            id: 7,
            username: 'owner',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'owner@example.com',
            verified: true,
            profilePictureUpdatedAt: null,
          },
          invitedUser: {
            id: 2,
            username: 'friend',
            firstName: 'Grace',
            lastName: 'Hopper',
            email: 'friend@example.com',
            verified: true,
            profilePictureUpdatedAt: null,
          },
          status: 'PENDING',
          createdAt: '2026-07-01T10:15:30',
        },
      ]),
      listSentTripInvitations: () => of([]),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    service.refresh();

    expect(service.items().length).toBe(1);
    expect(service.items()[0].title).toBe('Trip invitation');
    expect(service.items()[0].description).toContain('Ada Lovelace invited you to Shared Rome.');
    expect(service.items()[0].details).toContain('Rome');
    expect(service.items()[0].details).toContain('€2,000');
    expect(service.unreadCount()).toBe(1);
  });

  it('syncs incoming trip invitation responses for the inviter', () => {
    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([
        {
          id: 55,
          trip: {
            id: 20,
            name: 'Shared Rome',
            destination: 'Rome',
            startDate: '2026-07-14',
            endDate: '2026-07-21',
            budget: 2000,
            status: 'UPCOMING',
          },
          invitedBy: {
            id: 7,
            username: 'owner',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'owner@example.com',
            verified: true,
            profilePictureUpdatedAt: null,
          },
          invitedUser: {
            id: 2,
            username: 'friend',
            firstName: 'Grace',
            lastName: 'Hopper',
            email: 'friend@example.com',
            verified: true,
            profilePictureUpdatedAt: null,
          },
          status: 'ACCEPTED',
          createdAt: '2026-07-01T10:15:30',
        },
      ]),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    service.refresh();

    expect(service.items().length).toBe(1);
    expect(service.items()[0].title).toBe('Trip invite accepted');
    expect(service.items()[0].description).toContain('Grace Hopper accepted your invitation to Shared Rome.');
  });

  it('syncs declined trip invitation responses for the inviter', () => {
    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([
        {
          id: 56,
          trip: {
            id: 20,
            name: 'Shared Rome',
            destination: 'Rome',
            startDate: '2026-07-14',
            endDate: '2026-07-21',
            budget: 2000,
            status: 'UPCOMING',
          },
          invitedBy: {
            id: 7,
            username: 'owner',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'owner@example.com',
            verified: true,
            profilePictureUpdatedAt: null,
          },
          invitedUser: {
            id: 2,
            username: 'friend',
            firstName: 'Grace',
            lastName: 'Hopper',
            email: 'friend@example.com',
            verified: true,
            profilePictureUpdatedAt: null,
          },
          status: 'DECLINED',
          createdAt: '2026-07-01T10:15:30',
        },
      ]),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    service.refresh();

    expect(service.items().length).toBe(1);
    expect(service.items()[0].title).toBe('Trip invite declined');
    expect(service.items()[0].description).toContain('Grace Hopper declined your invitation to Shared Rome.');
  });

  it('dismisses trip invitations only for the current user', () => {
    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([
        {
          id: 44,
          trip: {
            id: 20,
            name: 'Shared Rome',
            destination: 'Rome',
            startDate: '2026-07-14',
            endDate: '2026-07-21',
            budget: 2000,
            status: 'UPCOMING',
          },
          invitedBy: {
            id: 7,
            username: 'owner',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'owner@example.com',
            verified: true,
            profilePictureUpdatedAt: null,
          },
          invitedUser: {
            id: 2,
            username: 'friend',
            firstName: 'Grace',
            lastName: 'Hopper',
            email: 'friend@example.com',
            verified: true,
            profilePictureUpdatedAt: null,
          },
          status: 'PENDING',
          createdAt: '2026-07-01T10:15:30',
        },
      ]),
      listSentTripInvitations: () => of([]),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    service.refresh();
    expect(service.items().length).toBe(1);

    service.dismissTripInvitation(44);
    expect(service.items().length).toBe(0);

    service.refresh();
    expect(service.items().length).toBe(0);
  });
});
