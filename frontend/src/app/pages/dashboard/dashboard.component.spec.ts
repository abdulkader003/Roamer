import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '../../services/auth';
import { ThemeService } from '../../services/theme.service';
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

describe('DashboardComponent weather rotation', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let weatherService: jasmine.SpyObj<WeatherService>;

  beforeEach(async () => {
    weatherService = jasmine.createSpyObj<WeatherService>('WeatherService', ['getWeather']);
    weatherService.getWeather.and.callFake((cities: readonly string[]) => of(weatherFor(cities)));
    spyOn(window, 'fetch').and.resolveTo(new Response('[]', { status: 200 }));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: WeatherService, useValue: weatherService },
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
