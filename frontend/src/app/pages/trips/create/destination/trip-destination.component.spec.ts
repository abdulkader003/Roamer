import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { TripTemp, TripTempService } from '../trip-temp.service';
import { TripDestinationComponent } from './trip-destination.component';

describe('TripDestinationComponent', () => {
  let component: TripDestinationComponent;
  let fixture: ComponentFixture<TripDestinationComponent>;
  let router: Router;
  let tripTempService: jasmine.SpyObj<TripTempService>;

  const tripTemp: TripTemp = {
    tripName: 'Summer in Barcelona',
    budget: 2000,
    currency: 'EUR',
    durationNights: 7,
    travelStyle: 'Mid-range',
    origin: 'Frankfurt (FRA)',
    destination: 'Barcelona (BCN)',
    departureDate: '2026-07-14',
    returnDate: '2026-07-21',
    travelers: 2,
    selectedFlightId: '',
    selectedFlightTotal: null,
  };

  beforeEach(async () => {
    tripTempService = jasmine.createSpyObj<TripTempService>('TripTempService', [
      'getTripTemp',
      'updateTripTemp',
    ]);
    tripTempService.getTripTemp.and.returnValue(tripTemp);

    await TestBed.configureTestingModule({
      imports: [TripDestinationComponent],
      providers: [
        provideRouter([]),
        { provide: TripTempService, useValue: tripTempService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TripDestinationComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('restores the saved trip-temp values when the page opens', () => {
    expect(component.origin).toBe('Frankfurt (FRA)');
    expect(component.destination).toBe('Barcelona (BCN)');
    expect(component.departureDate).toBe('2026-07-14');
    expect(component.returnDate).toBe('2026-07-21');
    expect(component.travelers).toBe(2);
  });

  it('shows airport recommendations while typing origin or destination', () => {
    component.updateAirportText('origin', 'fra');

    expect(component.airportSuggestions('origin').map((airport) => airport.code)).toContain('FRA');
  });

  it('includes Dusseldorf in airport recommendations', () => {
    component.updateAirportText('origin', 'dus');

    expect(component.airportSuggestions('origin').map((airport) => airport.code)).toContain('DUS');
  });

  it('includes regional, European, and long-haul airport recommendations', () => {
    component.updateAirportText('origin', 'hamburg');
    expect(component.airportSuggestions('origin').map((airport) => airport.code)).toContain('HAM');

    component.updateAirportText('origin', 'zurich');
    expect(component.airportSuggestions('origin').map((airport) => airport.code)).toContain('ZRH');

    component.updateAirportText('origin', 'singapore');
    expect(component.airportSuggestions('origin').map((airport) => airport.code)).toContain('SIN');
  });

  it('selects an airport recommendation into the active field', () => {
    component.selectAirport('destination', {
      code: 'CDG',
      city: 'Paris',
      fullName: 'Charles de Gaulle',
    });

    expect(component.destination).toBe('Paris (CDG)');
    expect(component.activeAirportPicker).toBeNull();
  });

  it('opens the same style date picker used by Flights for departure dates', () => {
    component.toggleDatePicker('departure');
    fixture.detectChanges();

    expect(component.activeDatePicker).toBe('departure');
    expect(component.manualDateText).toBe('2026-07-14');
    expect(fixture.nativeElement.querySelector('.date-popover')).not.toBeNull();
  });

  it('updates departure dates from the date popover manual input', () => {
    component.returnDate = '';
    component.toggleDatePicker('departure');

    component.updateActiveDatePickerInput('2026-08-03');

    expect(component.departureDate).toBe('2026-08-03');
    expect(component.manualDateError).toBe('');
  });

  it('prevents return dates before the departure date', () => {
    component.toggleDatePicker('return');

    component.updateActiveDatePickerInput('2026-07-01');

    expect(component.returnDate).toBe('2026-07-21');
    expect(component.manualDateError).toBe('Return date cannot be before departure.');
  });

  it('closes the date popover after choosing a valid return date', () => {
    component.toggleDatePicker('return');

    component.updateActiveDatePickerInput('2026-07-25');

    expect(component.returnDate).toBe('2026-07-25');
    expect(component.activeDatePicker).toBeNull();
    expect(component.activeMultiCityDatePicker).toBeNull();
  });

  it('updates multi-city segment dates from the date popover', () => {
    component.setTripType('multi-city');
    component.multiCitySegments = [
      { fromText: 'Frankfurt (FRA)', toText: 'Paris (CDG)', date: '' },
      { fromText: 'Paris (CDG)', toText: 'Barcelona (BCN)', date: '' },
    ];

    component.toggleMultiCityDatePicker(1);
    component.updateActiveDatePickerInput('2026-07-18');

    expect(component.multiCitySegments[1].date).toBe('2026-07-18');
    expect(component.manualDateError).toBe('');
  });

  it('stores the destination step and sends a round-trip search to Flights', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    const form = { invalid: false };

    component.continueToFlights(form as never);

    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({
      origin: 'Frankfurt (FRA)',
      destination: 'Barcelona (BCN)',
      departureDate: '2026-07-14',
      returnDate: '2026-07-21',
      travelers: 2,
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/trips/create/flights'], {
      queryParams: {
        from: 'Frankfurt (FRA)',
        to: 'Barcelona (BCN)',
        departureDate: '2026-07-14',
        returnDate: '2026-07-21',
        travelers: 2,
        tripType: 'round-trip',
      },
    });
  });

  it('normalizes city-only airport names before moving to Flights', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    component.origin = 'Dusseldorf';
    component.destination = 'Milan';
    component.departureDate = '2026-06-18';
    component.returnDate = '2026-06-25';

    component.continueToFlights({ invalid: false } as never);

    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({
      origin: 'Dusseldorf (DUS)',
      destination: 'Milan (MXP)',
      departureDate: '2026-06-18',
      returnDate: '2026-06-25',
      travelers: 2,
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/trips/create/flights'], {
      queryParams: jasmine.objectContaining({
        from: 'Dusseldorf (DUS)',
        to: 'Milan (MXP)',
      }),
    });
  });

  it('supports multi-city searches with the same handoff format as Flights', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    component.setTripType('multi-city');
    component.multiCitySegments = [
      { fromText: 'Frankfurt (FRA)', toText: 'Paris (CDG)', date: '2026-07-14' },
      { fromText: 'Paris (CDG)', toText: 'Barcelona (BCN)', date: '2026-07-21' },
    ];

    component.continueToFlights({ invalid: false } as never);

    const segments = [
      { fromText: 'Frankfurt (FRA)', toText: 'Paris (CDG)', date: '2026-07-14' },
      { fromText: 'Paris (CDG)', toText: 'Barcelona (BCN)', date: '2026-07-21' },
    ];
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({
      origin: 'Frankfurt (FRA)',
      destination: 'Barcelona (BCN)',
      departureDate: '2026-07-14',
      returnDate: '2026-07-21',
      travelers: 2,
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/trips/create/flights'], {
      queryParams: {
        tripType: 'multi-city',
        travelers: 2,
        multiCitySegments: JSON.stringify(segments),
      },
    });
  });
});
