import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, computed, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth';
import { TripPlanningService, TripResponse } from '../../services/trip-planning.service';
import { WeatherDto, WeatherService } from '../../services/weather.service';
import { TripTempService } from '../trips/create/trip-temp.service';
import { BudgetApiService, BudgetCategoryResponse, BudgetSummaryResponse } from '../../services/budget-api.service';
import { ActivitiesService, Activity } from '../../services/activities';
import { CalendarEvent } from '../hotels/models/hotel.model';
import { CalendarService } from '../hotels/services/calendar.service';


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
const RECOMMENDED_EXPERIENCE_CITIES = [
  'Barcelona',
  'Berlin',
  'Madrid',
  'London',
  'Paris',
  'Rome',
  'New York',
  'Los Angeles',
  'Toronto',
  'Mexico City',
] as const;
const WORLD_CUP_EXPERIENCE_KEYWORDS = ['football', 'soccer', 'FIFA', 'World Cup', 'fan festival', 'sports'] as const;

interface Trip {
  id: number;
  name: string;
  dates: string;
  budget: string;
  status: 'confirmed' | 'pending';
  image: string;
  shared: boolean;
}

interface Experience {
  id: string;
  name: string;
  city: string;
  country: string;
  location: string;
  venue: string;
  date: string;
  dateLabel: string;
  time: string;
  price: string;
  priceValue: number;
  category: string;
  description: string;
  source: string;
  image: string;
  activity: Activity;
}

interface BudgetItem {
  label: string;
  spent: number;
  budget: number;
  color: string;
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
  private readonly budgetApiService = inject(BudgetApiService);
  private readonly tripPlanningService = inject(TripPlanningService);
  private readonly activitiesService = inject(ActivitiesService);
  private readonly calendarService = inject(CalendarService);
  private readonly tripTempService = inject(TripTempService);
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

  trips = signal<Trip[]>([]);
  upcomingTripCount = signal(0);
  isTripsLoading = signal(false);
  tripsError = signal('');

  experiences = signal<Experience[]>([]);
  isExperiencesLoading = signal(false);
  experiencesError = signal('');
  selectedExperience = signal<Experience | null>(null);
  isAddingExperienceToCalendar = signal(false);
  experienceCalendarMessage = signal('');
  experienceCalendarMessageType = signal<'success' | 'error'>('success');

  weather = signal<WeatherDto[]>([]);
  visibleWeatherCities = signal<string[]>(DESTINATION_WEATHER_CITIES.slice(0, VISIBLE_WEATHER_CITY_COUNT));
  isWeatherLoading = signal(false);
  weatherError = signal('');
  private visibleWeatherStartIndex = 0;

  calDays = signal<CalendarDay[]>(this.buildCurrentMonthCalendarDays(this.visibleCalendarMonth()));
  eventDates = signal<Set<string>>(new Set());

  totalBudget = 0;
  totalSpent = 0;
  remainingBalance = 0;
  usagePercentage = 0;

  budgetItems = signal<BudgetItem[]>([]);

  private readonly budgetCategoryLabels: Record<string, string> = {
    FLIGHTS: 'Flights',
    HOTELS: 'Hotels',
    FOOD: 'Food',
    ACTIVITIES: 'Activities',
    OTHERS: 'Others',
  };

  private readonly budgetCategoryColors: Record<string, string> = {
    FLIGHTS: 'var(--budget-chart-flights)',
    HOTELS: 'var(--budget-chart-hotels)',
    FOOD: 'var(--budget-chart-food)',
    ACTIVITIES: 'var(--budget-chart-activities)',
    OTHERS: 'var(--budget-chart-others)',
  };

  private readonly budgetCategoryOrder = ['FLIGHTS', 'HOTELS', 'FOOD', 'ACTIVITIES', 'OTHERS'];

  ngOnInit(): void {
    this.loadUpcomingTrips();
    this.loadBudgetOverview();
    void this.loadCalendarEventDates();
    this.loadWeather();
    this.loadRecommendedExperiences();
    this.weatherRotationIntervalId = setInterval(() => this.rotateWeatherCities(), WEATHER_ROTATION_INTERVAL_MS);
  }

