import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

export interface WeatherDto {
  city: string;
  temperatureC: number | null;
  condition: string | null;
  icon: string | null;
  humidity: number | null;
  windKph: number | null;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = '/api/weather';

  getWeather(): Observable<WeatherDto[]> {
    console.debug('Loading weather from backend endpoint', this.apiUrl);

    return this.http.get<WeatherDto[]>(this.apiUrl, {
      headers: this.authService.authHeader()
    });
  }
}
