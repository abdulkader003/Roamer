import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CalendarService } from '../hotels/services/calendar.service';
import { FlightsComponent } from './flights.component';
import { FlightsService } from './flights.service';

describe('FlightsComponent destination handoff', () => {
  let fixture: ComponentFixture<FlightsComponent>;
  let flightService: jasmine.SpyObj<FlightsService>;
  let calendarService: jasmine.SpyObj<CalendarService>;

  function createComponentWithQuery(queryParams: Record<string, string>): FlightsComponent {
    flightService = jasmine.createSpyObj<FlightsService>('FlightsService', ['search']);
    flightService.search.and.returnValue(of({
      searchId: 1,
      tripType: 'round-trip',
      from: { code: 'FRA', city: 'Frankfurt', fullName: 'Frankfurt Airport' },
      to: { code: 'BCN', city: 'Barcelona', fullName: 'Barcelona-El Prat' },
      departureDate: '2026-07-14',
      returnDate: '2026-07-21',
      multiCitySegments: [],
      travelers: 1,
      adults: 1,
      children: 0,
      cabinClass: 'economy',
      flights: [],
      outboundFlights: [],
      returnFlights: [],
      segmentFlights: [],
    }));
    calendarService = jasmine.createSpyObj<CalendarService>('CalendarService', ['addEventOrRedirectToLogin']);
    calendarService.addEventOrRedirectToLogin.and.resolveTo('added');

    TestBed.configureTestingModule({
      imports: [FlightsComponent],
      providers: [
        provideRouter([]),
        { provide: FlightsService, useValue: flightService },
        { provide: CalendarService, useValue: calendarService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(FlightsComponent);
    fixture.detectChanges();

    return fixture.componentInstance;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('prefills a round trip from the destination step query params', () => {
    const component = createComponentWithQuery({
      tripType: 'round-trip',
      from: 'Frankfurt (FRA)',
      to: 'Barcelona (BCN)',
      departureDate: '2026-07-14',
      returnDate: '2026-07-21',
      travelers: '3',
    });

    expect(component.tripType()).toBe('round-trip');
    expect(component.from().code).toBe('FRA');
    expect(component.to().code).toBe('BCN');
    expect(component.fromText()).toBe('Frankfurt (FRA)');
    expect(component.toText()).toBe('Barcelona (BCN)');
    expect(component.formatDateInput(component.departureDate())).toBe('2026-07-14');
    expect(component.formatDateInput(component.returnDate())).toBe('2026-07-21');
    expect(component.travelers()).toBe(3);
  });

  it('prefills multi-city segments from the destination step query params', () => {
    const segments = [
      { fromText: 'Frankfurt (FRA)', toText: 'Barcelona (BCN)', date: '2026-07-14' },
      { fromText: 'Barcelona (BCN)', toText: 'Paris (CDG)', date: '2026-07-16' },
    ];
    const component = createComponentWithQuery({
      tripType: 'multi-city',
      travelers: '2',
      multiCitySegments: JSON.stringify(segments),
    });

    expect(component.tripType()).toBe('multi-city');
    expect(component.multiCitySegments().map((segment) => ({
      fromText: segment.fromText,
      toText: segment.toText,
      date: component.formatDateInput(segment.date),
    }))).toEqual(segments);
    expect(component.from().code).toBe('FRA');
    expect(component.to().code).toBe('CDG');
    expect(component.departureDate()).toEqual(component.multiCitySegments()[0].date);
  });
});
