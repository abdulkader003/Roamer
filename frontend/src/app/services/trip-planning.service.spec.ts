import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { CreateTripBudgetRequest, TripPlanningService } from './trip-planning.service';

describe('TripPlanningService', () => {
  let service: TripPlanningService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TripPlanningService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { authHeader: () => ({ Authorization: 'Bearer test-token' }) },
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
});
