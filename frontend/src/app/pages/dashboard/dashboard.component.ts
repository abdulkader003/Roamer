import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, computed, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth';
import { WeatherDto, WeatherService } from '../../services/weather.service';


export const DESTINATION_WEATHER_CITIES = [
  'Bangkok',
  'Paris',
  'London',
  'Dubai',
  'Singapore',
  'Kuala Lumpur',
  'New York City',
  'Istanbul',
  'Tokyo',
  'Seoul',
  'Hong Kong',
  'Barcelona',
  'Rome',
  'Amsterdam',
  'Milan',
  'Vienna',
  'Prague',
  'Madrid',
  'Berlin',
  'Los Angeles',
  'Miami',
  'Sydney',
  'Toronto',
  'Las Vegas'
] as const;

const WEATHER_ROTATION_INTERVAL_MS = 20000;
const VISIBLE_WEATHER_CITY_COUNT = 3;

interface Trip {
  name: string;
  dates: string;
  budget: string;
  status: 'confirmed' | 'pending';
  image: string;
}

interface Experience {
  name: string;
  location: string;
  price: string;
  image: string;
}

interface BudgetItem {
  label: string;
  amount: string;
  color: string;
  dashArray: string;
  dashOffset: string;
}

interface CalendarDay {
  day: number;
  type: 'prev' | 'curr' | 'today';
  date: string;
}