  loadUpcomingTrips(): void {
    this.isTripsLoading.set(true);
    this.tripsError.set('');

    this.tripPlanningService.listSavedTrips().subscribe({
      next: (savedTrips) => {
        const plannedTrips = [...savedTrips]
          .sort((first, second) => this.tripSortValue(first) - this.tripSortValue(second));

        this.upcomingTripCount.set(plannedTrips.length);
        this.trips.set(plannedTrips.slice(0, 3).map((trip) => this.toDashboardTrip(trip)));
        this.isTripsLoading.set(false);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load dashboard trips:', error);
        this.trips.set([]);
        this.upcomingTripCount.set(0);
        this.tripsError.set('Trips are unavailable right now.');
        this.isTripsLoading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  private loadBudgetOverview(): void {
    forkJoin({
      summary: this.budgetApiService.getSummary(),
      categories: this.budgetApiService.getCategoryBudgets(),
    }).subscribe({
      next: ({ summary, categories }) => {
        this.applyBudgetSummary(summary);
        this.budgetItems.set(this.mapBudgetItems(categories));
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load dashboard budget overview:', error);
        this.applyBudgetSummary({
          totalBudget: 0,
          totalSpent: 0,
          remainingBalance: 0,
          usagePercentage: 0,
        });
        this.budgetItems.set([]);
        this.cdr.detectChanges();
      }
    });
  }

  loadRecommendedExperiences(): void {
    this.isExperiencesLoading.set(true);
    this.experiencesError.set('');

    this.loadExperienceBatch('football').subscribe({
      next: (worldCupActivities) => {
        const worldCupExperiences = this.toRecommendedExperiences(worldCupActivities);

        if (worldCupExperiences.length >= 4) {
          this.experiences.set(worldCupExperiences.slice(0, 4));
          this.isExperiencesLoading.set(false);
          this.cdr.detectChanges();
          return;
        }

        this.loadExperienceBatch().subscribe({
          next: (generalActivities) => {
            const merged = this.toRecommendedExperiences([...worldCupActivities, ...generalActivities]);
            this.experiences.set(merged.slice(0, 4));
            this.isExperiencesLoading.set(false);
            this.cdr.detectChanges();
          },
          error: (error) => this.handleRecommendedExperiencesError(error)
        });
      },
      error: (error) => this.handleRecommendedExperiencesError(error)
    });
  }

  openExperienceDetails(experience: Experience): void {
    this.selectedExperience.set(experience);
    this.experienceCalendarMessage.set('');
  }

  closeExperienceDetails(): void {
    this.selectedExperience.set(null);
    this.experienceCalendarMessage.set('');
    this.isAddingExperienceToCalendar.set(false);
  }

  async addSelectedExperienceToCalendar(): Promise<void> {
    const experience = this.selectedExperience();

    if (!experience || this.isAddingExperienceToCalendar()) {
      return;
    }

    const calendarEvent = this.buildExperienceCalendarEvent(experience);

    if (!calendarEvent) {
      this.experienceCalendarMessageType.set('error');
      this.experienceCalendarMessage.set('This event is missing a valid date, so it cannot be added yet.');
      return;
    }

    this.isAddingExperienceToCalendar.set(true);
    this.experienceCalendarMessage.set('');

    try {
      await this.calendarService.addEvent(calendarEvent);
      this.experienceCalendarMessageType.set('success');
      this.experienceCalendarMessage.set('Added to calendar.');
      await this.loadCalendarEventDates();
    } catch (error) {
      console.error('Failed to add recommended experience to calendar:', error);
      this.experienceCalendarMessageType.set('error');
      this.experienceCalendarMessage.set('Could not add this event to your calendar.');
    } finally {
      this.isAddingExperienceToCalendar.set(false);
      this.cdr.detectChanges();
    }
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

  trackByExperienceId(_index: number, experience: Experience): string {
    return experience.id;
  }

  useFallbackExperienceImage(event: Event): void {
    const image = event.target as HTMLImageElement | null;

    if (image) {
      image.src = this.fallbackExperienceImage();
    }
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
    this.tripTempService.clearTripTemp();
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

  private loadExperienceBatch(keyword = '') {
    const requests = RECOMMENDED_EXPERIENCE_CITIES.map((city) =>
      this.activitiesService.getActivities(city, keyword, 0, 6).pipe(
        map((response) => response.items ?? []),
        catchError(() => of(null))
      )
    );

    return forkJoin(requests).pipe(
      map((results) => {
        if (results.every((result) => result === null)) {
          throw new Error('All recommended experience requests failed.');
        }

        return results.flatMap((result) => result ?? []);
      })
    );
  }

  private handleRecommendedExperiencesError(error: unknown): void {
    console.error('Failed to load recommended experiences:', error);
    this.experiences.set([]);
    this.experiencesError.set('Recommended experiences are unavailable right now.');
    this.isExperiencesLoading.set(false);
    this.cdr.detectChanges();
  }

  private toRecommendedExperiences(activities: Activity[]): Experience[] {
    const unique = new Map<string, Activity>();

    activities
      .filter((activity) => this.hasRecommendedExperienceQuality(activity))
      .forEach((activity) => {
        if (!unique.has(activity.id)) {
          unique.set(activity.id, activity);
        }
      });

    return [...unique.values()]
      .sort((first, second) => this.experienceScore(second) - this.experienceScore(first))
      .map((activity) => this.toDashboardExperience(activity));
  }

  private hasRecommendedExperienceQuality(activity: Activity): boolean {
    return Boolean(
      activity?.id &&
      activity.title?.trim() &&
      activity.city?.trim() &&
      activity.image?.trim() &&
      this.activityDate(activity)
    );
  }

  private experienceScore(activity: Activity): number {
    let score = 0;
    const searchable = [
      activity.title,
      activity.category,
      activity.segment,
      activity.genre,
      activity.subGenre,
      activity.description,
      activity.venue,
    ].join(' ').toLowerCase();

    if (WORLD_CUP_EXPERIENCE_KEYWORDS.some((keyword) => searchable.includes(keyword.toLowerCase()))) {
      score += 1000;
    }

    if (activity.image) {
      score += 120;
    }

    if (activity.venue) {
      score += 60;
    }

    if (activity.price > 0 || activity.minPrice || activity.maxPrice) {
      score += 40;
    }

    score += Number(activity.rating ?? 0);
    return score;
  }

  private toDashboardExperience(activity: Activity): Experience {
    return {
      id: activity.id,
      name: activity.title,
      city: activity.city,
      country: activity.country,
      location: [activity.city, activity.country].filter(Boolean).join(', '),
      venue: activity.venue || activity.venueDetails?.name || '',
      date: this.activityDate(activity) ?? '',
      dateLabel: this.formatActivityDate(activity),
      time: this.formatActivityTime(activity),
      price: this.formatActivityPrice(activity),
      priceValue: this.activityPriceValue(activity),
      category: activity.genre || activity.category || activity.segment || activity.type || 'Experience',
      description: activity.description || activity.info || activity.pleaseNote || '',
      source: activity.source || 'Ticketmaster',
      image: activity.image || this.fallbackExperienceImage(),
      activity,
    };
  }

  private buildExperienceCalendarEvent(experience: Experience): CalendarEvent | null {
    if (!experience.date) {
      return null;
    }

    return {
      title: experience.name,
      startDate: experience.date,
      endDate: experience.date,
      startTime: experience.time || undefined,
      price: experience.priceValue,
      location: [experience.venue, experience.location].filter(Boolean).join(', '),
      category: 'Activity',
      description: experience.description,
      notes: `Source: ${experience.source}`,
    };
  }

  private activityDate(activity: Activity): string | null {
    const rawDate = activity.startDate?.trim();

    if (!rawDate) {
      return null;
    }

    return rawDate.split('T')[0] || null;
  }

  private formatActivityDate(activity: Activity): string {
    const date = this.parseDateOnly(this.activityDate(activity) ?? '');

    if (!date) {
      return '';
    }

    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  private formatActivityTime(activity: Activity): string {
    const rawDate = activity.startDate?.trim() ?? '';

    if (!rawDate.includes('T')) {
      return '';
    }

    const timePart = rawDate.split('T')[1]?.slice(0, 5) ?? '';
    return timePart === '00:00' ? '' : timePart;
  }

  private formatActivityPrice(activity: Activity): string {
    const value = this.activityPriceValue(activity);

    if (value <= 0) {
      return 'Price unavailable';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activity.priceCurrency || 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  }

  private activityPriceValue(activity: Activity): number {
    return Number(activity.price || activity.minPrice || activity.maxPrice || 0);
  }

  private fallbackExperienceImage(): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#0f172a"/>
            <stop offset="1" stop-color="#2563eb"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="675" fill="url(#bg)"/>
        <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle"
          font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#ffffff">Roamer Experience</text>
      </svg>
    `)}`;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0
    }).format(value);
  }

  private toDashboardTrip(trip: TripResponse): Trip {
    return {
      id: trip.id,
      name: trip.name,
      dates: this.formatTripDates(trip),
      budget: this.formatTripBudget(trip),
      status: trip.status === 'UPCOMING' ? 'confirmed' : 'pending',
      image: this.tripImageFor(trip),
      shared: trip.accessRole === 'PARTICIPANT'
    };
  }

  private formatTripBudget(trip: TripResponse): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: trip.currency || 'EUR',
      maximumFractionDigits: 0
    }).format(trip.budget);
  }

  private formatTripDates(trip: TripResponse): string {
    const startDate = this.parseDateOnly(trip.startDate);
    const endDate = this.parseDateOnly(trip.endDate);

    if (!startDate || !endDate) {
      return trip.destination;
    }

    const startLabel = startDate.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short'
    });
    const endLabel = endDate.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    return `${startLabel} - ${endLabel}`;
  }

