import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  const flightSearchResponse = {
    searchId: 1,
    tripType: 'one-way' as const,
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
    returnFlights: [],
    segmentFlights: [],
  };

  async function configureTestBed(savedTripTemp: TripTemp = tripTemp): Promise<void> {
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
        { provide: FlightsService, useValue: flightsService },
        { provide: TripTempService, useValue: tripTempService },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await configureTestBed();
    fixture = TestBed.createComponent(TripFlightsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('searches real flight options from the saved destination step', () => {
    expect(flightsService.search).toHaveBeenCalledWith(jasmine.objectContaining({
      tripType: 'one-way',
      from: jasmine.objectContaining({ code: 'FRA' }),
      to: jasmine.objectContaining({ code: 'BCN' }),
      travelers: 2,
      adults: 2,
    }));
    expect(component.flights.length).toBe(1);
  });

  it('renders selectable flight result cards', () => {
    const card = fixture.nativeElement.querySelector('.flight-option') as HTMLButtonElement;

    expect(card.textContent).toContain('Lufthansa');
    expect(card.textContent).toContain('07:10');
    expect(card.textContent).toContain('€189');
  });

  it('stores the selected flight in trip-temp', () => {
    const flight = component.flights[0];

    component.selectFlight(flight);

    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({
      selectedFlightId: 'LH-1182',
      selectedFlightTotal: 378,
    });
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
});
