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
});
