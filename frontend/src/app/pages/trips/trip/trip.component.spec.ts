import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TripPlanningService } from '../../../services/trip-planning.service';
import { TripTempService } from '../create/trip-temp.service';
import { TripComponent } from './trip.component';

describe('TripComponent', () => {
  let fixture: ComponentFixture<TripComponent>;
  let tripPlanningService: jasmine.SpyObj<TripPlanningService>;
  let tripTempService: jasmine.SpyObj<TripTempService>;

  beforeEach(async () => {
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', [
      'listSavedTrips',
      'updateTrip',
      'deleteTrip',
    ]);
    tripTempService = jasmine.createSpyObj<TripTempService>('TripTempService', [
      'clearTripTemp',
      'getTripTemp',
      'updateTripTemp',
    ]);
    tripTempService.getTripTemp.and.returnValue(emptyTripTemp());
    tripTempService.updateTripTemp.and.callFake((changes) => ({
      ...emptyTripTemp(),
      ...changes,
    }));

    await TestBed.configureTestingModule({
      imports: [TripComponent],
      providers: [
        provideRouter([]),
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: TripTempService, useValue: tripTempService },
      ],
    }).compileComponents();
  });

  it('loads and renders trips from the backend', () => {
    tripPlanningService.listSavedTrips.and.returnValue(of([
      {
        id: 10,
        name: 'Summer in Italy',
        destination: 'Rome',
        startDate: '2026-07-15',
        endDate: '2026-07-22',
        budget: 2400,
        status: 'UPCOMING',
        createdAt: '2026-06-20T18:00:00Z',
      },
    ]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    expect(tripPlanningService.listSavedTrips).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Summer in Italy');
    expect(fixture.nativeElement.textContent).toContain('Rome');
    expect(fixture.nativeElement.textContent).toContain('€2,400');
    expect(fixture.nativeElement.textContent).toContain('Confirmed');
  });

  it('shows an empty state when the user has no trips', () => {
    tripPlanningService.listSavedTrips.and.returnValue(of([]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No trips yet');
  });

  it('shows an error state when trips cannot be loaded', () => {
    tripPlanningService.listSavedTrips.and.returnValue(throwError(() => new Error('Backend unavailable')));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Could not load your trips');
  });

  it('highlights draft trips', () => {
    tripPlanningService.listSavedTrips.and.returnValue(of([
      {
        id: 11,
        name: 'Barcelona Draft',
        destination: 'Barcelona',
        startDate: '2026-07-14',
        endDate: '2026-07-17',
        budget: 1050,
        status: 'PLANNING',
        createdAt: '2026-06-20T18:00:00Z',
      },
    ]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.trip-card--draft')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Draft');
  });

  it('opens a trip summary modal when a trip is clicked', () => {
    tripPlanningService.listSavedTrips.and.returnValue(of([
      savedTrip({ id: 12, name: 'Rome Confirmed', status: 'UPCOMING' }),
    ]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.trip-card').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.trip-modal')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Rome Confirmed');
    expect(fixture.nativeElement.textContent).toContain('Budget Overview');
    expect(fixture.nativeElement.textContent).toContain('No booking details saved for this trip');
  });

  it('renders stored wizard details inside the trip overview modal', () => {
    const trip = savedTrip({ id: 17, name: 'Detailed Draft', destination: 'Barcelona', status: 'PLANNING' });
    tripPlanningService.listSavedTrips.and.returnValue(of([trip]));
    tripTempService.getTripTemp.and.returnValue({
      ...emptyTripTemp(),
      draftTripId: 17,
      tripName: 'Detailed Draft',
      budget: 2400,
      destination: 'Barcelona',
      destinationCities: ['Barcelona'],
      departureDate: '2026-07-15',
      returnDate: '2026-07-22',
      travelers: 2,
      selectedFlightId: 'LH-100',
      selectedFlightAirline: 'Lufthansa',
      selectedFlightNumber: 'LH 100',
      selectedFlightDepartureTime: '07:10',
      selectedFlightArrivalTime: '09:25',
      selectedFlightDuration: '2h 15m',
      selectedFlightStops: 'Direct',
      selectedFlightTotal: 756,
      selectedHotelName: 'Barcelona Grand',
      selectedHotelCity: 'Barcelona',
      selectedHotelStars: 5,
      selectedHotelTotal: 1200,
      selectedActivities: [
        {
          name: 'Picasso Museum',
          category: 'Arts & Culture',
          price: 28,
          duration: '2 hours',
          city: 'Barcelona',
        },
      ],
      selectedActivitiesTotal: 28,
    });

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.trip-card').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Lufthansa');
    expect(fixture.nativeElement.textContent).toContain('Barcelona Grand');
    expect(fixture.nativeElement.textContent).toContain('Picasso Museum');
    expect(fixture.nativeElement.textContent).toContain('€1,984');
  });

  it('edits a saved trip through the modal', () => {
    const trip = savedTrip({ id: 13, name: 'Old Name', status: 'UPCOMING' });
    const updatedTrip = { ...trip, name: 'Updated Name', budget: 2800 };
    tripPlanningService.listSavedTrips.and.returnValue(of([trip]));
    tripPlanningService.updateTrip.and.returnValue(of(updatedTrip));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.openTrip(trip);
    component.startEditing();
    component.editTripForm = {
      name: 'Updated Name',
      startDate: '2026-07-15',
      endDate: '2026-07-22',
      budget: 2800,
    };
    component.saveTripEdits();
    fixture.detectChanges();

    expect(tripPlanningService.updateTrip).toHaveBeenCalledWith(13, {
      name: 'Updated Name',
      destination: 'Rome',
      startDate: '2026-07-15',
      endDate: '2026-07-22',
      budget: 2800,
      status: 'UPCOMING',
    });
    expect(component.trips()[0].name).toBe('Updated Name');
    expect(component.isEditing()).toBeFalse();
  });

  it('continues a draft trip from destination when no saved wizard progress exists', () => {
    const draft = savedTrip({ id: 14, name: 'Draft Barcelona', status: 'PLANNING' });
    tripPlanningService.listSavedTrips.and.returnValue(of([draft]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    component.openTrip(draft);
    component.continueDraft();

    expect(tripTempService.clearTripTemp).toHaveBeenCalled();
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith(jasmine.objectContaining({
      draftTripId: 14,
      tripName: 'Draft Barcelona',
      destination: 'Rome',
      departureDate: '2026-07-15',
      returnDate: '2026-07-22',
      durationNights: 7,
    }));
    expect(tripPlanningService.updateTrip).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/trips/create/destination'], { queryParams: undefined });
  });

  it('continues a draft trip from the first missing wizard step when saved progress exists', () => {
    const draft = savedTrip({ id: 16, name: 'Draft With Progress', status: 'PLANNING' });
    tripPlanningService.listSavedTrips.and.returnValue(of([draft]));
    tripTempService.getTripTemp.and.returnValue({
      ...emptyTripTemp(),
      draftTripId: 16,
      tripPlanningId: 44,
      tripName: 'Draft With Progress',
      budget: 2400,
      durationNights: 7,
      origin: 'Frankfurt (FRA)',
      destination: 'Rome',
      destinationCities: ['Rome'],
      departureDate: '2026-07-15',
      returnDate: '2026-07-22',
      selectedFlightId: 'LH-100',
    });
    tripTempService.updateTripTemp.and.callFake((changes) => ({
      ...tripTempService.getTripTemp(),
      ...changes,
    }));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    fixture.componentInstance.openTrip(draft);
    fixture.componentInstance.continueDraft();

    expect(tripTempService.clearTripTemp).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/trips/create/hotels'], {
      queryParams: { tripPlanningId: 44 },
    });
  });

  it('deletes a selected trip', () => {
    const trip = savedTrip({ id: 15, name: 'Delete Me', status: 'UPCOMING' });
    tripPlanningService.listSavedTrips.and.returnValue(of([trip]));
    tripPlanningService.deleteTrip.and.returnValue(of(undefined));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.openTrip(trip);
    component.deleteSelectedTrip();

    expect(tripPlanningService.deleteTrip).toHaveBeenCalledWith(15);
    expect(component.trips()).toEqual([]);
    expect(component.selectedTrip()).toBeNull();
  });

  function savedTrip(overrides: Partial<{
    id: number;
    name: string;
    destination: string;
    startDate: string;
    endDate: string;
    budget: number;
    status: 'UPCOMING' | 'PLANNING';
    createdAt: string;
  }>) {
    return {
      id: overrides.id ?? 10,
      name: overrides.name ?? 'Summer in Italy',
      destination: overrides.destination ?? 'Rome',
      startDate: overrides.startDate ?? '2026-07-15',
      endDate: overrides.endDate ?? '2026-07-22',
      budget: overrides.budget ?? 2400,
      status: overrides.status ?? 'UPCOMING',
      createdAt: overrides.createdAt ?? '2026-06-20T18:00:00Z',
    };
  }

  function emptyTripTemp() {
    return {
      tripPlanningId: null,
      draftTripId: null,
      tripName: '',
      budget: null,
      currency: 'EUR',
      durationNights: 0,
      travelStyle: 'Mid-range',
      origin: '',
      destination: '',
      destinationCities: [],
      departureDate: '',
      returnDate: '',
      travelers: 2,
      selectedFlightId: '',
      selectedFlightAirline: '',
      selectedFlightNumber: '',
      selectedFlightDepartureTime: '',
      selectedFlightArrivalTime: '',
      selectedFlightDuration: '',
      selectedFlightStops: '',
      selectedFlightTotal: null,
      selectedHotelName: '',
      selectedHotelCity: '',
      selectedHotelStars: null,
      selectedHotelTotal: null,
      selectedActivities: [],
      selectedActivitiesTotal: 0,
    };
  }
});