interface BackendCalendarEvent {
  startDateTime?: string | null;
  endDateTime?: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnDestroy {
  // ThemeService is injected so the effect() in the service runs and sets data-theme on <html>
  private themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly weatherService = inject(WeatherService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly today = new Date();
  private readonly weatherCache = new Map<string, WeatherDto>();
  private weatherRotationIntervalId: ReturnType<typeof setInterval> | null = null;
  private weatherRequestSequence = 0;
  readonly isPlanningTrip = signal(false);

  visibleCalendarMonth = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  readonly currentMonthLabel = computed(() =>
    this.visibleCalendarMonth().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  );

  trips = signal<Trip[]>([
    {
      name: 'Paris, France',
      dates: '15 Jun – 22 Jun, 2024',
      budget: '€1,200',
      status: 'confirmed',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=200&q=80',
    },
    {
      name: 'Zermatt, Switzerland',
      dates: '08 Jul – 14 Jul, 2024',
      budget: '€1,800',
      status: 'pending',
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&q=80',
    },
  ]);

  experiences = signal<Experience[]>([
    { name: 'Sunset Yacht Party', location: 'Dubai, UAE', price: '€120.00', image: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&q=80' },
    { name: 'Summer Music Festival', location: 'Barcelona, Spain', price: '€89.00', image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&q=80' },
    { name: 'Bali Surf Experience', location: 'Bali, Indonesia', price: '€75.00', image: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=400&q=80' },
    { name: 'Mixology Masterclass', location: 'London, UK', price: '€45.00', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80' },
  ]);

  weather = signal<WeatherDto[]>([]);
  visibleWeatherCities = signal<string[]>(DESTINATION_WEATHER_CITIES.slice(0, VISIBLE_WEATHER_CITY_COUNT));
  isWeatherLoading = signal(false);
  weatherError = signal('');
  private visibleWeatherStartIndex = 0;

  calDays = signal<CalendarDay[]>(this.buildCurrentMonthCalendarDays(this.visibleCalendarMonth()));
  eventDates = signal<Set<string>>(new Set());

  budgetItems = signal<BudgetItem[]>([
    { label: 'Flights',       amount: '€850', color: '#1A56DB', dashArray: '117.5 209', dashOffset: '0' },
    { label: 'Accommodation', amount: '€900', color: '#0EA5E9', dashArray: '124.4 202', dashOffset: '-117.5' },
    { label: 'Activities',    amount: '€300', color: '#7C3AED', dashArray: '41.5 285',  dashOffset: '-241.9' },
    { label: 'Events',        amount: '€200', color: '#F59E0B', dashArray: '27.7 299',  dashOffset: '-283.4' },
    { label: 'Attractions',   amount: '€200', color: '#0F9D58', dashArray: '27.7 299',  dashOffset: '-311.1' },
    { label: 'Beaches',       amount: '€150', color: '#10B981', dashArray: '20.7 306',  dashOffset: '-338.8' },
    { label: 'Parties',       amount: '€100', color: '#EC4899', dashArray: '13.8 313',  dashOffset: '-359.5' },
  ]);

  ngOnInit(): void {
    void this.loadCalendarEventDates();
    this.loadWeather();
    this.weatherRotationIntervalId = setInterval(() => this.rotateWeatherCities(), WEATHER_ROTATION_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.weatherRotationIntervalId !== null) {
      clearInterval(this.weatherRotationIntervalId);
      this.weatherRotationIntervalId = null;
    }
  }

  loadWeather(forceRefresh = false): void {
    const visibleCities = this.visibleWeatherCities();
    const missingCities = forceRefresh
      ? visibleCities
      : visibleCities.filter((city) => !this.hasUsableCachedWeather(city));

    if (missingCities.length === 0) {
      this.applyVisibleWeatherFromCache();
      return;
    }

    this.isWeatherLoading.set(true);
    this.weatherError.set('');
    const requestId = ++this.weatherRequestSequence;

    this.weatherService.getWeather(missingCities).subscribe({
      next: (weather) => {
        for (const [index, item] of weather.entries()) {
          const requestedCity = missingCities[index];
          if (!requestedCity || item.error) {
            continue;
          }

          const normalizedWeather = this.weatherForVisibleCity(requestedCity, item);
          this.weatherCache.set(requestedCity, normalizedWeather);
          this.weatherCache.set(item.city, normalizedWeather);
        }

        if (requestId === this.weatherRequestSequence) {
          this.applyVisibleWeatherFromCache();
          this.isWeatherLoading.set(false);
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Failed to load dashboard weather:', error);
        if (requestId === this.weatherRequestSequence) {
          this.weather.set([]);
          this.weatherError.set('Weather is unavailable right now.');
          this.isWeatherLoading.set(false);
          this.cdr.detectChanges();
        }
      }
    });
  }

  rotateWeatherCities(): void {
    this.visibleWeatherStartIndex = (this.visibleWeatherStartIndex + VISIBLE_WEATHER_CITY_COUNT) % DESTINATION_WEATHER_CITIES.length;
    this.visibleWeatherCities.set(this.getWeatherCityGroup(this.visibleWeatherStartIndex));
    this.loadWeather();
  }

  private getWeatherCityGroup(startIndex: number): string[] {
    return Array.from({ length: VISIBLE_WEATHER_CITY_COUNT }, (_, offset) =>
      DESTINATION_WEATHER_CITIES[(startIndex + offset) % DESTINATION_WEATHER_CITIES.length]
    );
  }

  private weatherForVisibleCity(city: string, weather: WeatherDto): WeatherDto {
    return {
      ...weather,
      city
    };
  }

  private hasUsableCachedWeather(city: string): boolean {
    const cachedWeather = this.weatherCache.get(city);
    return cachedWeather !== undefined && !cachedWeather.error;
  }

  private applyVisibleWeatherFromCache(): void {
    const visibleWeather = this.visibleWeatherCities()
      .map((city) => this.weatherCache.get(city) ?? this.createWeatherPlaceholder(city));

    this.weather.set(visibleWeather);
    this.weatherError.set('');
    this.cdr.detectChanges();
  }

  private createWeatherPlaceholder(city: string): WeatherDto {
    return {
      city,
      temperatureC: null,
      condition: null,
      icon: null,
      humidity: null,
      windKph: null,
      error: 'Weather unavailable'
    };
  }

  getWeatherIcon(weather: WeatherDto | null): string {
    const condition = weather?.condition?.toLowerCase() ?? '';

    if (condition.includes('rain') || condition.includes('drizzle')) {
      return '☔';
    }

    if (condition.includes('cloud')) {
      return '☁';
    }

    if (condition.includes('storm') || condition.includes('thunder')) {
      return '⚡';
    }

    if (condition.includes('snow')) {
      return '❄';
    }

    return '☀';
  }

  formatTemperature(value: number | null): string {
    return value === null ? '--' : `${Math.round(value)}°C`;
  }

  hasEventOnDate(date: string): boolean {
    return this.eventDates().has(date);
  }

  openCalendarDate(date: string): void {
    void this.router.navigate(['/calendar'], {
      queryParams: { date },
    });
  }

  planNextAdventure(): void {
    if (this.isPlanningTrip()) {
      return;
    }

    this.isPlanningTrip.set(true);
    setTimeout(() => void this.router.navigate(['/trips/create/budget']), 260);
  }

  goToPreviousCalendarMonth(): void {
    this.changeCalendarMonth(-1);
  }

  goToNextCalendarMonth(): void {
    this.changeCalendarMonth(1);
  }

  private changeCalendarMonth(offset: number): void {
    const currentMonth = this.visibleCalendarMonth();
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);

    this.visibleCalendarMonth.set(nextMonth);
    this.calDays.set(this.buildCurrentMonthCalendarDays(nextMonth));
  }

  private buildCurrentMonthCalendarDays(date: Date): CalendarDay[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const currentDay = this.today.getDate();
    const isCurrentMonth =
      year === this.today.getFullYear() && month === this.today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const leadingDays = (firstDay + 6) % 7;
    const days: CalendarDay[] = [];

    for (let index = leadingDays - 1; index >= 0; index--) {
      const day = daysInPreviousMonth - index;
      days.push({
        day,
        type: 'prev',
        date: this.formatDate(new Date(year, month - 1, day)),
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        type: isCurrentMonth && day === currentDay ? 'today' : 'curr',
        date: this.formatDate(new Date(year, month, day)),
      });
    }

    return days;
  }

  private async loadCalendarEventDates(): Promise<void> {
    try {
      const response = await fetch('/api/calendar-events', {
        headers: this.authService.authHeader(),
      });

      if (!response.ok) {
        throw new Error(`Failed to load calendar events: ${response.status}`);
      }

      const events = (await response.json()) as BackendCalendarEvent[];
      const dates = new Set<string>();

      for (const event of events) {
        const startDate = event.startDateTime?.split('T')[0] ?? '';
        const endDate = event.endDateTime?.split('T')[0] ?? '';

        if (startDate) {
          dates.add(startDate);
        }

        if (endDate && endDate !== startDate) {
          dates.add(endDate);
        }
      }

      this.eventDates.set(dates);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Failed to load dashboard calendar event indicators:', error);
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

}
