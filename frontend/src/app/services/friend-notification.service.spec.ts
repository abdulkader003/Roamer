import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { AuthService } from './auth';
import { FriendCommunityService } from './friend-community.service';
import { FriendNotificationService } from './friend-notification.service';
import { RealtimeWebSocketService } from './realtime-websocket.service';
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

  it('keeps notifications read after a refresh', () => {
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
    expect(service.unreadCount()).toBe(1);

    service.markAllAsRead();
    expect(service.unreadCount()).toBe(0);

    service.refresh();
    expect(service.items().length).toBe(1);
    expect(service.unreadCount()).toBe(0);
  });

  it('keeps friend requests unread state across a full reload', () => {
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

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    });

    const firstService = TestBed.inject(FriendNotificationService);

    firstService.refresh();
    firstService.markAllAsRead();
    expect(firstService.unreadCount()).toBe(0);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    });

    const reloadedService = TestBed.inject(FriendNotificationService);

    reloadedService.refresh();

    expect(reloadedService.items().length).toBe(1);
    expect(reloadedService.unreadCount()).toBe(0);
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

  it('ingests realtime trip invitation notifications', () => {
    const realtimeMessages = new Subject<{
      eventType: string;
      notificationType: 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE';
      notificationId: number;
      title: string;
      description: string;
      details?: string | null;
      createdAt: string;
    }>();

    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([]),
    };

    const realtimeWebSocketService = {
      observe: () => realtimeMessages.asObservable(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: RealtimeWebSocketService, useValue: realtimeWebSocketService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    realtimeMessages.next({
      eventType: 'TRIP_INVITATION_CREATED',
      notificationType: 'TRIP_INVITATION',
      notificationId: 44,
      title: 'Trip invitation',
      description: 'Ada Lovelace invited you to Shared Rome.',
      details: 'Rome · 14 Jul 2026 → 21 Jul 2026 · €2,000',
      createdAt: '2026-07-01T10:15:30Z',
    });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].title).toBe('Trip invitation');
    expect(service.unreadCount()).toBe(1);
  });

  it('ingests realtime trip invitation response notifications', () => {
    const realtimeMessages = new Subject<{
      eventType: string;
      notificationType: 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE' | 'TRIP_UPDATE';
      notificationId: number;
      title: string;
      description: string;
      details?: string | null;
      createdAt: string;
      relatedEntityId?: number | null;
    }>();

    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([]),
    };

    const realtimeWebSocketService = {
      observe: () => realtimeMessages.asObservable(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: RealtimeWebSocketService, useValue: realtimeWebSocketService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    realtimeMessages.next({
      eventType: 'TRIP_INVITATION_ACCEPTED',
      notificationType: 'TRIP_INVITATION_RESPONSE',
      notificationId: 44,
      title: 'Trip invite accepted',
      description: 'Grace Hopper accepted your invitation to Shared Rome.',
      details: 'Rome · 14 Jul 2026 → 21 Jul 2026 · €2,000',
      createdAt: '2026-07-02T09:15:30Z',
    });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].type).toBe('TRIP_INVITATION_RESPONSE');
    expect(service.items()[0].title).toBe('Trip invite accepted');
    expect(service.unreadCount()).toBe(1);
  });

  it('ingests realtime trip update notifications', () => {
    const realtimeMessages = new Subject<{
      eventType: string;
      notificationType: 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE' | 'TRIP_UPDATE';
      notificationId: number;
      title: string;
      description: string;
      details?: string | null;
      createdAt: string;
      relatedEntityId?: number | null;
    }>();

    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([]),
    };

    const realtimeWebSocketService = {
      observe: () => realtimeMessages.asObservable(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: RealtimeWebSocketService, useValue: realtimeWebSocketService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    realtimeMessages.next({
      eventType: 'TRIP_DETAILS_UPDATED',
      notificationType: 'TRIP_UPDATE',
      notificationId: 88,
      title: 'Trip updated',
      description: 'Ada Lovelace updated Shared Rome.',
      details: 'Rome · 14 Jul 2026 → 21 Jul 2026 · €2,000 · Ada Lovelace',
      createdAt: '2026-07-03T08:15:30Z',
      relatedEntityId: 20,
    });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].type).toBe('TRIP_UPDATE');
    expect(service.items()[0].description).toContain('updated Shared Rome');
    expect(service.items()[0].details).toContain('€2,000');
  });

  it('ingests trip topic updates into the notification bell for the current user', () => {
    const topicUpdates = new Subject<{
      eventType: string;
      notificationType: 'TRIP_UPDATE' | 'TRIP_BUDGET_UPDATE' | 'TRIP_PARTICIPANT_JOINED' | 'TRIP_PARTICIPANT_LEFT';
      notificationId: number;
      tripId: number;
      title: string;
      description: string;
      details?: string | null;
      createdAt: string;
      actorEmail?: string | null;
    }>();

    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([]),
      listSavedTrips: () => of([
        {
          id: 20,
          name: 'Shared Rome',
          destination: 'Rome',
          startDate: '2026-07-14',
          endDate: '2026-07-21',
          budget: 2000,
          status: 'UPCOMING',
          createdAt: '2026-07-01T10:15:30Z',
        },
      ]),
      observeTripTopicUpdates: () => topicUpdates.asObservable(),
    };

    const authWithToken = {
      email: () => 'traveler@example.com',
      token: signal('test-token'),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authWithToken },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    topicUpdates.next({
      eventType: 'TRIP_DETAILS_UPDATED',
      notificationType: 'TRIP_UPDATE',
      notificationId: 99,
      tripId: 20,
      title: 'Trip updated',
      description: 'Ali updated Summer Trip.',
      details: 'Rome · 14 Jul 2026 → 21 Jul 2026 · €2,000 · Ali',
      createdAt: '2026-07-03T08:15:30Z',
      actorEmail: 'ali@example.com',
    });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].title).toBe('Trip updated');
    expect(service.items()[0].description).toBe('Ali updated Summer Trip.');
    expect(service.unreadCount()).toBe(1);
  });

  it('ignores trip topic updates authored by the current user', () => {
    const topicUpdates = new Subject<{
      eventType: string;
      notificationType: 'TRIP_UPDATE' | 'TRIP_BUDGET_UPDATE' | 'TRIP_PARTICIPANT_JOINED' | 'TRIP_PARTICIPANT_LEFT';
      notificationId: number;
      tripId: number;
      title: string;
      description: string;
      details?: string | null;
      createdAt: string;
      actorEmail?: string | null;
    }>();

    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([]),
      listSavedTrips: () => of([
        {
          id: 20,
          name: 'Shared Rome',
          destination: 'Rome',
          startDate: '2026-07-14',
          endDate: '2026-07-21',
          budget: 2000,
          status: 'UPCOMING',
          createdAt: '2026-07-01T10:15:30Z',
        },
      ]),
      observeTripTopicUpdates: () => topicUpdates.asObservable(),
    };

    const authWithToken = {
      email: () => 'traveler@example.com',
      token: signal('test-token'),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authWithToken },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    topicUpdates.next({
      eventType: 'TRIP_DETAILS_UPDATED',
      notificationType: 'TRIP_UPDATE',
      notificationId: 100,
      tripId: 20,
      title: 'Trip updated',
      description: 'Traveler updated Shared Rome.',
      details: 'Rome · 14 Jul 2026 → 21 Jul 2026 · €2,000 · Traveler',
      createdAt: '2026-07-03T08:15:30Z',
      actorEmail: 'traveler@example.com',
    });

    expect(service.items().length).toBe(0);
    expect(service.unreadCount()).toBe(0);
  });

  it('ingests realtime trip budget update notifications', () => {
    const realtimeMessages = new Subject<{
      eventType: string;
      notificationType: 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE' | 'TRIP_UPDATE' | 'TRIP_BUDGET_UPDATE' | 'TRIP_PARTICIPANT_JOINED' | 'TRIP_PARTICIPANT_LEFT';
      notificationId: number;
      title: string;
      description: string;
      details?: string | null;
      createdAt: string;
      relatedEntityId?: number | null;
      actorEmail?: string | null;
    }>();

    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([]),
    };

    const realtimeWebSocketService = {
      observe: () => realtimeMessages.asObservable(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: RealtimeWebSocketService, useValue: realtimeWebSocketService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    realtimeMessages.next({
      eventType: 'TRIP_EXPENSE_CREATED',
      notificationType: 'TRIP_BUDGET_UPDATE',
      notificationId: 88,
      title: 'Trip budget updated',
      description: 'Ada Lovelace added an expense to Shared Rome.',
      details: 'Rome · 14 Jul 2026 → 21 Jul 2026 · €120 · food',
      createdAt: '2026-07-03T08:15:30Z',
      relatedEntityId: 20,
      actorEmail: 'ada@example.com',
    });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].type).toBe('TRIP_BUDGET_UPDATE');
    expect(service.items()[0].description).toContain('added an expense to Shared Rome');
  });

  it('ingests realtime participant join notifications', () => {
    const realtimeMessages = new Subject<{
      eventType: string;
      notificationType: 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE' | 'TRIP_UPDATE' | 'TRIP_BUDGET_UPDATE' | 'TRIP_PARTICIPANT_JOINED' | 'TRIP_PARTICIPANT_LEFT';
      notificationId: number;
      title: string;
      description: string;
      details?: string | null;
      createdAt: string;
      relatedEntityId?: number | null;
      actorEmail?: string | null;
    }>();

    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([]),
    };

    const realtimeWebSocketService = {
      observe: () => realtimeMessages.asObservable(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: RealtimeWebSocketService, useValue: realtimeWebSocketService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    realtimeMessages.next({
      eventType: 'TRIP_PARTICIPANT_JOINED',
      notificationType: 'TRIP_PARTICIPANT_JOINED',
      notificationId: 90,
      title: 'Trip participants updated',
      description: 'Grace Hopper joined Shared Rome.',
      details: 'Rome · 14 Jul 2026 → 21 Jul 2026 · €120 · Grace Hopper',
      createdAt: '2026-07-03T08:15:30Z',
      relatedEntityId: 20,
      actorEmail: 'grace@example.com',
    });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].type).toBe('TRIP_PARTICIPANT_JOINED');
  });

  it('does not duplicate realtime notifications with the same type and id', () => {
    const realtimeMessages = new Subject<{
      eventType: string;
      notificationType: 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE';
      notificationId: number;
      title: string;
      description: string;
      details?: string | null;
      createdAt: string;
    }>();

    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of([]),
      listSentTripInvitations: () => of([]),
    };

    const realtimeWebSocketService = {
      observe: () => realtimeMessages.asObservable(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: AuthService, useValue: authService },
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: RealtimeWebSocketService, useValue: realtimeWebSocketService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    const payload = {
      eventType: 'TRIP_INVITATION_CREATED',
      notificationType: 'TRIP_INVITATION' as const,
      notificationId: 44,
      title: 'Trip invitation',
      description: 'Ada Lovelace invited you to Shared Rome.',
      details: 'Rome · 14 Jul 2026 → 21 Jul 2026 · €2,000',
      createdAt: '2026-07-01T10:15:30Z',
    };

    realtimeMessages.next(payload);
    realtimeMessages.next(payload);

    expect(service.items().length).toBe(1);
    expect(service.items()[0].requestId).toBe(44);
  });

  it('keeps trip invitations after the backend stops returning them', () => {
    const tripInvitations = [
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
    ];
    const friendCommunityService = {
      listIncomingRequests: () => of([]),
    };

    const tripPlanningService = {
      listIncomingTripInvitations: () => of(tripInvitations),
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

    tripInvitations.splice(0, tripInvitations.length);
    service.refresh();

    expect(service.items().length).toBe(1);
    expect(service.items()[0].type).toBe('TRIP_INVITATION');
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