  private parseDateOnly(value: string): Date | null {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private tripSortValue(trip: TripResponse): number {
    return this.parseDateOnly(trip.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  }

  get budgetCenterLabel(): string {
    return 'Prices';
  }

  get budgetUsageSubLabel(): string {
    if (this.totalBudget <= 0) {
      return 'No budget set yet';
    }

    return `${this.usagePercentage}% of budget used`;
  }

  get remainingBalanceLabel(): string {
    return this.remainingBalance >= 0 ? 'Left to spend' : 'Over budget';
  }

  private applyBudgetSummary(summary: BudgetSummaryResponse): void {
    this.totalBudget = Number(summary.totalBudget ?? 0);
    this.totalSpent = Number(summary.totalSpent ?? 0);
    this.remainingBalance = Number(summary.remainingBalance ?? this.totalBudget - this.totalSpent);
    this.usagePercentage = Number(summary.usagePercentage ?? 0);
  }

  private mapBudgetItems(categories: BudgetCategoryResponse[]): BudgetItem[] {
    const sorted = [...categories].sort((first, second) => {
      const firstIndex = this.budgetCategoryOrder.indexOf(this.normalizeBudgetCategoryKey(String(first.category ?? '')));
      const secondIndex = this.budgetCategoryOrder.indexOf(this.normalizeBudgetCategoryKey(String(second.category ?? '')));
      return (firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex) - (secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex);
    });

    return sorted.map((category) => {
      const key = this.normalizeBudgetCategoryKey(String(category.category ?? ''));
      return {
        label: this.budgetCategoryLabels[key] ?? String(category.category ?? ''),
        spent: Number(category.spent ?? 0),
        budget: Number(category.budget ?? 0),
        color: this.budgetCategoryColors[key] ?? '#999'
      };
    });
  }

  private normalizeBudgetCategoryKey(category: string): string {
    return category.toUpperCase();
  }

  budgetSegmentDashArray(spent: number): string {
    const circumference = 2 * Math.PI * 52;
    const total = this.totalSpent > 0 ? this.totalSpent : this.budgetItems().reduce((sum, item) => sum + item.spent, 0);
    const ratio = total > 0 ? spent / total : 0;
    const dash = Math.max(0, Math.min(1, ratio)) * circumference;
    return `${dash} ${circumference - dash}`;
  }

  budgetSegmentDashOffset(index: number): string {
    const circumference = 2 * Math.PI * 52;
    const items = this.budgetItems();
    const total = this.totalSpent > 0 ? this.totalSpent : items.reduce((sum, item) => sum + item.spent, 0);
    if (total <= 0) {
      return '0';
    }

    const beforeTotal = items.slice(0, Math.max(index, 0)).reduce((sum, item) => sum + item.spent, 0);
    return `${-(beforeTotal / total) * circumference}`;
  }

  private tripImageFor(trip: TripResponse): string {
    const destination = trip.destination.toLowerCase();

    if (destination.includes('paris')) {
      return 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=200&q=80';
    }

    if (destination.includes('switzerland') || destination.includes('zermatt')) {
      return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&q=80';
    }

    if (destination.includes('rome') || destination.includes('italy')) {
      return 'https://images.unsplash.com/photo-1529260830199-42c24126f198?w=200&q=80';
    }

    if (destination.includes('tokyo') || destination.includes('japan')) {
      return 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=200&q=80';
    }

    return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=200&q=80';
  }

}
