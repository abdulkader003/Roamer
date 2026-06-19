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
});
