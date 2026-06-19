import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ActivitiesService } from '../../../../services/activities';
import { TripActivitiesResponse, TripPlanningService } from '../../../../services/trip-planning.service';
import { ActivitiesStepComponent } from './activities-step.component';

describe('ActivitiesStepComponent', () => {
  let fixture: ComponentFixture<ActivitiesStepComponent>;
  let component: ActivitiesStepComponent;
  let activitiesService: jasmine.SpyObj<ActivitiesService>;
  let tripPlanningService: jasmine.SpyObj<TripPlanningService>;
  let router: Router;

  function setup(queryParams: Record<string, string | string[]> = { tripPlanningId: '10' }) {
    TestBed.resetTestingModule();
    activitiesService = jasmine.createSpyObj<ActivitiesService>('ActivitiesService', ['getActivities']);
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', ['saveActivitiesStep']);
    activitiesService.getActivities.and.returnValue(of({
      items: [
        {
          id: 'activity-1',
          title: 'Picasso Museum',
          city: 'Barcelona',
          country: 'Spain',
          category: 'Arts & Culture',
          priceLevel: 'Budget',
          price: 28,
          rating: 4.7,
          timeOfDay: 'Morning',
          startDate: '2026-07-20T18:30:00',
          endDate: '2026-07-20T20:00:00',
          duration: '2 hours',
          venue: 'Museum',
          venueAddress: 'Carrer de Montcada 15',
          venuePostalCode: '08003',
          description: 'A classic museum visit.',
          source: 'ticketmaster',
          promoterName: 'Barcelona Events',
          image: 'museum.jpg',
        },
        {
          id: 'activity-2',
          title: 'Tapas Walk',
          city: 'Barcelona',
          country: 'Spain',
          category: 'Tours',
          priceLevel: 'Mid-Range',
          price: 64,
          rating: 4.8,
          timeOfDay: 'Evening',
          startDate: '2026-07-21T19:00:00',
          duration: '3 hours',
          venue: 'Gothic Quarter',
          description: 'Food tour.',
          source: 'ticketmaster',
          image: 'tour.jpg',
        },
      ],
      page: 0,
      size: 8,
      hasMore: false,
    }));

    TestBed.configureTestingModule({
      imports: [ActivitiesStepComponent],
      providers: [
        provideRouter([
          { path: 'trips/create/hotels', component: ActivitiesStepComponent },
        ]),
        { provide: ActivitiesService, useValue: activitiesService },
        { provide: TripPlanningService, useValue: tripPlanningService },
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

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ActivitiesStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();
    setup();
  });

  it('renders activities', () => {
    expect(activitiesService.getActivities).toHaveBeenCalledWith('Barcelona', undefined, 0, 8);
    expect(fixture.nativeElement.textContent).toContain('Picasso Museum');
  });

  it('displays real event details from the existing Activities API mapping', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Museum');
    expect(text).toContain('Carrer de Montcada 15, 08003, Barcelona');
    expect(text).toContain('A classic museum visit.');
    expect(text).toContain('20 Jul 2026');
    expect(text).toContain('18:30');
    expect(text).toContain('Start Time');
    expect(text).toContain('End Time');
    expect(text).toContain('Rating 4.7');
    expect(text).toContain('Barcelona Events');
  });

  it('hides unavailable event details instead of showing placeholders', () => {
    activitiesService.getActivities.and.returnValue(of({
      items: [
        {
          id: 'activity-with-missing-details',
          title: 'Open Air Walk',
          city: 'Barcelona',
          country: 'Spain',
          category: 'Tours',
          priceLevel: 'Budget',
          price: 12,
          rating: 0,
          timeOfDay: 'Any Time',
          duration: '',
          venue: '',
          venueAddress: '',
          description: 'A simple outdoor route.',
          image: 'walk.jpg',
        },
      ],
      page: 0,
      size: 8,
      hasMore: false,
    }));

    component.loadActivities();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Open Air Walk');
    expect(text).not.toContain('Unknown');
    expect(text).not.toContain('N/A');
    expect(text).not.toContain('Not available');
    expect(text).not.toContain('Start Time');
  });

  it('does not render the planning suggestion source badge', () => {
    activitiesService.getActivities.and.returnValue(of({
      items: [],
      page: 0,
      size: 8,
      hasMore: false,
    }));

    component.loadActivities();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Planning suggestion');
  });

  it('renders detail fields in the expected order', () => {
    const text = fixture.nativeElement.textContent;
    const locationIndex = text.indexOf('Location');
    const dateIndex = text.indexOf('Date');
    const startTimeIndex = text.indexOf('Start Time');
    const endTimeIndex = text.indexOf('End Time');
    const durationIndex = text.indexOf('Duration');

    expect(locationIndex).toBeGreaterThan(-1);
    expect(dateIndex).toBeGreaterThan(locationIndex);
    expect(startTimeIndex).toBeGreaterThan(dateIndex);
    expect(endTimeIndex).toBeGreaterThan(startTimeIndex);
    expect(durationIndex).toBeGreaterThan(endTimeIndex);
  });

  it('selects and deselects activities', () => {
    const activity = component.activities()[0];

    component.toggleActivity(activity);
    expect(component.isSelected(activity)).toBeTrue();

    component.toggleActivity(activity);
    expect(component.isSelected(activity)).toBeFalse();
  });

  it('updates selected total and count', () => {
    component.toggleActivity(component.activities()[0]);
    component.toggleActivity(component.activities()[1]);
    fixture.detectChanges();

    expect(component.selectedCount()).toBe(2);
    expect(component.selectedTotal()).toBe(92);
    expect(fixture.nativeElement.textContent).toContain('€92');
    expect(fixture.nativeElement.textContent).toContain('2 added');
  });

  it('navigates previous to hotels', () => {
    spyOn(router, 'navigate');

    component.goToPreviousStep();

    expect(router.navigate).toHaveBeenCalledWith(['/trips/create/hotels'], {
      queryParams: { tripPlanningId: 10 },
    });
  });

  it('saves selected activities on continue', () => {
    const response: TripActivitiesResponse = {
      tripPlanningId: 10,
      selectedActivities: [],
      totalActivitiesCost: 0,
      selectedActivitiesCount: 0,
    };
    const saveResult = new Subject<TripActivitiesResponse>();
    tripPlanningService.saveActivitiesStep.and.returnValue(saveResult);
    component.toggleActivity(component.activities()[0]);

    component.continueToOverview();

    expect(tripPlanningService.saveActivitiesStep).toHaveBeenCalledWith(10, {
      activities: [
        {
          name: 'Picasso Museum',
          category: 'Arts & Culture',
          price: 28,
          duration: '2 hours',
          city: 'Barcelona',
        },
      ],
    });

    saveResult.next(response);
    saveResult.complete();
  });

  it('allows continuing with zero activities', () => {
    tripPlanningService.saveActivitiesStep.and.returnValue(of({
      tripPlanningId: 10,
      selectedActivities: [],
      totalActivitiesCost: 0,
      selectedActivitiesCount: 0,
    }));

    component.continueToOverview();

    expect(tripPlanningService.saveActivitiesStep).toHaveBeenCalledWith(10, { activities: [] });
  });

  it('shows an error when saving fails', () => {
    tripPlanningService.saveActivitiesStep.and.returnValue(throwError(() => new Error('Save failed')));

    component.continueToOverview();
    fixture.detectChanges();

    expect(component.saveError()).toContain('Could not save your activities');
    expect(fixture.nativeElement.textContent).toContain('Could not save your activities');
  });

  it('groups activities for multiple cities', () => {
    setup({ tripPlanningId: '10', city: ['Barcelona', 'Paris'] });

    expect(activitiesService.getActivities).toHaveBeenCalledWith('Barcelona', undefined, 0, 8);
    expect(activitiesService.getActivities).toHaveBeenCalledWith('Paris', undefined, 0, 8);
    expect(component.cityGroups().map((group) => group.city)).toEqual(['Barcelona', 'Paris']);
  });

  it('filters duplicate API activities', () => {
    activitiesService.getActivities.and.returnValue(of({
      items: [
        {
          id: 'duplicate-1',
          title: 'Antarctica Experience',
          city: 'Barcelona',
          country: 'Spain',
          category: 'Leisure',
          priceLevel: 'Budget',
          price: 20,
          rating: 4.1,
          timeOfDay: 'Afternoon',
          startDate: '2026-07-22T15:00:00',
          duration: '2 hours',
          venue: 'Expo Hall',
          description: 'Immersive exhibition.',
          image: 'event.jpg',
        },
        {
          id: 'duplicate-2',
          title: 'Antarctica Experience',
          city: 'Barcelona',
          country: 'Spain',
          category: 'Leisure',
          priceLevel: 'Budget',
          price: 20,
          rating: 4.1,
          timeOfDay: 'Afternoon',
          startDate: '2026-07-22T15:00:00',
          duration: '2 hours',
          venue: 'Expo Hall',
          description: 'Immersive exhibition.',
          image: 'event.jpg',
        },
      ],
      page: 0,
      size: 8,
      hasMore: false,
    }));

    component.loadActivities();
    fixture.detectChanges();

    expect(component.activities().length).toBe(6);
    expect(fixture.nativeElement.textContent.match(/Antarctica Experience/g)?.length).toBe(1);
    expect(new Set(component.activities().map((activity) => activity.name)).size).toBe(6);
  });

  it('shows the same event with different times only once and prefers the cheaper row', () => {
    activitiesService.getActivities.and.returnValue(of({
      items: [
        {
          id: 'timeslot-1',
          title: 'Antarctica Experience',
          city: 'Barcelona',
          country: 'Spain',
          category: 'Leisure',
          priceLevel: 'Budget',
          price: 24,
          rating: 4.1,
          timeOfDay: 'Afternoon',
          startDate: '2026-07-22T15:00:00',
          duration: '2 hours',
          venue: 'Expo Hall',
          description: 'Immersive exhibition.',
          image: 'event.jpg',
        },
        {
          id: 'timeslot-2',
          title: 'Antarctica Experience',
          city: 'Barcelona',
          country: 'Spain',
          category: 'Leisure',
          priceLevel: 'Budget',
          price: 18,
          rating: 4.1,
          timeOfDay: 'Evening',
          startDate: '2026-07-22T19:00:00',
          duration: '2 hours',
          venue: 'Expo Hall',
          description: 'Immersive exhibition.',
          image: 'event.jpg',
        },
      ],
      page: 0,
      size: 8,
      hasMore: false,
    }));

    component.loadActivities();
    fixture.detectChanges();

    const antarcticaActivities = component.activities().filter((activity) => activity.name === 'Antarctica Experience');
    expect(antarcticaActivities.length).toBe(1);
    expect(antarcticaActivities[0].price).toBe(18);
  });

  it('uses varied fallback suggestions only when API has no usable activities', () => {
    activitiesService.getActivities.and.returnValue(of({
      items: [],
      page: 0,
      size: 8,
      hasMore: false,
    }));

    component.loadActivities();
    fixture.detectChanges();

    expect(component.activities().length).toBe(6);
    expect(new Set(component.activities().map((activity) => activity.name)).size).toBe(6);
    expect(fixture.nativeElement.textContent).not.toContain('Using planning suggestions');
  });

  it('tops up with varied fallback suggestions when API has too few unique activities', () => {
    activitiesService.getActivities.and.returnValue(of({
      items: [
        {
          id: 'activity-1',
          title: 'Picasso Museum',
          city: 'Barcelona',
          country: 'Spain',
          category: 'Arts & Culture',
          priceLevel: 'Budget',
          price: 28,
          rating: 4.7,
          timeOfDay: 'Morning',
          startDate: '2026-07-20T18:30:00',
          duration: '2 hours',
          venue: 'Museum',
          description: 'A classic museum visit.',
          source: 'ticketmaster',
          image: 'museum.jpg',
        },
      ],
      page: 0,
      size: 8,
      hasMore: false,
    }));

    component.loadActivities();
    fixture.detectChanges();

    expect(component.activities().length).toBe(6);
    expect(component.activities()[0].name).toBe('Picasso Museum');
    expect(new Set(component.activities().map((activity) => activity.name)).size).toBe(6);
  });
});
