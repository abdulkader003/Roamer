import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { AuthService } from './auth';
import { RealtimeWebSocketService } from './realtime-websocket.service';
import { CreateTripBudgetRequest, TripPlanningService } from './trip-planning.service';

describe('TripPlanningService', () => {
  let service: TripPlanningService;
  let httpTesting: HttpTestingController;
  let realtimeMessages: Subject<unknown>;

  beforeEach(() => {
    realtimeMessages = new Subject<unknown>();

    TestBed.configureTestingModule({
      providers: [
        TripPlanningService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { authHeader: () => ({ Authorization: 'Bearer test-token' }) },
        },
        {
          provide: RealtimeWebSocketService,
          useValue: { observe: () => realtimeMessages.asObservable() },
        },
      ],
    });

    service = TestBed.inject(TripPlanningService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('posts the budget step with the existing JWT header', () => {
    const request: CreateTripBudgetRequest = {
      tripName: 'Summer in Italy',
      budget: 2450,
      currency: 'EUR',
      duration: 7,
      travelStyle: 'Mid-range',
    };

    service.saveBudgetStep(request).subscribe();

    const httpRequest = httpTesting.expectOne('/api/trip-planning/budget');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(request);
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({ id: 10, ...request });
  });

  it('posts the selected hotel with the existing JWT header', () => {
    service.saveHotelStep(10, { hotelId: 77 }).subscribe();

    const httpRequest = httpTesting.expectOne('/api/trip-planning/10/hotel');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual({ hotelId: 77 });
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({
      tripPlanningId: 10,
      hotelId: 77,
      hotelName: 'Barcelona Grand',
      hotelCity: 'Barcelona',
      pricePerNight: 220,
      stars: 5,
      ratingScore: 9.1,
      ratingLabel: 'Superb',
    });
  });

  it('posts the selected activities with the existing JWT header', () => {
    const request = {
      activities: [
        {
          name: 'Picasso Museum',
          category: 'Arts & Culture',
          price: 28,
          duration: '2 hours',
          city: 'Barcelona',
        },
      ],
    };

    service.saveActivitiesStep(10, request).subscribe();

    const httpRequest = httpTesting.expectOne('/api/trip-planning/10/activities');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(request);
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({
      tripPlanningId: 10,
      selectedActivities: request.activities,
      totalActivitiesCost: 28,
      selectedActivitiesCount: 1,
    });
  });

  it('loads trips with the existing JWT header', () => {
    service.listTrips().subscribe((trips) => {
      expect(trips[0].tripName).toBe('Summer in Italy');
    });

    const httpRequest = httpTesting.expectOne('/api/trip-planning');
    expect(httpRequest.request.method).toBe('GET');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush([
      {
        id: 10,
        tripName: 'Summer in Italy',
        budget: 2450,
        currency: 'EUR',
        duration: 7,
        travelStyle: 'Mid-range',
      },
    ]);
  });

  it('loads the trip overview with the existing JWT header', () => {
    service.getOverview(10).subscribe((overview) => {
      expect(overview.tripName).toBe('Summer in Italy');
      expect(overview.selectedHotel?.hotelName).toBe('Barcelona Grand');
    });

    const httpRequest = httpTesting.expectOne('/api/trip-planning/10/overview');
    expect(httpRequest.request.method).toBe('GET');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({
      id: 10,
      tripName: 'Summer in Italy',
      budget: 2450,
      currency: 'EUR',
      duration: 7,
      travelStyle: 'Mid-range',
      selectedHotel: {
        tripPlanningId: 10,
        hotelId: 77,
        hotelName: 'Barcelona Grand',
        hotelCity: 'Barcelona',
        pricePerNight: 220,
        stars: 5,
        ratingScore: 9.1,
        ratingLabel: 'Superb',
      },
      selectedActivities: [],
      totalActivitiesCost: 0,
    });
  });

  it('creates a confirmed or draft trip with the existing JWT header', () => {
    const request = {
      name: 'Summer in Barcelona',
      destination: 'Barcelona',
      startDate: '2026-07-14',
      endDate: '2026-07-21',
      budget: 2000,
      status: 'UPCOMING' as const,
    };

    service.createTrip(request).subscribe((trip) => {
      expect(trip.status).toBe('UPCOMING');
    });

    const httpRequest = httpTesting.expectOne('/api/trips');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(request);
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({ id: 99, createdAt: '2026-06-20T18:00:00Z', ...request });
  });

  it('loads saved trips from the trips API', () => {
    service.listSavedTrips().subscribe((trips) => {
      expect(trips[0].name).toBe('Draft Barcelona');
      expect(trips[0].status).toBe('PLANNING');
    });

    const httpRequest = httpTesting.expectOne('/api/trips');
    expect(httpRequest.request.method).toBe('GET');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush([
      {
        id: 20,
        name: 'Draft Barcelona',
        destination: 'Barcelona',
        startDate: '2026-07-14',
        endDate: '2026-07-21',
        budget: 2000,
        status: 'PLANNING',
        createdAt: '2026-06-20T18:00:00Z',
      },
    ]);
  });

  it('loads one accessible trip with the existing JWT header', () => {
    service.getTrip(20).subscribe((trip) => {
      expect(trip.name).toBe('Draft Barcelona');
    });

    const httpRequest = httpTesting.expectOne('/api/trips/20');
    expect(httpRequest.request.method).toBe('GET');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({
      id: 20,
      name: 'Draft Barcelona',
      destination: 'Barcelona',
      startDate: '2026-07-14',
      endDate: '2026-07-21',
      budget: 2000,
      status: 'PLANNING',
      createdAt: '2026-06-20T18:00:00Z',
    });
  });

  it('emits realtime trip budget updates from websocket notifications', (done) => {
    const updates: Array<{
      notificationType: 'TRIP_INVITATION_RESPONSE' | 'TRIP_UPDATE' | 'TRIP_BUDGET_UPDATE';
      tripId: number;
    }> = [];

    service.observeTripUpdates().subscribe((event) => {
      updates.push(event);
      expect(updates).toHaveSize(1);
      expect(event.notificationType).toBe('TRIP_BUDGET_UPDATE');
      expect(event.tripId).toBe(20);
      done();
    });

    realtimeMessages.next({
      eventType: 'TRIP_EXPENSE_CREATED',
      notificationType: 'TRIP_BUDGET_UPDATE',
      notificationId: 77,
      title: 'Trip budget updated',
      description: 'Ada Lovelace added an expense to Shared Rome.',
      details: 'Rome · 14 Jul 2026 → 21 Jul 2026 · €120 · food',
      createdAt: '2026-07-03T08:15:30Z',
      relatedEntityId: 20,
    });
  });

  it('invites an accepted friend to a trip with the existing JWT header', () => {
    service.inviteFriendToTrip(20, { invitedUserId: 9 }).subscribe((response) => {
      expect(response.trip.id).toBe(20);
    });

    const httpRequest = httpTesting.expectOne('/api/trips/20/invitations');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual({ invitedUserId: 9 });
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({
      id: 30,
      trip: {
        id: 20,
        name: 'Draft Barcelona',
        destination: 'Barcelona',
        startDate: '2026-07-14',
        endDate: '2026-07-21',
        budget: 2000,
        status: 'PLANNING',
      },
      invitedBy: {
        id: 1,
        username: 'owner',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'owner@example.com',
        verified: true,
        profilePictureUpdatedAt: null,
      },
      invitedUser: {
        id: 9,
        username: 'friend',
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'friend@example.com',
        verified: true,
        profilePictureUpdatedAt: null,
      },
      status: 'PENDING',
      createdAt: '2026-06-20T18:00:00Z',
    });
  });

  it('loads incoming trip invitations with the existing JWT header', () => {
    service.listIncomingTripInvitations().subscribe((invitations) => {
      expect(invitations[0].trip.name).toBe('Shared Rome');
    });

    const httpRequest = httpTesting.expectOne('/api/trips/invitations/incoming');
    expect(httpRequest.request.method).toBe('GET');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush([
      {
        id: 44,
        trip: {
          id: 20,
          name: 'Shared Rome',
          destination: 'Rome',
          startDate: '2026-07-14',
          endDate: '2026-07-21',
          budget: 2000,
          status: 'PLANNING',
        },
        invitedBy: {
          id: 1,
          username: 'owner',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'owner@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        invitedUser: {
          id: 9,
          username: 'friend',
          firstName: 'Grace',
          lastName: 'Hopper',
          email: 'friend@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        status: 'PENDING',
        createdAt: '2026-06-20T18:00:00Z',
      },
    ]);
  });

  it('loads sent trip invitations with the existing JWT header', () => {
    service.listSentTripInvitations().subscribe((invitations) => {
      expect(invitations[0].invitedUser.username).toBe('friend');
    });

    const httpRequest = httpTesting.expectOne('/api/trips/invitations/sent');
    expect(httpRequest.request.method).toBe('GET');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush([
      {
        id: 55,
        trip: {
          id: 20,
          name: 'Shared Rome',
          destination: 'Rome',
          startDate: '2026-07-14',
          endDate: '2026-07-21',
          budget: 2000,
          status: 'PLANNING',
        },
        invitedBy: {
          id: 1,
          username: 'owner',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'owner@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        invitedUser: {
          id: 9,
          username: 'friend',
          firstName: 'Grace',
          lastName: 'Hopper',
          email: 'friend@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        status: 'ACCEPTED',
        createdAt: '2026-06-20T18:00:00Z',
      },
    ]);
  });

  it('loads trip participants with the existing JWT header', () => {
    service.listTripParticipants(20).subscribe((participants) => {
      expect(participants[0].role).toBe('OWNER');
    });

    const httpRequest = httpTesting.expectOne('/api/trips/20/participants');
    expect(httpRequest.request.method).toBe('GET');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush([
      {
        user: {
          id: 1,
          username: 'owner',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'owner@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        role: 'OWNER',
      },
    ]);
  });

  it('cancels a trip invitation with the existing JWT header', () => {
    service.cancelTripInvitation(55).subscribe((response) => {
      expect(response.message).toBe('Trip invitation cancelled.');
    });

    const httpRequest = httpTesting.expectOne('/api/trips/invitations/55');
    expect(httpRequest.request.method).toBe('DELETE');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({ message: 'Trip invitation cancelled.' });
  });

  it('accepts a trip invitation with the existing JWT header', () => {
    service.acceptTripInvitation(44).subscribe((response) => {
      expect(response.message).toBe('Trip invitation accepted.');
    });

    const httpRequest = httpTesting.expectOne('/api/trips/invitations/44/accept');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({ message: 'Trip invitation accepted.' });
  });

  it('declines a trip invitation with the existing JWT header', () => {
    service.declineTripInvitation(44).subscribe((response) => {
      expect(response.message).toBe('Trip invitation declined.');
    });

    const httpRequest = httpTesting.expectOne('/api/trips/invitations/44/decline');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({ message: 'Trip invitation declined.' });
  });

  it('updates a saved trip with the existing JWT header', () => {
    const request = {
      name: 'Updated Barcelona',
      destination: 'Barcelona',
      startDate: '2026-07-14',
      endDate: '2026-07-21',
      budget: 2200,
      status: 'UPCOMING' as const,
    };

    service.updateTrip(20, request).subscribe((trip) => {
      expect(trip.name).toBe('Updated Barcelona');
    });

    const httpRequest = httpTesting.expectOne('/api/trips/20');
    expect(httpRequest.request.method).toBe('PUT');
    expect(httpRequest.request.body).toEqual(request);
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({ id: 20, createdAt: '2026-06-20T18:00:00Z', ...request });
  });

  it('deletes a saved trip with the existing JWT header', () => {
    service.deleteTrip(20).subscribe();

    const httpRequest = httpTesting.expectOne('/api/trips/20');
    expect(httpRequest.request.method).toBe('DELETE');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush(null);
  });

  it('leaves a shared trip with the existing JWT header', () => {
    service.leaveTrip(20).subscribe((response) => {
      expect(response.message).toBe('You left this trip.');
    });

    const httpRequest = httpTesting.expectOne('/api/trips/20/leave');
    expect(httpRequest.request.method).toBe('DELETE');
    expect(httpRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    httpRequest.flush({ message: 'You left this trip.' });
  });
});
