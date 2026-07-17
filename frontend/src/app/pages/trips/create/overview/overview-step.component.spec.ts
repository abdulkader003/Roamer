import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FriendNotificationService } from '../../../../services/friend-notification.service';
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

  const createPdfExporterSpy = () => ({
    exportTripSummaryPdf: jasmine.createSpy('exportTripSummaryPdf').and.resolveTo(),
  });

  beforeEach(async () => {
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', [
      'getOverview',
      'getTrip',
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
    tripPlanningService.getTrip.and.returnValue(of({
      id: 44,
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
    calendarService = jasmine.createSpyObj<CalendarService>('CalendarService', ['addEvent', 'deleteEventsForTrip']);
    calendarService.addEvent.and.resolveTo({
      id: 1,
      title: 'Calendar event',
    } as never);
    calendarService.deleteEventsForTrip.and.resolveTo();
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
      selectedActivities: [
        {
          name: 'Picasso Museum',
          category: 'Arts & Culture',
          price: 120,
          duration: '2 hours',
          city: 'Barcelona',
          date: '16 Jul 2026',
          time: '10:00',
        },
      ],
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
        { provide: FriendNotificationService, useValue: { refresh: jasmine.createSpy('refresh') } },
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
    expect(fixture.nativeElement.textContent).toContain('Lufthansa');
    expect(fixture.nativeElement.textContent).toContain('Frankfurt');
    expect(fixture.nativeElement.textContent).toContain('Barcelona');
    expect(fixture.nativeElement.textContent).toContain('Check-in');
    expect(fixture.nativeElement.textContent).toContain('Check-out');
    expect(fixture.nativeElement.textContent).toContain('Picasso Museum');
    expect(fixture.nativeElement.textContent).toContain('16 Jul 2026');
    expect(component.flightSegments().length).toBe(1);
    expect(component.hotelStays().length).toBe(1);
    expect(component.hotelTotal()).toBe(3990);
    expect(component.activitiesTotal()).toBe(240);
    expect(component.totalUsed()).toBe(4986);
    expect(component.remaining()).toBe(-2986);
  });

  it('shows the Export Trip Summary button', () => {
    expect(fixture.nativeElement.textContent).toContain('Export Trip Summary');
  });

  it('shows Save Changes on the overview for an existing trip', () => {
    fixture.destroy();
    tripTempService.getTripTemp.and.returnValue({
      ...tripTempService.getTripTemp(),
      draftTripId: 44,
    });

    fixture = TestBed.createComponent(OverviewStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Save Changes');
    expect(fixture.nativeElement.textContent).not.toContain('Save Later');
  });

  it('exports the current overview data as a PDF', async () => {
    const exporter = createPdfExporterSpy();
    spyOn(component as any, 'loadPdfExporter').and.resolveTo(exporter);

    await component.exportTripSummary();

    expect(exporter.exportTripSummaryPdf).toHaveBeenCalledWith(component);
    const exportedSource = exporter.exportTripSummaryPdf.calls.mostRecent().args[0];
    expect(exportedSource.tripName()).toBe('Summer in Barcelona');
    expect(exportedSource.tripRouteSummary()).toBe('Barcelona');
    expect(exportedSource.dateRange()).toBe('2026-07-14 → 2026-07-21');
    expect(exportedSource.travelerLabel()).toBe('2 travelers');
    expect(exportedSource.flightTotal()).toBe(756);
    expect(exportedSource.hotelTotal()).toBe(3990);
    expect(exportedSource.activitiesTotal()).toBe(240);
    expect(exportedSource.flightSegments()[0]).toEqual(jasmine.objectContaining({
      airline: 'Lufthansa',
      from: 'Frankfurt (FRA)',
      to: 'Barcelona (BCN)',
      price: 756,
    }));
    expect(exportedSource.hotelStays()[0]).toEqual(jasmine.objectContaining({
      hotelName: 'Barcelona Grand',
      city: 'Barcelona',
      nights: 7,
      price: 3990,
    }));
    expect(exportedSource.activityGroups()[0].activities[0]).toEqual(jasmine.objectContaining({
      name: 'Picasso Museum',
      date: '16 Jul 2026',
      time: '10:00',
    }));
  });

  it('opens the export menu before generating the Overview PDF', async () => {
    const exporter = createPdfExporterSpy();
    spyOn(component as any, 'loadPdfExporter').and.resolveTo(exporter);
    const exportButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((button) => button.textContent.includes('Export Trip Summary')) as HTMLButtonElement;

    exportButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.export-menu')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Export as PDF');
    expect(exporter.exportTripSummaryPdf).not.toHaveBeenCalled();

    const pdfButton = fixture.nativeElement.querySelector('.export-menu-item') as HTMLButtonElement;
    pdfButton.click();
    await fixture.whenStable();

    expect(exporter.exportTripSummaryPdf).toHaveBeenCalled();
  });

  it('closes the Overview export menu on outside click and Escape', () => {
    component.toggleExportMenu();
    fixture.detectChanges();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.export-menu')).toBeNull();

    component.toggleExportMenu();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.export-menu')).toBeNull();
  });

  it('uses Destination dates instead of the Budget duration for overview nights and hotel totals', async () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    component.tripTemp.durationNights = 10;
    component.tripTemp.departureDate = '2026-07-01';
    component.tripTemp.returnDate = '2026-07-05';
    component.tripTemp.selectedHotelTotal = 1000;
    component.tripTemp.selectedHotels = [{
      hotelName: 'Barcelona Grand',
      city: 'Barcelona',
      checkIn: '2026-07-01',
      checkOut: '2026-07-05',
      nights: 10,
      stars: 5,
      price: 1000,
    }];
    component.overview.set({
      ...component.overview()!,
      duration: 10,
      selectedHotel: null,
    });
    fixture.detectChanges();

    expect(component.nights()).toBe(4);
    expect(component.hotelStays()[0].nights).toBe(4);
    expect(component.hotelTotal()).toBe(800);

    await component.saveLater();

    expect(tripPlanningService.createTrip).toHaveBeenCalledWith(jasmine.objectContaining({
      durationNights: 4,
      hotelTotal: 800,
      startDate: '2026-07-01',
      endDate: '2026-07-05',
    }));
    expect(navigateSpy).toHaveBeenCalledWith(['/trips']);
  });

  it('keeps hotel and activity totals unmultiplied for one traveler', () => {
    component.tripTemp.travelers = 1;
    component.tripTemp.selectedHotels = [{
      hotelName: 'Solo Stay',
      city: 'Barcelona',
      checkIn: '2026-07-14',
      checkOut: '2026-07-21',
      nights: 7,
      stars: 4,
      price: 700,
    }];
    component.tripTemp.selectedActivities = [{
      name: 'Walking Tour',
      category: 'Tours',
      price: 50,
      duration: '2 hours',
      city: 'Barcelona',
    }];
    component.overview.set({
      ...component.overview()!,
      selectedHotel: null,
      selectedActivities: [],
      totalActivitiesCost: 0,
    });

    expect(component.travelerLabel()).toBe('1 traveler');
    expect(component.hotelTotal()).toBe(700);
    expect(component.activitiesTotal()).toBe(50);
  });

  it('recalculates multi-city hotel stays from each city segment dates', () => {
    component.tripTemp.travelers = 1;
    component.tripTemp.returnDate = '2026-07-10';
    component.tripTemp.selectedFlightSegments = [
      {
        label: 'Segment 1',
        airline: 'Lufthansa',
        flightNumber: 'LH 1',
        from: 'Frankfurt (FRA)',
        to: 'Vienna (VIE)',
        date: '2026-07-01',
        departureTime: '08:00',
        arrivalTime: '09:00',
        duration: '1h',
        stops: 'Direct',
        price: 100,
      },
      {
        label: 'Segment 2',
        airline: 'Austrian',
        flightNumber: 'OS 2',
        from: 'Vienna (VIE)',
        to: 'Prague (PRG)',
        date: '2026-07-08',
        departureTime: '10:00',
        arrivalTime: '11:00',
        duration: '1h',
        stops: 'Direct',
        price: 120,
      },
      {
        label: 'Segment 3',
        airline: 'Lufthansa',
        flightNumber: 'LH 3',
        from: 'Prague (PRG)',
        to: 'Frankfurt (FRA)',
        date: '2026-07-10',
        departureTime: '16:00',
        arrivalTime: '17:00',
        duration: '1h',
        stops: 'Direct',
        price: 130,
      },
    ];
    component.tripTemp.selectedHotels = [
      {
        hotelName: 'Vienna Stay',
        city: 'Vienna',
        checkIn: '2026-07-01',
        checkOut: '2026-07-09',
        nights: 8,
        stars: 4,
        price: 800,
      },
      {
        hotelName: 'Prague Stay',
        city: 'Prague',
        checkIn: '2026-07-01',
        checkOut: '2026-07-09',
        nights: 8,
        stars: 4,
        price: 800,
      },
    ];
    component.overview.set({
      ...component.overview()!,
      selectedHotel: null,
    });

    expect(component.hotelStays()).toEqual([
      jasmine.objectContaining({
        city: 'Vienna',
        checkIn: '2026-07-01',
        checkOut: '2026-07-08',
        nights: 7,
        price: 700,
      }),
      jasmine.objectContaining({
        city: 'Prague',
        checkIn: '2026-07-08',
        checkOut: '2026-07-10',
        nights: 2,
        price: 200,
      }),
    ]);
    expect(component.hotelTotal()).toBe(900);
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
    expect(calendarService.deleteEventsForTrip).toHaveBeenCalledWith(99);
    expect(calendarService.deleteEventsForTrip).toHaveBeenCalledBefore(calendarService.addEvent);
    const calendarEvents = calendarService.addEvent.calls.allArgs().map((args) => args[0]);
    expect(calendarEvents.map((event) => event.category)).toEqual(['Flight', 'Hotel', 'Activity']);
    expect(calendarEvents.some((event) => event.category === 'Trip')).toBeFalse();
    expect(calendarEvents).toContain(jasmine.objectContaining({
      category: 'Flight',
      startDate: '2026-07-14',
      endDate: '2026-07-14',
      startTime: '07:10',
      endTime: '09:25',
    }));
    expect(calendarEvents).toContain(jasmine.objectContaining({
      category: 'Hotel',
      startDate: '2026-07-14',
      endDate: '2026-07-21',
    }));
    expect(calendarEvents).toContain(jasmine.objectContaining({
      category: 'Activity',
      title: 'Picasso Museum',
      startDate: '2026-07-16',
      endDate: '2026-07-16',
      startTime: '10:00',
    }));
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({ draftTripId: 99 });
    expect(navigateSpy).toHaveBeenCalledWith(['/trips']);
  });

  it('saves existing trip changes from the overview without changing its status', async () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    component.tripTemp.draftTripId = 44;
    tripPlanningService.getTrip.and.returnValue(of({
      id: 44,
      name: 'Summer in Barcelona',
      destination: 'Barcelona',
      startDate: '2026-07-14',
      endDate: '2026-07-21',
      budget: 2000,
      status: 'PLANNING',
      createdAt: '2026-06-20T18:00:00Z',
    }));

    await component.saveChanges();

    expect(tripPlanningService.getTrip).toHaveBeenCalledWith(44);
    expect(tripPlanningService.updateTrip).toHaveBeenCalledWith(44, jasmine.objectContaining({
      status: 'PLANNING',
      startDate: '2026-07-14',
      endDate: '2026-07-21',
    }));
    expect(calendarService.deleteEventsForTrip).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/trips']);
  });

  it('exports multi-city calendar events with item-specific dates only', async () => {
    spyOn(router, 'navigate').and.resolveTo(true);
    component.tripTemp.travelers = 1;
    component.tripTemp.returnDate = '2026-07-10';
    component.tripTemp.selectedFlightId = 'LH-1|OS-2|LH-3';
    component.tripTemp.selectedFlightSegments = [
      {
        label: 'Segment 1',
        airline: 'Lufthansa',
        flightNumber: 'LH 1',
        from: 'Frankfurt (FRA)',
        to: 'Vienna (VIE)',
        date: '2026-07-01',
        departureTime: '08:00',
        arrivalTime: '09:00',
        duration: '1h',
        stops: 'Direct',
        price: 100,
      },
      {
        label: 'Segment 2',
        airline: 'Austrian',
        flightNumber: 'OS 2',
        from: 'Vienna (VIE)',
        to: 'Prague (PRG)',
        date: '2026-07-08',
        departureTime: '10:00',
        arrivalTime: '11:00',
        duration: '1h',
        stops: 'Direct',
        price: 120,
      },
      {
        label: 'Segment 3',
        airline: 'Lufthansa',
        flightNumber: 'LH 3',
        from: 'Prague (PRG)',
        to: 'Frankfurt (FRA)',
        date: '2026-07-10',
        departureTime: '16:00',
        arrivalTime: '17:00',
        duration: '1h',
        stops: 'Direct',
        price: 130,
      },
    ];
    component.tripTemp.selectedHotels = [
      {
        hotelName: 'Vienna Stay',
        city: 'Vienna',
        checkIn: '2026-07-01',
        checkOut: '2026-07-08',
        nights: 7,
        stars: 4,
        price: 700,
      },
      {
        hotelName: 'Prague Stay',
        city: 'Prague',
        checkIn: '2026-07-08',
        checkOut: '2026-07-10',
        nights: 2,
        stars: 4,
        price: 200,
      },
    ];
    component.tripTemp.selectedActivities = [
      {
        name: 'Vienna Concert',
        category: 'Music',
        price: 50,
        duration: '2 hours',
        city: 'Vienna',
        date: '2026-07-03',
        time: '19:30 - 21:30',
      },
      {
        name: 'Undated Suggestion',
        category: 'Tours',
        price: 25,
        duration: '1 hour',
        city: 'Prague',
      },
    ];
    component.overview.set({
      ...component.overview()!,
      selectedHotel: null,
      selectedActivities: [],
      totalActivitiesCost: 0,
    });

    await component.confirmTrip();

    expect(calendarService.deleteEventsForTrip).toHaveBeenCalledWith(99);
    expect(calendarService.deleteEventsForTrip).toHaveBeenCalledBefore(calendarService.addEvent);
    const calendarEvents = calendarService.addEvent.calls.allArgs().map((args) => args[0]);
    expect(calendarEvents.some((event) => event.category === 'Trip')).toBeFalse();
    expect(calendarEvents.filter((event) => event.category === 'Flight').map((event) => event.startDate))
      .toEqual(['2026-07-01', '2026-07-08', '2026-07-10']);
    expect(calendarEvents).toContain(jasmine.objectContaining({
      category: 'Hotel',
      title: 'Hotel: Vienna Stay',
      startDate: '2026-07-01',
      endDate: '2026-07-08',
    }));
    expect(calendarEvents).toContain(jasmine.objectContaining({
      category: 'Hotel',
      title: 'Hotel: Prague Stay',
      startDate: '2026-07-08',
      endDate: '2026-07-10',
    }));
    expect(calendarEvents).toContain(jasmine.objectContaining({
      category: 'Activity',
      title: 'Vienna Concert',
      startDate: '2026-07-03',
      startTime: '19:30',
      endTime: '21:30',
    }));
    expect(calendarEvents.some((event) => event.title === 'Undated Suggestion')).toBeFalse();
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
    calendarService = jasmine.createSpyObj<CalendarService>('CalendarService', ['addEvent', 'deleteEventsForTrip']);
    calendarService.deleteEventsForTrip.and.resolveTo();

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
        { provide: FriendNotificationService, useValue: { refresh: jasmine.createSpy('refresh') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewStepComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Saved Draft Trip');
    expect(fixture.nativeElement.textContent).toContain('Showing the trip details saved in this browser');
    expect(fixture.nativeElement.textContent).toContain('Ryanair');
  });

  it('renders selected multi-city flight segments in saved order', async () => {
    TestBed.resetTestingModule();
    const multiCitySegments = JSON.stringify([
      { fromText: 'Paris (CDG)', toText: 'Berlin (BER)', date: '2026-09-01' },
      { fromText: 'Berlin (BER)', toText: 'Paris (CDG)', date: '2026-09-04' },
    ]);
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', ['getOverview', 'createTrip', 'updateTrip']);
    tripPlanningService.getOverview.and.returnValue(of({
      id: 10,
      tripName: 'Europe Loop',
      budget: 3000,
      currency: 'EUR',
      duration: 7,
      travelStyle: 'Mid-range',
      selectedHotel: null,
      selectedActivities: [],
      totalActivitiesCost: 0,
    }));
    calendarService = jasmine.createSpyObj<CalendarService>('CalendarService', ['addEvent', 'deleteEventsForTrip']);
    calendarService.deleteEventsForTrip.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [OverviewStepComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: { tripPlanningId: 10, tripType: 'multi-city', multiCitySegments },
              queryParamMap: convertToParamMap({ tripPlanningId: 10, tripType: 'multi-city', multiCitySegments }),
            },
          },
        },
        {
          provide: TripTempService,
          useValue: {
            getTripTemp: () => ({
              tripName: 'Europe Loop',
              budget: 3000,
              currency: 'EUR',
              durationNights: 7,
              travelStyle: 'Mid-range',
              origin: 'Berlin (BER)',
              destination: 'Berlin (BER)',
              destinationCities: ['Rome', 'Paris', 'Berlin'],
              departureDate: '2026-09-01',
              returnDate: '2026-09-07',
              travelers: 2,
              selectedFlightId: 'BER-FCO|FCO-CDG|CDG-BER',
              selectedFlightAirline: 'Lufthansa + Air France + Eurowings',
              selectedFlightNumber: 'LH 100 / AF 200 / EW 300',
              selectedFlightDepartureTime: '08:00',
              selectedFlightArrivalTime: '19:30',
              selectedFlightDuration: 'Segment 1 2h 05m · Segment 2 2h 15m · Segment 3 1h 50m',
              selectedFlightStops: 'Segment 1 Direct · Segment 2 Direct · Segment 3 Direct',
              selectedFlightTotal: 900,
              selectedFlightSegments: [
                {
                  label: 'Segment 1',
                  airline: 'Air France',
                  flightNumber: 'AF 100',
                  from: 'Paris (CDG)',
                  to: 'Rome (FCO)',
                  date: '2026-09-01',
                  departureTime: '08:00',
                  arrivalTime: '10:05',
                  duration: '2h 05m',
                  stops: 'Direct',
                  price: 300,
                },
                {
                  label: 'Segment 2',
                  airline: 'Lufthansa',
                  flightNumber: 'LH 200',
                  from: 'Rome (FCO)',
                  to: 'Berlin (BER)',
                  date: '2026-09-04',
                  departureTime: '15:30',
                  arrivalTime: '17:45',
                  duration: '2h 15m',
                  stops: 'Direct',
                  price: 600,
                },
              ],
              selectedHotelName: '',
              selectedHotelCity: '',
              selectedHotelStars: null,
              selectedHotelTotal: null,
              selectedActivities: [],
              selectedActivitiesTotal: 0,
            }),
            updateTripTemp: (changes: object) => changes,
          },
        },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: CalendarService, useValue: calendarService },
        { provide: FriendNotificationService, useValue: { refresh: jasmine.createSpy('refresh') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.flightSegments().length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Paris → Rome');
    expect(fixture.nativeElement.textContent).toContain('Rome → Berlin');
    expect(fixture.nativeElement.textContent).toContain('01 Sept 2026');
    expect(fixture.nativeElement.textContent).not.toContain('Paris → Berlin');
  });

  it('shows the full multi-city route in the blue summary card', async () => {
    TestBed.resetTestingModule();
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', ['getOverview', 'createTrip', 'updateTrip']);
    tripPlanningService.getOverview.and.returnValue(of({
      id: 10,
      tripName: 'Multi',
      budget: 3000,
      currency: 'EUR',
      duration: 6,
      travelStyle: 'Mid-range',
      selectedHotel: null,
      selectedActivities: [],
      totalActivitiesCost: 0,
    }));
    calendarService = jasmine.createSpyObj<CalendarService>('CalendarService', ['addEvent', 'deleteEventsForTrip']);
    calendarService.deleteEventsForTrip.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [OverviewStepComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: { tripPlanningId: 10, tripType: 'multi-city' },
              queryParamMap: convertToParamMap({ tripPlanningId: 10, tripType: 'multi-city' }),
            },
          },
        },
        {
          provide: TripTempService,
          useValue: {
            getTripTemp: () => ({
              tripName: 'Multi',
              budget: 3000,
              currency: 'EUR',
              durationNights: 6,
              travelStyle: 'Mid-range',
              origin: 'Frankfurt (FRA)',
              destination: 'Vienna (VIE)',
              destinationCities: ['Prague', 'Vienna'],
              departureDate: '2026-07-01',
              returnDate: '2026-07-07',
              travelers: 2,
              selectedFlightId: 'LH-1|OS-2',
              selectedFlightAirline: 'Lufthansa + Austrian',
              selectedFlightNumber: 'LH 1 / OS 2',
              selectedFlightDepartureTime: '08:00',
              selectedFlightArrivalTime: '11:00',
              selectedFlightDuration: 'Segment 1 1h · Segment 2 1h',
              selectedFlightStops: 'Segment 1 Direct · Segment 2 Direct',
              selectedFlightTotal: 440,
              selectedFlightSegments: [
                {
                  label: 'Segment 1',
                  airline: 'Lufthansa',
                  flightNumber: 'LH 1',
                  from: 'Frankfurt (FRA)',
                  to: 'Prague (PRG)',
                  date: '2026-07-01',
                  departureTime: '08:00',
                  arrivalTime: '09:00',
                  duration: '1h',
                  stops: 'Direct',
                  price: 200,
                },
                {
                  label: 'Segment 2',
                  airline: 'Austrian',
                  flightNumber: 'OS 2',
                  from: 'Prague (PRG)',
                  to: 'Vienna (VIE)',
                  date: '2026-07-04',
                  departureTime: '10:00',
                  arrivalTime: '11:00',
                  duration: '1h',
                  stops: 'Direct',
                  price: 240,
                },
              ],
              selectedHotelName: 'Vienna Stay',
              selectedHotelCity: 'Vienna',
              selectedHotelStars: 4,
              selectedHotelTotal: 1000,
              selectedHotels: [
                {
                  hotelName: 'Prague Stay',
                  city: 'Prague',
                  checkIn: '2026-07-01',
                  checkOut: '2026-07-04',
                  nights: 3,
                  stars: 4,
                  price: 600,
                },
                {
                  hotelName: 'Vienna Stay',
                  city: 'Vienna',
                  checkIn: '2026-07-04',
                  checkOut: '2026-07-07',
                  nights: 3,
                  stars: 4,
                  price: 700,
                },
              ],
              selectedActivities: [],
              selectedActivitiesTotal: 0,
            }),
            updateTripTemp: (changes: object) => changes,
          },
        },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: CalendarService, useValue: calendarService },
        { provide: FriendNotificationService, useValue: { refresh: jasmine.createSpy('refresh') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.tripRouteSummary()).toBe('Frankfurt → Prague → Vienna');
    expect(component.hotelGroups().map((group) => group.city)).toEqual(['Prague', 'Vienna']);
    expect(fixture.nativeElement.textContent).toContain('Frankfurt → Prague → Vienna');
    expect(fixture.nativeElement.textContent).toContain('Prague Stay');
    expect(fixture.nativeElement.textContent).toContain('Vienna Stay');
  });
});
