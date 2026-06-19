import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth';
import { CreateTripRequest, Trip, TripService } from './trip.service';

const tripFixture: Trip = {
  id: 11,
  name: 'Summer Getaway',
  destination: 'Rome, Italy',
  startDate: '2026-07-15',
  endDate: '2026-07-22',
  budget: 2400,
  status: 'UPCOMING',
  createdAt: '2026-06-14T12:00:00Z',
};

describe('TripService', () => {
  let service: TripService;
  let httpClient: jasmine.SpyObj<HttpClient>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    httpClient = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post']);
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['authHeader']);
    authService.authHeader.and.returnValue({ Authorization: 'Bearer test-token' });

    TestBed.configureTestingModule({
      providers: [
        TripService,
        { provide: HttpClient, useValue: httpClient },
        { provide: AuthService, useValue: authService },
      ],
    });

    service = TestBed.inject(TripService);
  });

  it('loads trips with the current authentication header', () => {
    httpClient.get.and.returnValue(of([tripFixture]));
    let result: Trip[] = [];

    service.getTrips().subscribe((trips) => result = trips);

    expect(result).toEqual([tripFixture]);
    expect(httpClient.get).toHaveBeenCalledWith('/api/trips', {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('posts a new trip with the current authentication header', () => {
    const request: CreateTripRequest = {
      name: 'Summer Getaway',
      destination: 'Rome, Italy',
      startDate: '2026-07-15',
      endDate: '2026-07-22',
      budget: 2400,
      status: 'UPCOMING',
    };
    httpClient.post.and.returnValue(of(tripFixture));
    let result: Trip | undefined;

    service.createTrip(request).subscribe((trip) => result = trip);

    expect(result).toEqual(tripFixture);
    expect(httpClient.post).toHaveBeenCalledWith('/api/trips', request, {
      headers: { Authorization: 'Bearer test-token' },
    });
  });
});
