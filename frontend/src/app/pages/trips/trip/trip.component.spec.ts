import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TripPlanningService } from '../../../services/trip-planning.service';
import { TripComponent } from './trip.component';

describe('TripComponent', () => {
  let fixture: ComponentFixture<TripComponent>;
  let tripPlanningService: jasmine.SpyObj<TripPlanningService>;

  beforeEach(async () => {
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', [
      'listTrips',
    ]);

    await TestBed.configureTestingModule({
      imports: [TripComponent],
      providers: [
        provideRouter([]),
        { provide: TripPlanningService, useValue: tripPlanningService },
      ],
    }).compileComponents();
  });

  it('loads and renders trips from the backend', () => {
    tripPlanningService.listTrips.and.returnValue(of([
      {
        id: 10,
        tripName: 'Summer in Italy',
        budget: 2400,
        currency: 'EUR',
        duration: 7,
        travelStyle: 'Mid-range',
      },
    ]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    expect(tripPlanningService.listTrips).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Summer in Italy');
    expect(fixture.nativeElement.textContent).toContain('7 nights');
    expect(fixture.nativeElement.textContent).toContain('€2,400');
  });

  it('shows an empty state when the user has no trips', () => {
    tripPlanningService.listTrips.and.returnValue(of([]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No trips yet');
  });

  it('shows an error state when trips cannot be loaded', () => {
    tripPlanningService.listTrips.and.returnValue(throwError(() => new Error('Backend unavailable')));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Could not load your trips');
  });
});
