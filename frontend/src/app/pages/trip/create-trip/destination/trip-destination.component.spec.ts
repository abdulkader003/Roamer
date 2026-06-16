import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgForm } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { TripDraftService } from '../trip-draft.service';
import { TripDestinationComponent } from './trip-destination.component';

describe('TripDestinationComponent', () => {
  let component: TripDestinationComponent;
  let fixture: ComponentFixture<TripDestinationComponent>;
  let draftService: jasmine.SpyObj<TripDraftService>;
  let router: Router;

  beforeEach(async () => {
    draftService = jasmine.createSpyObj<TripDraftService>('TripDraftService', [
      'getDraft',
      'updateDraft',
    ]);
    draftService.getDraft.and.returnValue({
      tripName: 'Summer in Barcelona',
      budget: 2000,
      durationNights: 7,
      origin: 'Frankfurt',
      destination: 'Barcelona',
      departureDate: '2026-07-14',
      returnDate: '2026-07-21',
      travelers: 2,
    });

    await TestBed.configureTestingModule({
      imports: [TripDestinationComponent],
      providers: [
        provideRouter([]),
        { provide: TripDraftService, useValue: draftService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TripDestinationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('restores destination fields from the shared trip draft', () => {
    expect(component.origin).toBe('Frankfurt');
    expect(component.destination).toBe('Barcelona');
    expect(component.departureDate).toBe('2026-07-14');
    expect(component.returnDate).toBe('2026-07-21');
    expect(component.travelers).toBe(2);
    expect(component.tripType).toBe('round-trip');
    expect(fixture.nativeElement.textContent).toContain('Choose your destination');
  });

  it('renders flight-style trip type tabs including multi-city', () => {
    const tabs = Array.from(fixture.nativeElement.querySelectorAll('.trip-tab')) as HTMLButtonElement[];

    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['One way', 'Round trip', 'Multi-city']);

    tabs[2].click();
    fixture.detectChanges();

    expect(component.tripType).toBe('multi-city');
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(fixture.nativeElement.querySelector('.multi-city-builder')).toBeTruthy();
  });

  it('swaps origin and destination like the flights search bar', () => {
    component.origin = 'Frankfurt (FRA)';
    component.destination = 'Barcelona (BCN)';

    component.swapAirports();

    expect(component.origin).toBe('Barcelona (BCN)');
    expect(component.destination).toBe('Frankfurt (FRA)');
    expect(component.activeAirportPicker).toBeNull();
  });

  it('opens the flight-style date picker from the departure field', () => {
    const departureButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.date-field .date-trigger[aria-label="Choose departure date"]',
    );

    departureButton.click();
    fixture.detectChanges();

    expect(component.activeDatePicker).toBe('departure');
    expect(fixture.nativeElement.querySelector('.date-popover')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Choose departure date');
    expect(fixture.nativeElement.textContent).toContain('Manual date');
  });

  it('shows airport recommendations while typing in origin and destination fields', () => {
    component.updateAirportText('origin', 'fra');
    fixture.detectChanges();

    expect(component.airportSuggestions('origin').map((airport) => airport.code)).toContain('FRA');
    expect(fixture.nativeElement.textContent).toContain('Frankfurt Airport');

    component.updateAirportText('destination', 'bar');
    fixture.detectChanges();

    expect(component.airportSuggestions('destination').map((airport) => airport.code)).toContain('BCN');
    expect(component.activeAirportPicker).toBe('destination');
  });

  it('fills the field when an airport recommendation is selected', () => {
    const [frankfurt] = component.airportSuggestions('origin');

    component.selectAirport('origin', frankfurt);

    expect(component.origin).toBe('Frankfurt (FRA)');
    expect(component.activeAirportPicker).toBeNull();
    expect(component.formError).toBe('');
  });

  it('moves from departure selection to return selection', () => {
    component.toggleDatePicker('departure');

    component.selectCalendarDate(new Date(2026, 6, 16));
    fixture.detectChanges();

    expect(component.departureDate).toBe('2026-07-16');
    expect(component.returnDate).toBe('2026-07-21');
    expect(component.activeDatePicker).toBe('return');
  });

  it('validates manual return dates inside the picker', () => {
    component.toggleDatePicker('return');

    component.updateActiveDatePickerInput('2026-07-13');

    expect(component.returnDate).toBe('2026-07-21');
    expect(component.manualDateError).toBe('Return date must be after departure.');
  });

  it('selects a popular destination', () => {
    component.selectDestination('Paris');

    expect(component.destination).toBe('Paris');
    expect(component.formError).toBe('');
  });

  it('keeps traveler count between one and ten', () => {
    component.travelers = 1;
    component.changeTravelers(-1);
    expect(component.travelers).toBe(1);

    component.travelers = 10;
    component.changeTravelers(1);
    expect(component.travelers).toBe(10);
  });

  it('rejects a return date that is not after departure', () => {
    component.departureDate = '2026-07-21';
    component.returnDate = '2026-07-21';

    component.continueToFlights({ invalid: false } as NgForm);

    expect(component.formError).toBe('Return date must be after the departure date.');
    expect(draftService.updateDraft).not.toHaveBeenCalled();
  });

  it('stores destination fields and navigates to flights', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    component.origin = ' Frankfurt ';
    component.destination = ' Barcelona ';

    component.continueToFlights({ invalid: false } as NgForm);

    expect(draftService.updateDraft).toHaveBeenCalledWith({
      origin: 'Frankfurt',
      destination: 'Barcelona',
      departureDate: '2026-07-14',
      returnDate: '2026-07-21',
      travelers: 2,
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/flights'], {
      queryParams: {
        from: 'Frankfurt',
        to: 'Barcelona',
        departureDate: '2026-07-14',
        returnDate: '2026-07-21',
        travelers: 2,
        tripType: 'round-trip',
      },
    });
  });

  it('allows multi-city mode to continue without a return date', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    component.tripType = 'multi-city';
    component.multiCitySegments = [
      { fromText: 'Frankfurt (FRA)', toText: 'Barcelona (BCN)', date: '2026-07-14' },
      { fromText: 'Barcelona (BCN)', toText: 'Paris (CDG)', date: '2026-07-16' },
    ];

    component.continueToFlights({ invalid: false } as NgForm);

    expect(component.formError).toBe('');
    expect(draftService.updateDraft).toHaveBeenCalledWith({
      origin: 'Frankfurt (FRA)',
      destination: 'Paris (CDG)',
      departureDate: '2026-07-14',
      returnDate: '2026-07-16',
      travelers: 2,
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/flights'], {
      queryParams: {
        tripType: 'multi-city',
        travelers: 2,
        multiCitySegments: JSON.stringify([
          { fromText: 'Frankfurt (FRA)', toText: 'Barcelona (BCN)', date: '2026-07-14' },
          { fromText: 'Barcelona (BCN)', toText: 'Paris (CDG)', date: '2026-07-16' },
        ]),
      },
    });
  });

  it('supports multi-city segment suggestions, dates, and adding cities', () => {
    component.setTripType('multi-city');
    component.updateMultiCityText(0, 'fromText', 'fra');

    expect(component.multiCityAirportSuggestions(0, 'fromText').map((airport) => airport.code)).toContain('FRA');

    const [frankfurt] = component.multiCityAirportSuggestions(0, 'fromText');
    component.selectMultiCityAirport(0, 'fromText', frankfurt);

    expect(component.multiCitySegments[0].fromText).toBe('Frankfurt (FRA)');

    component.toggleMultiCityDatePicker(0);
    component.selectCalendarDate(new Date(2026, 6, 18));

    expect(component.multiCitySegments[0].date).toBe('2026-07-18');

    component.addMultiCitySegment();

    expect(component.multiCitySegments.length).toBe(3);
    expect(component.multiCitySegments[2]).toEqual({
      fromText: '',
      toText: '',
      date: '2026-07-22',
    });
  });

  it('requires every multi-city segment before continuing', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    component.tripType = 'multi-city';
    component.multiCitySegments = [
      { fromText: 'Frankfurt (FRA)', toText: 'Barcelona (BCN)', date: '2026-07-14' },
      { fromText: 'Barcelona (BCN)', toText: '', date: '2026-07-16' },
    ];

    component.continueToFlights({ invalid: false } as NgForm);

    expect(component.formError).toBe('Complete each multi-city origin, destination, and date to continue.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
