import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { EMPTY, of, throwError } from 'rxjs';

import { FriendCommunityService } from '../../../services/friend-community.service';
import { FriendNotificationService } from '../../../services/friend-notification.service';
import { RealtimeWebSocketService } from '../../../services/realtime-websocket.service';
import { TripPlanningService } from '../../../services/trip-planning.service';
import { TripTempService } from '../create/trip-temp.service';
import { TripComponent } from './trip.component';

describe('TripComponent', () => {
  let fixture: ComponentFixture<TripComponent>;
  let tripPlanningService: jasmine.SpyObj<TripPlanningService>;
  let tripTempService: jasmine.SpyObj<TripTempService>;
  let friendCommunityService: jasmine.SpyObj<FriendCommunityService>;
  let friendNotificationService: jasmine.SpyObj<FriendNotificationService>;
  let realtimeWebSocketService: jasmine.SpyObj<RealtimeWebSocketService>;

  const createPdfExporterSpy = () => ({
    exportTripSummaryPdf: jasmine.createSpy('exportTripSummaryPdf').and.resolveTo(),
  });

  beforeEach(async () => {
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', [
      'listSavedTrips',
      'updateTrip',
      'deleteTrip',
      'listIncomingTripInvitations',
      'listTripParticipants',
      'listSentTripInvitations',
      'observeTripUpdates',
      'acceptTripInvitation',
      'declineTripInvitation',
      'inviteFriendToTrip',
      'cancelTripInvitation',
      'leaveTrip',
    ]);
    tripPlanningService.listIncomingTripInvitations.and.returnValue(of([]));
    tripPlanningService.listTripParticipants.and.returnValue(of([
      {
        user: {
          id: 7,
          username: 'owner',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'owner@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        role: 'OWNER',
      },
    ]));
    tripPlanningService.listSentTripInvitations.and.returnValue(of([]));
    tripPlanningService.observeTripUpdates.and.returnValue(EMPTY);
    tripPlanningService.acceptTripInvitation.and.returnValue(of({ message: 'Trip invitation accepted.' }));
    tripPlanningService.declineTripInvitation.and.returnValue(of({ message: 'Trip invitation declined.' }));
    tripPlanningService.cancelTripInvitation.and.returnValue(of({ message: 'Trip invitation cancelled.' }));
    tripPlanningService.inviteFriendToTrip.and.returnValue(of({
      id: 1,
      trip: {
        id: 1,
        name: 'Summer in Italy',
        destination: 'Rome',
        startDate: '2026-07-15',
        endDate: '2026-07-22',
        budget: 2400,
        status: 'UPCOMING',
      },
      invitedBy: {
        id: 7,
        username: 'owner',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'owner@example.com',
        verified: true,
        profilePictureUpdatedAt: null,
      },
      invitedUser: {
        id: 9,
        username: 'friend',
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'friend@example.com',
        verified: true,
        profilePictureUpdatedAt: null,
      },
      status: 'PENDING',
      createdAt: '2026-06-20T18:00:00Z',
    }));
    tripPlanningService.leaveTrip.and.returnValue(of({ message: 'You left this trip.' }));
    tripTempService = jasmine.createSpyObj<TripTempService>('TripTempService', [
      'clearTripTemp',
      'getTripTemp',
      'updateTripTemp',
    ]);
    friendCommunityService = jasmine.createSpyObj<FriendCommunityService>('FriendCommunityService', ['listFriends']);
    friendCommunityService.listFriends.and.returnValue(of([]));
    friendNotificationService = jasmine.createSpyObj<FriendNotificationService>('FriendNotificationService', ['refresh']);
    realtimeWebSocketService = jasmine.createSpyObj<RealtimeWebSocketService>('RealtimeWebSocketService', ['observe']);
    realtimeWebSocketService.observe.and.returnValue(EMPTY);
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
        { provide: FriendCommunityService, useValue: friendCommunityService },
        { provide: FriendNotificationService, useValue: friendNotificationService },
        { provide: RealtimeWebSocketService, useValue: realtimeWebSocketService },
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
    expect(fixture.nativeElement.textContent).toContain('Participants');
    expect(fixture.nativeElement.textContent).toContain('No booking details saved for this trip');
  });

  it('shows pending sent invitations with a cancel action for the owner', () => {
    const trip = savedTrip({ id: 22, name: 'Shared Rome', status: 'UPCOMING' });
    tripPlanningService.listSavedTrips.and.returnValue(of([trip]));
    tripPlanningService.listSentTripInvitations.and.returnValue(of([
      {
        id: 44,
        trip: {
          id: 22,
          name: 'Shared Rome',
          destination: 'Rome',
          startDate: '2026-07-15',
          endDate: '2026-07-22',
          budget: 2400,
          status: 'UPCOMING',
        },
        invitedBy: {
          id: 7,
          username: 'owner',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'owner@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        invitedUser: {
          id: 9,
          username: 'friend',
          firstName: 'Grace',
          lastName: 'Hopper',
          email: 'friend@example.com',
          verified: true,
          profilePictureUpdatedAt: null,
        },
        status: 'PENDING',
        createdAt: '2026-06-20T18:00:00Z',
      },
    ]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();
    fixture.componentInstance.openTrip(trip);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pending invites');
    expect(fixture.nativeElement.textContent).toContain('Grace Hopper');

    const cancelButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === 'Cancel' && button.classList.contains('inline-danger-action')) as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();

    expect(tripPlanningService.cancelTripInvitation).toHaveBeenCalledWith(44);
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

  it('renders confirmed trip snapshots and hydrates them for Edit All Details', () => {
    const trip = {
      ...savedTrip({ id: 18, name: 'Confirmed Detail Trip', status: 'UPCOMING', destination: 'Barcelona' }),
      tripPlanningId: 44,
      origin: 'Frankfurt (FRA)',
      destinationCities: JSON.stringify(['Barcelona']),
      currency: 'EUR',
      durationNights: 7,
      travelStyle: 'Mid-range',
      travelers: 2,
      flightId: 'LH-1182',
      flightTitle: 'Lufthansa',
      flightAirline: 'Lufthansa',
      flightNumber: 'LH 1182',
      flightDepartureTime: '07:10',
      flightArrivalTime: '09:25',
      flightDuration: '2h 15m',
      flightStops: 'Direct',
      flightTotal: 756,
      flightSegmentsJson: JSON.stringify([
        {
          label: 'Outbound',
          airline: 'Lufthansa',
          flightNumber: 'LH 1182',
          from: 'Frankfurt (FRA)',
          to: 'Barcelona (BCN)',
          date: '2026-07-15',
          departureTime: '07:10',
          arrivalTime: '09:25',
          duration: '2h 15m',
          stops: 'Direct',
          price: 756,
        },
      ]),
      hotelName: 'Barcelona Grand',
      hotelCity: 'Barcelona',
      hotelStars: 5,
      hotelTotal: 1200,
      hotelStaysJson: JSON.stringify([
        {
          hotelName: 'Barcelona Grand',
          city: 'Barcelona',
          checkIn: '2026-07-15',
          checkOut: '2026-07-22',
          nights: 7,
          stars: 5,
          price: 1200,
        },
      ]),
      activitiesTitle: '1 selected',
      activitiesJson: JSON.stringify([
        {
          name: 'Picasso Museum',
          category: 'Arts & Culture',
          price: 28,
          duration: '2 hours',
          city: 'Barcelona',
          date: '16 Jul 2026',
          time: '10:00',
        },
      ]),
      activitiesTotal: 56,
    };
    tripPlanningService.listSavedTrips.and.returnValue(of([trip]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();
    fixture.componentInstance.openTrip(trip);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1 segment');
    expect(fixture.nativeElement.textContent).toContain('Frankfurt → Barcelona');
    expect(fixture.nativeElement.textContent).toContain('Check-in');
    expect(fixture.nativeElement.textContent).toContain('Barcelona Grand');
    expect(fixture.nativeElement.textContent).toContain('Picasso Museum');
    expect(fixture.nativeElement.textContent).toContain('16 Jul 2026');

    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.editTripInWizard();

    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith(jasmine.objectContaining({
      draftTripId: 18,
      tripPlanningId: 44,
      tripName: 'Confirmed Detail Trip',
      selectedFlightId: 'LH-1182',
      selectedFlightSegments: jasmine.any(Array),
      selectedHotelName: 'Barcelona Grand',
      selectedHotels: jasmine.any(Array),
      selectedActivities: jasmine.any(Array),
    }));
    expect(navigateSpy).toHaveBeenCalledWith(['/trips/create/budget'], {
      queryParams: { tripPlanningId: 44, tripType: 'round-trip' },
    });
  });

  it('exports the opened confirmed trip summary as a PDF', async () => {
    const trip = {
      ...savedTrip({ id: 19, name: 'Confirmed Export Trip', status: 'UPCOMING', destination: 'Barcelona' }),
      tripPlanningId: 44,
      origin: 'Frankfurt (FRA)',
      currency: 'EUR',
      travelers: 2,
      flightTotal: 756,
      flightSegmentsJson: JSON.stringify([
        {
          label: 'Outbound',
          airline: 'Lufthansa',
          flightNumber: 'LH 1182',
          from: 'Frankfurt (FRA)',
          to: 'Barcelona (BCN)',
          date: '2026-07-15',
          departureTime: '07:10',
          arrivalTime: '09:25',
          duration: '2h 15m',
          stops: 'Direct',
          price: 756,
        },
      ]),
      hotelName: 'Barcelona Grand',
      hotelCity: 'Barcelona',
      hotelStars: 5,
      hotelTotal: 1200,
      hotelStaysJson: JSON.stringify([
        {
          hotelName: 'Barcelona Grand',
          city: 'Barcelona',
          checkIn: '2026-07-15',
          checkOut: '2026-07-22',
          nights: 7,
          stars: 5,
          price: 1200,
        },
      ]),
      activitiesJson: JSON.stringify([
        {
          name: 'Picasso Museum',
          category: 'Arts & Culture',
          price: 28,
          duration: '2 hours',
          city: 'Barcelona',
          date: '16 Jul 2026',
          time: '10:00',
        },
      ]),
      activitiesTotal: 56,
    };
    const exporter = createPdfExporterSpy();
    tripPlanningService.listSavedTrips.and.returnValue(of([trip]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();
    spyOn(fixture.componentInstance as any, 'loadPdfExporter').and.resolveTo(exporter);
    fixture.componentInstance.openTrip(trip);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Export Trip Summary');

    const exportButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.includes('Export Trip Summary')) as HTMLButtonElement;
    exportButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.export-menu')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Export as PDF');
    expect(exporter.exportTripSummaryPdf).not.toHaveBeenCalled();

    const pdfButton = fixture.nativeElement.querySelector('.export-menu-item') as HTMLButtonElement;
    pdfButton.click();
    await fixture.whenStable();

    expect(exporter.exportTripSummaryPdf).toHaveBeenCalled();
    const exportedSource = exporter.exportTripSummaryPdf.calls.mostRecent().args[0];
    expect(exportedSource.tripName()).toBe('Confirmed Export Trip');
    expect(exportedSource.tripRouteSummary()).toBe('Barcelona');
    expect(exportedSource.dateRange()).toBe('15 Jul 2026 → 22 Jul 2026');
    expect(exportedSource.travelerLabel()).toBe('2 travelers');
    expect(exportedSource.flightTotal()).toBe(756);
    expect(exportedSource.hotelTotal()).toBe(1200);
    expect(exportedSource.activitiesTotal()).toBe(56);
    expect(exportedSource.flightSegments()[0]).toEqual(jasmine.objectContaining({
      airline: 'Lufthansa',
      from: 'Frankfurt (FRA)',
      to: 'Barcelona (BCN)',
    }));
    expect(exportedSource.hotelStays()[0]).toEqual(jasmine.objectContaining({
      hotelName: 'Barcelona Grand',
      city: 'Barcelona',
      nights: 7,
    }));
    expect(exportedSource.activityGroups()[0].activities[0]).toEqual(jasmine.objectContaining({
      name: 'Picasso Museum',
      date: '16 Jul 2026',
      time: '10:00',
    }));
  });

  it('closes the confirmed trip export menu on outside click and Escape', () => {
    const trip = savedTrip({ id: 20, name: 'Menu Trip', status: 'UPCOMING' });
    tripPlanningService.listSavedTrips.and.returnValue(of([trip]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();
    fixture.componentInstance.openTrip(trip);
    fixture.componentInstance.toggleExportMenu();
    fixture.detectChanges();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.export-menu')).toBeNull();

    fixture.componentInstance.toggleExportMenu();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.export-menu')).toBeNull();
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

  it('opens and cancels the delete confirmation dialog', () => {
    const trip = savedTrip({ id: 16, name: 'Dialog Trip', status: 'UPCOMING' });
    tripPlanningService.listSavedTrips.and.returnValue(of([trip]));

    fixture = TestBed.createComponent(TripComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.openTrip(trip);
    fixture.detectChanges();

    const deleteButton = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Delete Trip') as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.confirm-dialog')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Are you sure you want to delete this trip?');

    const cancelButton = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.confirm-dialog button'))
      .find((button) => button.textContent?.trim() === 'Cancel') as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.confirm-dialog')).toBeNull();
    expect(tripPlanningService.deleteTrip).not.toHaveBeenCalled();
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
