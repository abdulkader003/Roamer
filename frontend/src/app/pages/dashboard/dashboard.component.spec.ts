import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { BudgetApiService, BudgetCategoryResponse } from '../../services/budget-api.service';
import { AuthService } from '../../services/auth';
import { ThemeService } from '../../services/theme.service';
import { TripPlanningService, TripResponse } from '../../services/trip-planning.service';
import { WeatherDto, WeatherService } from '../../services/weather.service';
import { DashboardComponent, DESTINATION_WEATHER_CITIES } from './dashboard.component';

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
    startDate: '2026-06-15',
    endDate: '2026-06-22',
    budget: 1200,
    status: 'UPCOMING',
    createdAt: '2026-01-01T00:00:00Z',
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
      tripResponse({ id: 2, name: 'Draft Rome', destination: 'Rome, Italy', status: 'PLANNING', startDate: '2026-08-10' }),
      tripResponse({ id: 3, name: 'Tokyo Spring', destination: 'Tokyo, Japan', status: 'UPCOMING', startDate: '2026-04-05' }),
      tripResponse({ id: 1, name: 'Paris Summer', destination: 'Paris, France', status: 'UPCOMING', startDate: '2026-06-15' }),
      tripResponse({ id: 4, name: 'Late Berlin', destination: 'Berlin, Germany', status: 'PLANNING', startDate: '2026-11-20' })
    ]));

    fixture.detectChanges();
    tick();

    expect(tripPlanningService.listSavedTrips).toHaveBeenCalled();
    expect(component.upcomingTripCount()).toBe(4);
    expect(component.trips().map((trip) => trip.name)).toEqual(['Tokyo Spring', 'Paris Summer', 'Draft Rome']);
    expect(component.trips()[0].budget).toBe('€1,200');
    expect(component.trips()[2].status).toBe('pending');
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
