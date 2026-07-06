import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FlightsService } from '../../../flights/flights.service';
import { TripTemp, TripTempService } from '../trip-temp.service';
import { TripFlightsComponent } from './trip-flights.component';

describe('TripFlightsComponent', () => {
  let component: TripFlightsComponent;
  let fixture: ComponentFixture<TripFlightsComponent>;
  let flightsService: jasmine.SpyObj<FlightsService>;
  let tripTempService: jasmine.SpyObj<TripTempService>;
  let router: Router;

  const tripTemp: TripTemp = {
    tripName: 'Summer in Barcelona',
    budget: 2000,
    currency: 'EUR',
    durationNights: 7,
    travelStyle: 'Mid-range',
    origin: 'Frankfurt (FRA)',
    destination: 'Barcelona (BCN)',
    destinationCities: ['Barcelona'],
    departureDate: '2026-07-14',
    returnDate: '2026-07-21',
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

  const flightSearchResponse = {
    searchId: 1,
    tripType: 'round-trip' as const,
    from: { code: 'FRA', city: 'Frankfurt', fullName: 'Frankfurt Airport' },
    to: { code: 'BCN', city: 'Barcelona', fullName: 'Barcelona-El Prat' },
    departureDate: '2026-07-14',
    returnDate: '2026-07-21',
    multiCitySegments: [],
    travelers: 2,
    adults: 2,
    children: 0,
    cabinClass: 'economy' as const,
    flights: [],
    outboundFlights: [
      {
        id: 'LH-1182',
        flightNumber: 'LH 1182',
        airline: { code: 'LH', name: 'Lufthansa', colorClass: 'lh' },
        departure: { time: '07:10', airport: 'FRA', city: 'Frankfurt', terminal: '1' },
        arrival: { time: '09:25', airport: 'BCN', city: 'Barcelona', terminal: '2' },
        duration: '2h 15m',
        stops: 0,
        price: 189,
        currency: 'EUR',
        carryOnIncluded: true,
        checkedBagIncluded: false,
        carryOnWeightKg: 8,
      },
    ],
    returnFlights: [
      {
        id: 'LH-1183',
        flightNumber: 'LH 1183',
        airline: { code: 'LH', name: 'Lufthansa', colorClass: 'lh' },
        departure: { time: '18:20', airport: 'BCN', city: 'Barcelona', terminal: '2' },
        arrival: { time: '20:35', airport: 'FRA', city: 'Frankfurt', terminal: '1' },
        duration: '2h 15m',
        stops: 0,
        price: 176,
        currency: 'EUR',
        carryOnIncluded: true,
        checkedBagIncluded: false,
        carryOnWeightKg: 8,
      },
    ],
    segmentFlights: [],
  };

  async function configureTestBed(
    savedTripTemp: TripTemp = tripTemp,
    queryParams: Record<string, string> = {},
  ): Promise<void> {
    flightsService = jasmine.createSpyObj<FlightsService>('FlightsService', ['search']);
    flightsService.search.and.returnValue(of(flightSearchResponse));
    tripTempService = jasmine.createSpyObj<TripTempService>('TripTempService', [
      'getTripTemp',
      'updateTripTemp',
    ]);
    tripTempService.getTripTemp.and.returnValue(savedTripTemp);

    await TestBed.configureTestingModule({
      imports: [TripFlightsComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams,
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
        { provide: FlightsService, useValue: flightsService },
        { provide: TripTempService, useValue: tripTempService },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await configureTestBed();
    fixture = TestBed.createComponent(TripFlightsComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('searches real flight options from the saved destination step', () => {
    expect(flightsService.search).toHaveBeenCalledWith(jasmine.objectContaining({
      tripType: 'round-trip',
      from: jasmine.objectContaining({ code: 'FRA' }),
      to: jasmine.objectContaining({ code: 'BCN' }),
      returnDate: jasmine.any(Date),
      travelers: 2,
      adults: 2,
    }));
    expect(component.flights.length).toBe(1);
    expect(component.returnFlights.length).toBe(1);
  });

  it('renders selectable flight result cards', () => {
    const card = fixture.nativeElement.querySelector('.flight-option') as HTMLButtonElement;

    expect(card.textContent).toContain('Lufthansa');
    expect(card.textContent).toContain('07:10');
    expect(card.textContent).toContain('€189');
    expect(fixture.nativeElement.textContent).toContain('Return flight');
    expect(fixture.nativeElement.textContent).toContain('18:20');
  });

  it('stores the selected flight in trip-temp', () => {
    const flight = component.flights[0];

    component.selectFlight(flight);

    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith(jasmine.objectContaining({
      selectedFlightId: 'LH-1182|LH-1183',
      selectedFlightAirline: 'Lufthansa + Lufthansa',
      selectedFlightNumber: 'LH 1182 / LH 1183',
      selectedFlightDepartureTime: '07:10',
      selectedFlightArrivalTime: '20:35',
      selectedFlightDuration: 'Outbound 2h 15m · Return 2h 15m',
      selectedFlightStops: 'Direct outbound · Direct return',
      selectedFlightTotal: 730,
      selectedFlightSegments: [
        jasmine.objectContaining({
          label: 'Outbound',
          from: 'Frankfurt (FRA)',
          to: 'Barcelona (BCN)',
          date: '2026-07-14',
          departureTime: '07:10',
          arrivalTime: '09:25',
        }),
        jasmine.objectContaining({
          label: 'Return',
          from: 'Barcelona (BCN)',
          to: 'Frankfurt (FRA)',
          date: '2026-07-21',
          departureTime: '18:20',
          arrivalTime: '20:35',
        }),
      ],
    }));
  });

  it('expands a clicked flight to show its details', () => {
    const card = fixture.nativeElement.querySelector('.flight-option') as HTMLButtonElement;

    card.click();
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.flight-details') as HTMLElement;
    expect(details).not.toBeNull();
    expect(details.textContent).toContain('Frankfurt → Barcelona');
    expect(details.textContent).toContain('Terminal 1');
    expect(details.textContent).toContain('Carry-on 8 kg included');
    expect(details.textContent).toContain('€378');
  });

  it('can search from city-only trip-temp values saved before normalization', async () => {
    TestBed.resetTestingModule();
    await configureTestBed({
      ...tripTemp,
      origin: 'Dusseldorf',
      destination: 'Milan',
    });
    fixture = TestBed.createComponent(TripFlightsComponent);
    fixture.detectChanges();

    expect(flightsService.search).toHaveBeenCalledWith(jasmine.objectContaining({
      from: jasmine.objectContaining({ code: 'DUS' }),
      to: jasmine.objectContaining({ code: 'MXP' }),
    }));
  });

  it('shows a retry button after search failure and reruns the search', async () => {
    TestBed.resetTestingModule();
    await configureTestBed();
    flightsService.search.and.returnValues(
      throwError(() => new Error('Flight search took too long. Please try again in a moment.')),
      of(flightSearchResponse),
    );
    fixture = TestBed.createComponent(TripFlightsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const retryButton = fixture.nativeElement.querySelector('.form-error button') as HTMLButtonElement;
    expect(retryButton).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Flight search took too long');

    retryButton.click();
    fixture.detectChanges();

    expect(flightsService.search).toHaveBeenCalledTimes(2);
    expect(component.flights.length).toBe(1);
    expect(component.searchError).toBe('');
  });

  it('continues to the trip hotel step after a flight is selected', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    component.continueToHotels();

    expect(navigateSpy).toHaveBeenCalledWith(['/trips/create/hotels'], {
      queryParams: jasmine.any(Object),
    });
  });

  it('renders and saves one selected flight per multi-city segment', async () => {
    TestBed.resetTestingModule();
    const multiCitySegments = [
      { fromText: 'Frankfurt (FRA)', toText: 'Barcelona (BCN)', date: '2026-07-14' },
      { fromText: 'Barcelona (BCN)', toText: 'Rome (FCO)', date: '2026-07-18' },
    ];
    await configureTestBed(
      {
        ...tripTemp,
        origin: 'Frankfurt (FRA)',
        destination: 'Rome (FCO)',
        departureDate: '2026-07-14',
        returnDate: '2026-07-18',
      },
      {
        tripType: 'multi-city',
        multiCitySegments: JSON.stringify(multiCitySegments),
      },
    );
    flightsService.search.and.returnValue(of({
      ...flightSearchResponse,
      tripType: 'multi-city',
      outboundFlights: [],
      returnFlights: [],
      flights: [],
      segmentFlights: [
        {
          segmentIndex: 0,
          fromText: 'Frankfurt (FRA)',
          toText: 'Barcelona (BCN)',
          date: '2026-07-14',
          flights: [flightSearchResponse.outboundFlights[0]],
        },
        {
          segmentIndex: 1,
          fromText: 'Barcelona (BCN)',
          toText: 'Rome (FCO)',
          date: '2026-07-18',
          flights: [{
            ...flightSearchResponse.returnFlights[0],
            id: 'AZ-77',
            flightNumber: 'AZ 77',
            airline: { code: 'AZ', name: 'ITA Airways', colorClass: 'az' },
            departure: { time: '11:30', airport: 'BCN', city: 'Barcelona', terminal: '1' },
            arrival: { time: '13:10', airport: 'FCO', city: 'Rome', terminal: '3' },
            price: 120,
          }],
        },
      ],
    }));

    fixture = TestBed.createComponent(TripFlightsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(flightsService.search).toHaveBeenCalledWith(jasmine.objectContaining({
      tripType: 'multi-city',
      multiCitySegments: jasmine.arrayContaining([
        jasmine.objectContaining({ fromText: 'Frankfurt (FRA)', toText: 'Barcelona (BCN)', date: jasmine.any(Date) }),
        jasmine.objectContaining({ fromText: 'Barcelona (BCN)', toText: 'Rome (FCO)', date: jasmine.any(Date) }),
      ]),
    }));
    expect(fixture.nativeElement.textContent).toContain('Segment 1');
    expect(fixture.nativeElement.textContent).toContain('Segment 2');
    expect(component.allSegmentsSelected()).toBeTrue();
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith(jasmine.objectContaining({
      selectedFlightId: 'LH-1182|AZ-77',
      selectedFlightTotal: 618,
      selectedFlightSegments: [
        jasmine.objectContaining({ from: 'Frankfurt (FRA)', to: 'Barcelona (BCN)', date: '2026-07-14' }),
        jasmine.objectContaining({ from: 'Barcelona (BCN)', to: 'Rome (FCO)', date: '2026-07-18' }),
      ],
    }));
  });

  it('preselects saved multi-city flights instead of defaulting to the first segment option', async () => {
    TestBed.resetTestingModule();
    const multiCitySegments = [
      { fromText: 'Frankfurt (FRA)', toText: 'Barcelona (BCN)', date: '2026-07-14' },
      { fromText: 'Barcelona (BCN)', toText: 'Rome (FCO)', date: '2026-07-18' },
    ];
    const savedFirstSegmentFlight = {
      ...flightSearchResponse.outboundFlights[0],
      id: 'LH-SAVED',
      flightNumber: 'LH SAVED',
      price: 210,
    };
    const savedSecondSegmentFlight = {
      ...flightSearchResponse.returnFlights[0],
      id: 'AZ-SAVED',
      flightNumber: 'AZ SAVED',
      airline: { code: 'AZ', name: 'ITA Airways', colorClass: 'az' },
      departure: { time: '11:30', airport: 'BCN', city: 'Barcelona', terminal: '1' },
      arrival: { time: '13:10', airport: 'FCO', city: 'Rome', terminal: '3' },
      price: 120,
    };

    await configureTestBed(
      {
        ...tripTemp,
        origin: 'Frankfurt (FRA)',
        destination: 'Rome (FCO)',
        departureDate: '2026-07-14',
        returnDate: '2026-07-18',
        selectedFlightId: 'LH-SAVED|AZ-SAVED',
      },
      {
        tripType: 'multi-city',
        multiCitySegments: JSON.stringify(multiCitySegments),
      },
    );
    flightsService.search.and.returnValue(of({
      ...flightSearchResponse,
      tripType: 'multi-city',
      outboundFlights: [],
      returnFlights: [],
      flights: [],
      segmentFlights: [
        {
          segmentIndex: 0,
          fromText: 'Frankfurt (FRA)',
          toText: 'Barcelona (BCN)',
          date: '2026-07-14',
          flights: [flightSearchResponse.outboundFlights[0], savedFirstSegmentFlight],
        },
        {
          segmentIndex: 1,
          fromText: 'Barcelona (BCN)',
          toText: 'Rome (FCO)',
          date: '2026-07-18',
          flights: [{
            ...flightSearchResponse.returnFlights[0],
            id: 'AZ-FIRST',
          }, savedSecondSegmentFlight],
        },
      ],
    }));

    fixture = TestBed.createComponent(TripFlightsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.selectedSegmentFlightIds).toEqual({
      0: 'LH-SAVED',
      1: 'AZ-SAVED',
    });
    expect(component.allSegmentsSelected()).toBeTrue();
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith(jasmine.objectContaining({
      selectedFlightId: 'LH-SAVED|AZ-SAVED',
    }));
  });
});
