import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TripPlanningService } from '../../../../services/trip-planning.service';
import { CalendarService } from '../../../hotels/services/calendar.service';
import { TripTempService } from '../trip-temp.service';
import { OverviewStepComponent } from './overview-step.component';

describe('OverviewStepComponent', () => {
  let fixture: ComponentFixture<OverviewStepComponent>;
  let component: OverviewStepComponent;
  let tripPlanningService: jasmine.SpyObj<TripPlanningService>;
  let calendarService: jasmine.SpyObj<CalendarService>;
  let tripTempService: jasmine.SpyObj<TripTempService>;
  let router: Router;

  beforeEach(async () => {
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', [
      'getOverview',
      'createTrip',
      'updateTrip',
    ]);
    tripPlanningService.getOverview.and.returnValue(of({
      id: 10,
      tripName: 'Summer in Barcelona',
      budget: 2000,
      currency: 'EUR',
      duration: 7,
      travelStyle: 'Mid-range',
      selectedHotel: {
        tripPlanningId: 10,
        hotelId: 77,
        hotelName: 'Barcelona Grand',
        hotelCity: 'Barcelona',
        pricePerNight: 285,
        stars: 5,
        ratingScore: 9.1,
        ratingLabel: 'Superb',
      },
      selectedActivities: [
        {
          name: 'Picasso Museum',
          category: 'Arts & Culture',
          price: 120,
          duration: '2 hours',
          city: 'Barcelona',
        },
      ],
      totalActivitiesCost: 120,
    }));
    tripPlanningService.createTrip.and.returnValue(of({
      id: 99,
      name: 'Summer in Barcelona',
      destination: 'Barcelona',
      startDate: '2026-07-14',
      endDate: '2026-07-21',
      budget: 2000,
      status: 'UPCOMING',
      createdAt: '2026-06-20T18:00:00Z',
    }));
    tripPlanningService.updateTrip.and.returnValue(of({
      id: 44,
      name: 'Summer in Barcelona',
      destination: 'Barcelona',
      startDate: '2026-07-14',
      endDate: '2026-07-21',
      budget: 2000,
      status: 'UPCOMING',
      createdAt: '2026-06-20T18:00:00Z',
    }));
    calendarService = jasmine.createSpyObj<CalendarService>('CalendarService', ['addEvent']);
    calendarService.addEvent.and.resolveTo({
      id: 1,
      title: 'Calendar event',
    } as never);
    tripTempService = jasmine.createSpyObj<TripTempService>('TripTempService', ['getTripTemp', 'updateTripTemp']);
    tripTempService.getTripTemp.and.returnValue({
      tripName: 'Summer in Barcelona',
      budget: 2000,
      currency: 'EUR',
      durationNights: 7,
      travelStyle: 'Mid-range',
      origin: 'Frankfurt (FRA)',
      destination: 'Barcelona (BCN)',
      destinationCities: [],
      departureDate: '2026-07-14',
      returnDate: '2026-07-21',
      travelers: 2,
      selectedFlightId: 'LH 1182',
      selectedFlightAirline: 'Lufthansa',
      selectedFlightNumber: 'LH 1182',
      selectedFlightDepartureTime: '07:10',
      selectedFlightArrivalTime: '09:25',
      selectedFlightDuration: '2h 15m',
      selectedFlightStops: 'Direct',
      selectedFlightTotal: 756,
      selectedHotelName: '',
      selectedHotelCity: '',
      selectedHotelStars: null,
      selectedHotelTotal: null,
      selectedActivities: [],
      selectedActivitiesTotal: 0,
    });
    tripTempService.updateTripTemp.and.callFake((changes) => ({
      ...tripTempService.getTripTemp(),
      ...changes,
    }));

    await TestBed.configureTestingModule({
      imports: [OverviewStepComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: { tripPlanningId: 10 },
              queryParamMap: convertToParamMap({ tripPlanningId: 10 }),
            },
          },
        },
        {
          provide: TripTempService,
          useValue: tripTempService,
        },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: CalendarService, useValue: calendarService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewStepComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('loads and renders the trip overview', () => {
    expect(tripPlanningService.getOverview).toHaveBeenCalledWith(10);
    expect(fixture.nativeElement.textContent).toContain('Your trip is ready.');
    expect(fixture.nativeElement.textContent).toContain('Summer in Barcelona');
    expect(fixture.nativeElement.textContent).toContain('Barcelona Grand');
    expect(fixture.nativeElement.textContent).toContain('Picasso Museum');
    expect(component.totalUsed()).toBe(2871);
    expect(component.remaining()).toBe(-871);
  });

  it('confirms the trip, exports calendar events, and returns to trips', async () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    await component.confirmTrip();

    expect(tripPlanningService.createTrip).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Summer in Barcelona',
      destination: 'Barcelona',
      startDate: '2026-07-14',
      endDate: '2026-07-21',
      budget: 2000,
      status: 'UPCOMING',
    }));
    expect(calendarService.addEvent).toHaveBeenCalled();
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({ draftTripId: 99 });
    expect(navigateSpy).toHaveBeenCalledWith(['/trips']);
  });

  it('saves the trip as a draft without exporting calendar events', async () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    await component.saveLater();

    expect(tripPlanningService.createTrip).toHaveBeenCalledWith(jasmine.objectContaining({
      status: 'PLANNING',
    }));
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({ draftTripId: 99 });
    expect(calendarService.addEvent).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/trips']);
  });

  it('keeps the saved trip id when calendar export fails', async () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    calendarService.addEvent.and.rejectWith(new Error('calendar down'));

    await component.confirmTrip();

    expect(tripPlanningService.createTrip).toHaveBeenCalled();
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({ draftTripId: 99 });
    expect(component.saveError()).toBe('Trip saved, but it could not be exported to the calendar.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('shows saved wizard details if the overview request fails', async () => {
    TestBed.resetTestingModule();
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', ['getOverview', 'createTrip', 'updateTrip']);
    tripPlanningService.getOverview.and.returnValue(throwError(() => new Error('backend down')));
    calendarService = jasmine.createSpyObj<CalendarService>('CalendarService', ['addEvent']);

    await TestBed.configureTestingModule({
      imports: [OverviewStepComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: { tripPlanningId: 10 },
              queryParamMap: convertToParamMap({ tripPlanningId: 10 }),
            },
          },
        },
        {
          provide: TripTempService,
          useValue: {
            getTripTemp: () => ({
              tripName: 'Saved Draft Trip',
              budget: 1200,
              currency: 'EUR',
              durationNights: 4,
              travelStyle: 'Budget',
              origin: 'Dusseldorf (DUS)',
              destination: 'Milan (MXP)',
              departureDate: '2026-08-01',
              returnDate: '2026-08-05',
              travelers: 2,
              selectedFlightId: 'FR 3456',
              selectedFlightAirline: 'Ryanair',
              selectedFlightNumber: 'FR 3456',
              selectedFlightDepartureTime: '14:20',
              selectedFlightArrivalTime: '16:30',
              selectedFlightDuration: '2h 10m',
              selectedFlightStops: 'Direct',
              selectedFlightTotal: 134,
              selectedHotelName: 'Milan Central Stay',
              selectedHotelCity: 'Milan',
              selectedHotelStars: 4,
              selectedHotelTotal: 480,
              selectedActivities: [
                {
                  name: 'Duomo Rooftop',
                  category: 'Sightseeing',
                  price: 45,
                  duration: '2 hours',
                  city: 'Milan',
                },
              ],
              selectedActivitiesTotal: 45,
            }),
          },
        },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: CalendarService, useValue: calendarService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewStepComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Saved Draft Trip');
    expect(fixture.nativeElement.textContent).toContain('Showing the trip details saved in this browser');
    expect(fixture.nativeElement.textContent).toContain('Ryanair');
  });
});
