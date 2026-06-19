import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Trip, TripService } from './trip.service';
import { TripsComponent } from './trips.component';

const existingTrip: Trip = {
  id: 1,
  name: 'Business Conference',
  destination: 'London, UK',
  startDate: '2026-08-03',
  endDate: '2026-08-05',
  budget: 1200,
  status: 'PLANNING',
  createdAt: '2026-06-14T12:00:00Z',
};

describe('TripsComponent', () => {
  let component: TripsComponent;
  let fixture: ComponentFixture<TripsComponent>;
  let tripService: jasmine.SpyObj<TripService>;

  beforeEach(async () => {
    tripService = jasmine.createSpyObj<TripService>('TripService', ['getTrips']);
    tripService.getTrips.and.returnValue(of([existingTrip]));

    await TestBed.configureTestingModule({
      imports: [TripsComponent],
      providers: [
        provideRouter([]),
        { provide: TripService, useValue: tripService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TripsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads and renders trips from the backend service', () => {
    expect(tripService.getTrips).toHaveBeenCalled();
    expect(component.trips()).toEqual([existingTrip]);
    expect(component.isLoading()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Business Conference');
    expect(fixture.nativeElement.textContent).toContain('London, UK');
  });

  it('links the header create action to the destination wizard', () => {
    const createLink: HTMLAnchorElement = fixture.nativeElement.querySelector('.page-header .primary-button');

    expect(createLink.textContent).toContain('Create New Trip');
    expect(createLink.getAttribute('href')).toContain('/trips/create/destination');
  });

  it('links the empty-state planning action to the destination wizard', () => {
    const planLink: HTMLAnchorElement = fixture.nativeElement.querySelector('.plan-trip-button');

    expect(planLink.textContent).toContain('Plan a new trip');
    expect(planLink.getAttribute('href')).toContain('/trips/create/destination');
  });

  it('shows the backend load error', () => {
    tripService.getTrips.and.returnValue(throwError(() => ({
      error: { message: 'Trips service unavailable' },
    })));

    const errorFixture = TestBed.createComponent(TripsComponent);
    errorFixture.detectChanges();

    expect(errorFixture.componentInstance.isLoading()).toBeFalse();
    expect(errorFixture.componentInstance.errorMessage()).toBe('Unable to load your trips right now.');
  });

  it('formats dates, budgets, and statuses for the overview', () => {
    const summerTrip: Trip = {
      ...existingTrip,
      startDate: '2026-07-15',
      endDate: '2026-07-22',
      budget: 2400,
      status: 'UPCOMING',
    };

    expect(component.formatDateRange(summerTrip)).toBe('Jul 15 - 22, 2026');
    expect(component.formatDateRange({
      ...summerTrip,
      endDate: '2026-08-02',
    })).toBe('Jul 15 - Aug 2, 2026');
    expect(component.formatBudget(2400)).toContain('2,400');
    expect(component.statusLabel('UPCOMING')).toBe('Upcoming');
    expect(component.statusLabel('PLANNING')).toBe('Planning');
  });
});
