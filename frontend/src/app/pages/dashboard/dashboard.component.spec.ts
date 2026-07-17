import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { BudgetApiService, BudgetCategoryResponse } from '../../services/budget-api.service';
import { AuthService } from '../../services/auth';
import { ThemeService } from '../../services/theme.service';
import { TripPlanningService, TripResponse } from '../../services/trip-planning.service';
import { WeatherDto, WeatherService } from '../../services/weather.service';
import { ActivitiesService, Activity } from '../../services/activities';
import { CalendarService } from '../hotels/services/calendar.service';
import { DashboardComponent, DESTINATION_WEATHER_CITIES } from './dashboard.component';
import {
  RECOMMENDED_EXPERIENCE_CITY_BATCH_SIZE,
  RECOMMENDED_EXPERIENCE_EUROPEAN_CITIES
} from '../../services/recommended-experience-cities';

function sortedValues(values: readonly string[]): string[] {
  return [...values].sort((first, second) => first.localeCompare(second));
}

function weatherFor(cities: readonly string[]): WeatherDto[] {
  return cities.map((city) => ({
    city,
    temperatureC: 21,
    condition: 'Clear sky',
    icon: null,
    humidity: 50,
    windKph: 10,
    error: null
  }));
}

function tripResponse(overrides: Partial<TripResponse>): TripResponse {
  return {
    id: 1,
    name: 'Paris Summer',
    destination: 'Paris, France',
    startDate: '2027-06-15',
    endDate: '2027-06-22',
    budget: 1200,
    status: 'UPCOMING',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'tm-1',
    title: 'FIFA Fan Festival',
    city: 'Barcelona',
    country: 'Spain',
    category: 'Sports',
    priceLevel: 'Budget',
    price: 35,
    rating: 4.7,
    timeOfDay: 'Evening',
    duration: '2 hours',
    venue: 'Olympic Stadium',
    description: 'A football celebration with live entertainment.',
    image: 'https://example.com/fifa.jpg',
    startDate: '2026-06-12T19:30:00',
    source: 'Ticketmaster',
    genre: 'Football',
    url: 'https://ticketmaster.example/fifa-fan-festival',
    ...overrides
  };
}

