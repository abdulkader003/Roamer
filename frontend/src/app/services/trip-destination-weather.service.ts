import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';

import { WeatherDto, WeatherService } from './weather.service';

@Injectable({
  providedIn: 'root',
})
export class TripDestinationWeatherService {
  private readonly weatherService = inject(WeatherService);
  private readonly cache = new Map<string, Observable<WeatherDto>>();

  loadDestinationWeather(destination: string): Observable<WeatherDto> {
    const city = this.normalizeCity(destination);

    if (!city) {
      return of(this.unavailableWeather('Destination'));
    }

    const cached = this.cache.get(city);
    if (cached) {
      return cached;
    }

    const request$ = this.weatherService.getWeather([city]).pipe(
      map((items) => this.pickWeather(items, city)),
      catchError(() => of(this.unavailableWeather(city))),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cache.set(city, request$);
    return request$;
  }

  private pickWeather(items: readonly WeatherDto[], city: string): WeatherDto {
    const normalizedCity = this.normalizeCity(city);
    const weather = items.find((item) => this.normalizeCity(item.city) === normalizedCity) ?? items[0];

    return weather ?? this.unavailableWeather(city);
  }

  private normalizeCity(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    return value.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim().toLowerCase();
  }

  private unavailableWeather(city: string): WeatherDto {
    return {
      city,
      temperatureC: null,
      condition: null,
      icon: null,
      humidity: null,
      windKph: null,
      error: 'Weather unavailable right now.',
    };
  }
}