describe('DashboardComponent weather rotation', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let budgetApiService: jasmine.SpyObj<BudgetApiService>;
  let weatherService: jasmine.SpyObj<WeatherService>;
  let tripPlanningService: jasmine.SpyObj<TripPlanningService>;
  let tripUpdateEvents: Subject<{
    eventType: string;
    notificationType: 'TRIP_UPDATE' | 'TRIP_BUDGET_UPDATE';
    notificationId: number;
    tripId: number;
    title: string;
    description: string;
    details?: string | null;
    createdAt: string;
  }>;
  let activitiesService: jasmine.SpyObj<ActivitiesService>;
  let calendarService: jasmine.SpyObj<CalendarService>;

  beforeEach(async () => {
    budgetApiService = jasmine.createSpyObj<BudgetApiService>('BudgetApiService', ['getSummary', 'getCategoryBudgets']);
    budgetApiService.getSummary.and.returnValue(of({
      totalBudget: 0,
      totalSpent: 0,
      remainingBalance: 0,
      usagePercentage: 0
    }));
    budgetApiService.getCategoryBudgets.and.returnValue(of([]));
    weatherService = jasmine.createSpyObj<WeatherService>('WeatherService', ['getWeather']);
    weatherService.getWeather.and.callFake((cities: readonly string[]) => of(weatherFor(cities)));
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', ['listSavedTrips', 'getTrip', 'observeTripUpdates']);
    tripUpdateEvents = new Subject<{
      eventType: string;
      notificationType: 'TRIP_UPDATE' | 'TRIP_BUDGET_UPDATE';
      notificationId: number;
      tripId: number;
      title: string;
      description: string;
      details?: string | null;
      createdAt: string;
    }>();
    tripPlanningService.listSavedTrips.and.returnValue(of([]));
    activitiesService = jasmine.createSpyObj<ActivitiesService>('ActivitiesService', ['getActivities']);
    activitiesService.getActivities.and.callFake((city?: string, keyword?: string) => {
      const targetCity = city ?? 'Barcelona';
      const cityCategories: Record<string, { genre: string; title: string; country: string }> = {
        Berlin: { genre: 'Concerts', title: 'Open Air Concert', country: 'Germany' },
        Munich: { genre: 'Festivals', title: 'Summer Festival', country: 'Germany' },
        Hamburg: { genre: 'Theatre', title: 'Harbor Theatre Night', country: 'Germany' },
        Cologne: { genre: 'Family', title: 'Cologne Family Fair', country: 'Germany' },
        Paris: { genre: 'Arts', title: 'Modern Art Exhibition', country: 'France' },
        Lyon: { genre: 'Food & Drink', title: 'Lyon Food Market', country: 'France' },
        Marseille: { genre: 'Concerts', title: 'Marseille Live Night', country: 'France' },
        Nice: { genre: 'Festivals', title: 'Nice Summer Festival', country: 'France' },
        Madrid: { genre: 'Comedy', title: 'Comedy Showcase', country: 'Spain' },
        Barcelona: { genre: 'Museums', title: 'Modern Art Exhibition', country: 'Spain' },
        Valencia: { genre: 'Family', title: 'Family Science Day', country: 'Spain' },
        Seville: { genre: 'Concerts', title: 'Seville Guitar Night', country: 'Spain' },
        Rome: { genre: 'Food & Drink', title: 'Roman Food Market', country: 'Italy' },
        Milan: { genre: 'Theatre', title: 'Milan Musical Night', country: 'Italy' },
        Florence: { genre: 'Arts', title: 'Florence Gallery Evening', country: 'Italy' },
        Naples: { genre: 'Festivals', title: 'Naples Street Festival', country: 'Italy' },
        Amsterdam: { genre: 'Concerts', title: 'Canal Jazz Concert', country: 'Netherlands' },
        Rotterdam: { genre: 'Sports', title: 'Rotterdam Sports Night', country: 'Netherlands' },
        Brussels: { genre: 'Food & Drink', title: 'Brussels Food Walk', country: 'Belgium' },
        Antwerp: { genre: 'Arts', title: 'Antwerp Design Expo', country: 'Belgium' },
        Vienna: { genre: 'Music', title: 'Classical Music Evening', country: 'Austria' },
        Salzburg: { genre: 'Music', title: 'Salzburg Concert Hall', country: 'Austria' },
        Prague: { genre: 'Cultural Events', title: 'Old Town Culture Walk', country: 'Czech Republic' },
        Budapest: { genre: 'Theatre', title: 'Budapest Stage Night', country: 'Hungary' },
        Lisbon: { genre: 'Festivals', title: 'Lisbon Street Festival', country: 'Portugal' },
        Porto: { genre: 'Food & Drink', title: 'Porto Wine Market', country: 'Portugal' },
        Copenhagen: { genre: 'Family', title: 'Harbor Family Day', country: 'Denmark' },
        Stockholm: { genre: 'Concerts', title: 'Stockholm Pop Night', country: 'Sweden' },
        Oslo: { genre: 'Museums', title: 'Oslo Museum Evening', country: 'Norway' },
        Dublin: { genre: 'Comedy', title: 'Dublin Comedy Club', country: 'Ireland' },
        Athens: { genre: 'Cultural Events', title: 'Athens Culture Walk', country: 'Greece' },
        Zurich: { genre: 'Sports', title: 'Zurich Sports Festival', country: 'Switzerland' },
      };
      const cityCategory = cityCategories[targetCity] ?? {
        genre: 'Cultural Events',
        title: `City Experience ${targetCity}`,
        country: 'Global'
      };
      const worldCupKeywords = ['football', 'soccer', 'FIFA', 'World Cup', 'fan festival', 'sports'];
      const items = worldCupKeywords.includes(keyword ?? '')
        ? [
          activity({
            id: `football-${targetCity}`,
            title: `FIFA Fan Festival ${targetCity}`,
            city: targetCity,
            country: cityCategory.country
          }),
          activity({
            id: `local-${targetCity}`,
            title: `${cityCategory.title} ${targetCity}`,
            city: targetCity,
            country: cityCategory.country,
            genre: cityCategory.genre,
            category: cityCategory.genre,
            description: `A ${cityCategory.genre.toLowerCase()} event in ${targetCity}.`
          })
        ]
        : [
          activity({
            id: `general-${targetCity}-${keyword || 'all'}`,
            title: `${cityCategory.title} ${targetCity}`,
            city: targetCity,
            country: cityCategory.country,
            genre: cityCategory.genre,
            category: cityCategory.genre,
            description: `A ${cityCategory.genre.toLowerCase()} event in ${targetCity}.`
          })
        ];

      return of({
        items,
        page: 0,
        size: 6,
        hasMore: false
      });
    });
    calendarService = jasmine.createSpyObj<CalendarService>('CalendarService', ['addEvent']);
    calendarService.addEvent.and.resolveTo({
      id: 1,
      title: 'FIFA Fan Festival',
      startDateTime: '2026-06-12T19:30:00',
      endDateTime: '2026-06-12T23:59:00',
      category: 'Activity'
    } as never);
    tripPlanningService.getTrip.and.returnValue(of(tripResponse({ id: 1 })));
    tripPlanningService.observeTripUpdates.and.returnValue(tripUpdateEvents.asObservable());
    spyOn(window, 'fetch').and.resolveTo(new Response('[]', { status: 200 }));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: BudgetApiService, useValue: budgetApiService },
        { provide: WeatherService, useValue: weatherService },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: ActivitiesService, useValue: activitiesService },
        { provide: CalendarService, useValue: calendarService },
        { provide: AuthService, useValue: { authHeader: () => ({}) } },
        { provide: ThemeService, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('returns the correct greeting for local morning, afternoon, evening, and night hours', () => {
    expect(component.getGreeting(new Date(2026, 0, 1, 8, 0))).toBe('GOOD MORNING');
    expect(component.getGreeting(new Date(2026, 0, 1, 13, 0))).toBe('GOOD AFTERNOON');
    expect(component.getGreeting(new Date(2026, 0, 1, 19, 0))).toBe('GOOD EVENING');
    expect(component.getGreeting(new Date(2026, 0, 1, 23, 0))).toBe('GOOD NIGHT');
    expect(component.getGreeting(new Date(2026, 0, 1, 3, 0))).toBe('GOOD NIGHT');
  });

  it('renders the dynamic greeting in the hero section', () => {
    component.greeting = 'GOOD MORNING';
    fixture.detectChanges();

    const heroGreeting: HTMLElement = fixture.nativeElement.querySelector('.hero-sup');

    expect(heroGreeting).toBeTruthy();
    expect(heroGreeting.textContent?.trim()).toBe('GOOD MORNING');
  });

  it('shows exactly 3 initial cities with weather data', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component.visibleWeatherCities()).toEqual(['Bangkok', 'Paris', 'London']);
    expect(component.weather().map((item) => item.city)).toEqual(['Bangkok', 'Paris', 'London']);
    expect(component.weather()).toHaveSize(3);
    expect(component.weather().every((item) => item.temperatureC !== null && !item.error)).toBeTrue();
    expect(weatherService.getWeather).toHaveBeenCalledWith(['Bangkok', 'Paris', 'London']);
  }));

  it('loads up to 3 planned trips from the saved trips API sorted by date', fakeAsync(() => {
    tripPlanningService.listSavedTrips.and.returnValue(of([
      tripResponse({ id: 2, name: 'Draft Rome', destination: 'Rome, Italy', status: 'PLANNING', startDate: '2027-08-10', endDate: '2027-08-17' }),
      tripResponse({ id: 3, name: 'Tokyo Spring', destination: 'Tokyo, Japan', status: 'UPCOMING', startDate: '2027-04-05', endDate: '2027-04-12' }),
      tripResponse({ id: 1, name: 'Paris Summer', destination: 'Paris, France', status: 'UPCOMING', startDate: '2027-06-15', endDate: '2027-06-22' }),
      tripResponse({ id: 4, name: 'Late Berlin', destination: 'Berlin, Germany', status: 'PLANNING', startDate: '2027-11-20', endDate: '2027-11-27' })
    ]));

    fixture.detectChanges();
    tick();

    expect(tripPlanningService.listSavedTrips).toHaveBeenCalled();
    expect(component.upcomingTripCount()).toBe(4);
    expect(component.trips().map((trip) => trip.name)).toEqual(['Tokyo Spring', 'Paris Summer', 'Draft Rome']);
    expect(component.trips()[0].budget).toBe('€1,200');
    expect(component.trips()[2].status).toBe('Draft');
  }));

  it('loads the live budget summary and category breakdown for the budget overview card', fakeAsync(() => {
    budgetApiService.getSummary.and.returnValue(of({
      totalBudget: 5000,
      totalSpent: 2350,
      remainingBalance: 2650,
      usagePercentage: 47
    }));
    budgetApiService.getCategoryBudgets.and.returnValue(of([
      { category: 'FLIGHTS', spent: 850, budget: 1200, percentage: 71 },
      { category: 'HOTELS', spent: 900, budget: 1500, percentage: 60 },
      { category: 'FOOD', spent: 300, budget: 500, percentage: 60 },
      { category: 'ACTIVITIES', spent: 200, budget: 400, percentage: 50 },
      { category: 'OTHERS', spent: 100, budget: 300, percentage: 33 }
    ] as BudgetCategoryResponse[]));

    fixture.detectChanges();
    tick();

    expect(budgetApiService.getSummary).toHaveBeenCalled();
    expect(budgetApiService.getCategoryBudgets).toHaveBeenCalled();
    expect(component.totalBudget).toBe(5000);
    expect(component.totalSpent).toBe(2350);
    expect(component.remainingBalance).toBe(2650);
    expect(component.usagePercentage).toBe(47);
    expect(component.budgetItems().map((item) => item.label)).toEqual(['Flights', 'Hotels', 'Food', 'Activities', 'Others']);
  }));

  it('renders recommended experiences from the activities backend service', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(activitiesService.getActivities).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Recommended Experiences');
    expect(fixture.nativeElement.textContent).toContain('FIFA Fan Festival');
    expect(fixture.nativeElement.textContent).toContain('Jun 12, 2026');
    expect(fixture.nativeElement.textContent).toContain('19:30');
    expect(fixture.nativeElement.textContent).toContain('€35');
    expect(fixture.nativeElement.querySelector('.rec-grid')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.rec-card')).toHaveSize(8);
    expect(fixture.nativeElement.querySelector('.rec-img')).toBeTruthy();
  }));

  it('uses the first European city batch on initial load', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    const requestedCities = new Set(
      activitiesService.getActivities.calls.allArgs()
        .map((args) => args[0])
        .filter((city): city is string => typeof city === 'string')
    );
    const firstBatch = RECOMMENDED_EXPERIENCE_EUROPEAN_CITIES.slice(0, RECOMMENDED_EXPERIENCE_CITY_BATCH_SIZE);

    for (const city of firstBatch) {
      expect(requestedCities.has(city)).toBeTrue();
    }

    expect(component.experiences()).toHaveSize(8);
    expect(component.experiences().every((experience) => RECOMMENDED_EXPERIENCE_EUROPEAN_CITIES.includes(experience.city as never))).toBeTrue();
  }));

  it('displays only European city results', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    const europeanCities = new Set<string>(RECOMMENDED_EXPERIENCE_EUROPEAN_CITIES);

    expect(component.experiences()).toHaveSize(8);
    expect(component.experiences().every((experience) => europeanCities.has(experience.city))).toBeTrue();
    expect(component.experiences().some((experience) => experience.city === 'New York')).toBeFalse();
  }));

  it('diversifies recommended experiences by category and city when available', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    const categories = new Set(component.experiences().map((experience) => experience.category));
    const cities = new Set(component.experiences().map((experience) => experience.city));
    const countries = new Set(component.experiences().map((experience) => experience.country));

    expect(component.experiences()).toHaveSize(8);
    expect(categories.size).toBeGreaterThan(2);
    expect(cities.size).toBeGreaterThan(4);
    expect(countries.size).toBeGreaterThan(4);
  }));

  it('does not let one category or country dominate recommendations', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    const categoryCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();

    for (const experience of component.experiences()) {
      categoryCounts.set(experience.category, (categoryCounts.get(experience.category) ?? 0) + 1);
      countryCounts.set(experience.country, (countryCounts.get(experience.country) ?? 0) + 1);
    }

    expect(Math.max(...categoryCounts.values())).toBeLessThanOrEqual(2);
    expect(Math.max(...countryCounts.values())).toBeLessThanOrEqual(2);
  }));

  it('still shows recommendations when only one category is available', fakeAsync(() => {
    activitiesService.getActivities.and.returnValue(of({
      items: Array.from({ length: 8 }, (_, index) => activity({
        id: `sports-only-${index}`,
        title: `Sports Event ${index + 1}`,
        city: RECOMMENDED_EXPERIENCE_EUROPEAN_CITIES[index],
        country: 'Europe',
        genre: 'Sports',
        category: 'Sports'
      })),
      page: 0,
      size: 8,
      hasMore: false
    }));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(component.experiences()).toHaveSize(8);
    expect(fixture.nativeElement.querySelectorAll('.rec-card')).toHaveSize(8);
    expect(fixture.nativeElement.textContent).not.toContain('No recommended experiences found right now.');
  }));

  it('still shows recommendations when price is missing', fakeAsync(() => {
    activitiesService.getActivities.and.returnValue(of({
      items: Array.from({ length: 8 }, (_, index) => activity({
        id: `no-price-${index}`,
        title: `Free City Event ${index + 1}`,
        city: RECOMMENDED_EXPERIENCE_EUROPEAN_CITIES[index],
        country: 'Europe',
        price: 0,
        minPrice: undefined,
        maxPrice: undefined
      })),
      page: 0,
      size: 8,
      hasMore: false
    }));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(component.experiences()).toHaveSize(8);
    expect(fixture.nativeElement.textContent).toContain('Price unavailable');
    expect(fixture.nativeElement.textContent).not.toContain('No recommended experiences found right now.');
  }));

  it('loads a refreshed recommendation set when Refresh is clicked', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const initialIds = component.experiences().map((experience) => experience.id);
    activitiesService.getActivities.calls.reset();

    (fixture.nativeElement.querySelector('.recommendations-card .view-all') as HTMLButtonElement).click();
    tick();
    fixture.detectChanges();
    const refreshedIds = component.experiences().map((experience) => experience.id);

    expect(activitiesService.getActivities).toHaveBeenCalled();
    expect(activitiesService.getActivities.calls.allArgs().some((args) => args[0] === 'Rome')).toBeTrue();
    expect(activitiesService.getActivities.calls.allArgs().some((args) => args[1] === 'soccer')).toBeTrue();
    expect(activitiesService.getActivities.calls.allArgs().some((args) => args[4] === 1)).toBeTrue();
    expect(refreshedIds).not.toEqual(initialIds);
    expect(fixture.nativeElement.querySelectorAll('.rec-card')).toHaveSize(8);
  }));

  it('advances through four European city batches before restarting', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const displayedCitiesByBatch = [component.experiences().map((experience) => experience.city)];

    for (let refreshIndex = 0; refreshIndex < 4; refreshIndex++) {
      (fixture.nativeElement.querySelector('.recommendations-card .view-all') as HTMLButtonElement).click();
      tick();
      fixture.detectChanges();
      displayedCitiesByBatch.push(component.experiences().map((experience) => experience.city));
    }

    for (const cities of displayedCitiesByBatch) {
      expect(cities).toHaveSize(8);
      expect(cities.every((city) => RECOMMENDED_EXPERIENCE_EUROPEAN_CITIES.includes(city as never))).toBeTrue();
    }

    expect(displayedCitiesByBatch[4]).not.toEqual(displayedCitiesByBatch[3]);
    expect(activitiesService.getActivities.calls.allArgs().some((args) => args[0] === RECOMMENDED_EXPERIENCE_EUROPEAN_CITIES[0])).toBeTrue();
  }));

  it('opens recommended experience details and adds the event to calendar', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.rec-card') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Olympic Stadium');
    expect(fixture.nativeElement.textContent).toContain('Add to Calendar');
    expect(fixture.nativeElement.textContent).toContain('Buy Tickets');

    (fixture.nativeElement.querySelector('.experience-calendar-btn') as HTMLButtonElement).click();
    tick();
    fixture.detectChanges();

    expect(calendarService.addEvent).toHaveBeenCalled();
    expect(calendarService.addEvent.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      title: jasmine.stringMatching(/^FIFA Fan Festival/),
      startDate: '2026-06-12',
      startTime: '19:30',
      location: jasmine.stringMatching(/^Olympic Stadium, .+, .+$/),
      category: 'Activity'
    }));
    expect(fixture.nativeElement.textContent).toContain('Added to calendar.');
  }));

  it('opens the Ticketmaster event URL from Buy Tickets', fakeAsync(() => {
    const openSpy = spyOn(window, 'open').and.returnValue(null);

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.rec-card') as HTMLButtonElement).click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.experience-ticket-btn') as HTMLButtonElement).click();

    expect(openSpy).toHaveBeenCalledWith(
      'https://ticketmaster.example/fifa-fan-festival',
      '_blank',
      'noopener,noreferrer'
    );
  }));

  it('disables Buy Tickets when no event URL exists', fakeAsync(() => {
    activitiesService.getActivities.and.returnValue(of({
      items: [activity({ id: 'no-ticket', url: '' })],
      page: 0,
      size: 6,
      hasMore: false
    }));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.rec-card') as HTMLButtonElement).click();
    fixture.detectChanges();

    const ticketButton = fixture.nativeElement.querySelector('.experience-ticket-btn') as HTMLButtonElement;

    expect(ticketButton.disabled).toBeTrue();
    expect(ticketButton.textContent?.trim()).toBe('Tickets unavailable');
  }));

  it('shows an empty state when recommended activities have no usable events', fakeAsync(() => {
    activitiesService.getActivities.and.returnValue(of({
      items: [],
      page: 0,
      size: 6,
      hasMore: false
    }));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No recommended experiences found right now.');
  }));

  it('shows an empty state only when returned events are unusable', fakeAsync(() => {
    activitiesService.getActivities.and.returnValue(of({
      items: [
        activity({ id: 'missing-title-1', title: '' }),
        activity({ id: 'missing-title-2', title: '   ' })
      ],
      page: 0,
      size: 2,
      hasMore: false
    }));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(component.experiences()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No recommended experiences found right now.');
  }));

  it('shows an error state when recommended activity requests fail', fakeAsync(() => {
    activitiesService.getActivities.and.returnValue(throwError(() => new Error('Ticketmaster unavailable')));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Recommended experiences are unavailable right now.');
  }));

  it('refreshes the budget overview when a shared trip budget update arrives', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    budgetApiService.getSummary.calls.reset();
    budgetApiService.getCategoryBudgets.calls.reset();

    tripUpdateEvents.next({
      eventType: 'TRIP_EXPENSE_CREATED',
      notificationType: 'TRIP_BUDGET_UPDATE',
      notificationId: 77,
      tripId: 1,
      title: 'Trip budget updated',
      description: 'Ada Lovelace added an expense to Paris Summer.',
      details: 'Paris · 15 Jun 2026 → 22 Jun 2026 · €120 · flights',
      createdAt: '2026-07-01T12:00:00Z'
    });
    tick();

    expect(budgetApiService.getSummary).toHaveBeenCalledTimes(1);
    expect(budgetApiService.getCategoryBudgets).toHaveBeenCalledTimes(1);
  }));

  it('rotates after 20 seconds and requests weather for the next 3 cities', fakeAsync(() => {
    fixture.detectChanges();
    tick(20000);

    expect(component.visibleWeatherCities()).toEqual(['Dubai', 'Singapore', 'Kuala Lumpur']);
    expect(component.weather().map((item) => item.city)).toEqual(['Dubai', 'Singapore', 'Kuala Lumpur']);
    expect(weatherService.getWeather).toHaveBeenCalledWith(['Dubai', 'Singapore', 'Kuala Lumpur']);
  }));

  it('requests weather for later city groups, not only the old 6 cities', fakeAsync(() => {
    fixture.detectChanges();
    tick(40000);

    expect(component.visibleWeatherCities()).toEqual(['New York City', 'Istanbul', 'Tokyo']);
    expect(component.weather().map((item) => item.city)).toEqual(['New York City', 'Istanbul', 'Tokyo']);
    expect(weatherService.getWeather).toHaveBeenCalledWith(['New York City', 'Istanbul', 'Tokyo']);
  }));

  it('wraps back to the beginning after the final city group', fakeAsync(() => {
    fixture.detectChanges();
    tick(20000 * 8);

    expect(component.visibleWeatherCities()).toEqual(DESTINATION_WEATHER_CITIES.slice(0, 3) as string[]);
    expect(component.weather().map((item) => item.city)).toEqual(['Bangkok', 'Paris', 'London']);
  }));

  it('shows a loading state without empty cards while new weather data is pending', fakeAsync(() => {
    const weatherResponse = new Subject<WeatherDto[]>();
    weatherService.getWeather.and.returnValue(weatherResponse.asObservable());

    fixture.detectChanges();
    tick();

    expect(component.isWeatherLoading()).toBeTrue();
    expect(component.weather()).toEqual([]);

    weatherResponse.next(weatherFor(['Bangkok', 'Paris', 'London']));
    weatherResponse.complete();
    tick();

    expect(component.isWeatherLoading()).toBeFalse();
    expect(component.weather()).toHaveSize(3);
  }));

  it('handles per-city weather errors without breaking the other visible cards', fakeAsync(() => {
    weatherService.getWeather.and.returnValue(of([
      { city: 'Bangkok', temperatureC: 28, condition: 'Partly cloudy', icon: null, humidity: 87, windKph: 4.9, error: null },
      { city: 'Paris', temperatureC: 19, condition: 'Clear sky', icon: null, humidity: 62, windKph: 8.3, error: null },
      { city: 'London', temperatureC: null, condition: null, icon: null, humidity: null, windKph: null, error: 'Weather unavailable' }
    ]));

    fixture.detectChanges();
    tick();

    expect(component.weather()).toHaveSize(3);
    expect(component.weather()[0].temperatureC).toBe(28);
    expect(component.weather()[1].temperatureC).toBe(19);
    expect(component.weather()[2].city).toBe('London');
    expect(component.weather()[2].error).toBe('Weather unavailable');
    expect(component.weatherError()).toBe('');
  }));

  it('retries visible cities when a previous response only returned unavailable weather', fakeAsync(() => {
    weatherService.getWeather.and.returnValue(of([
      { city: 'Bangkok', temperatureC: null, condition: null, icon: null, humidity: null, windKph: null, error: 'Weather unavailable' },
      { city: 'Paris', temperatureC: null, condition: null, icon: null, humidity: null, windKph: null, error: 'Weather unavailable' },
      { city: 'London', temperatureC: null, condition: null, icon: null, humidity: null, windKph: null, error: 'Weather unavailable' }
    ]));

    fixture.detectChanges();
    tick();
    component.loadWeather();
    tick();

    expect(weatherService.getWeather).toHaveBeenCalledTimes(2);
  }));

  it('shows a section-level error when the weather request fails completely', fakeAsync(() => {
    weatherService.getWeather.and.returnValue(throwError(() => new Error('network failed')));

    fixture.detectChanges();
    tick();

    expect(component.isWeatherLoading()).toBeFalse();
    expect(component.weather()).toEqual([]);
    expect(component.weatherError()).toBe('Weather is unavailable right now.');
  }));

  it('uses returned weather for requested visible city slots even when provider labels differ', fakeAsync(() => {
    weatherService.getWeather.and.returnValue(of([
      { city: 'Bangkok Metropolitan Region', temperatureC: 28, condition: 'Partly cloudy', icon: null, humidity: 87, windKph: 4.9, error: null },
      { city: 'Paris, France', temperatureC: 19, condition: 'Clear sky', icon: null, humidity: 62, windKph: 8.3, error: null },
      { city: 'Greater London', temperatureC: 16, condition: 'Rain', icon: null, humidity: 78, windKph: 12.1, error: null }
    ]));

    fixture.detectChanges();
    tick();

    expect(component.weather().map((item) => item.temperatureC)).toEqual([28, 19, 16]);
    expect(component.weather().some((item) => item.error === 'Weather unavailable')).toBeFalse();
  }));

  it('cleans up the rotation interval on destroy', fakeAsync(() => {
    const clearIntervalSpy = spyOn(window, 'clearInterval').and.callThrough();

    fixture.detectChanges();
    fixture.destroy();
    tick();

    expect(clearIntervalSpy).toHaveBeenCalled();
  }));
});
