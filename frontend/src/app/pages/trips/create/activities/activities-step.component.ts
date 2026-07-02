import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, timeout } from 'rxjs';
import { ActivitiesService, Activity } from '../../../../services/activities';
import { SelectedTripActivity, TripPlanningService } from '../../../../services/trip-planning.service';
import { TripTempService } from '../trip-temp.service';

interface TripStep {
  label: string;
  route?: string;
}

interface TripActivityCard extends SelectedTripActivity {
  id: string;
  icon: string;
  tone: string;
  tripCity: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  eventDate: string;
  venue: string;
  address: string;
  description: string;
  rating: number;
  source: string;
}

@Component({
  selector: 'app-activities-step',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './activities-step.component.html',
  styleUrl: './activities-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivitiesStepComponent implements OnInit {
  private readonly activitiesService = inject(ActivitiesService);
  private readonly tripPlanningService = inject(TripPlanningService);
  private readonly tripTempService = inject(TripTempService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly tripTemp = this.tripTempService.getTripTemp();

  readonly steps: TripStep[] = [
    { label: 'Budget', route: '/trips/create/budget' },
    { label: 'Destination', route: '/trips/create/destination' },
    { label: 'Flights', route: '/trips/create/flights' },
    { label: 'Hotels', route: '/trips/create/hotels' },
    { label: 'Activities', route: '/trips/create/activities' },
    { label: 'Overview', route: '/trips/create/overview' },
  ];
  readonly selectedCities = signal<string[]>(['Barcelona']);
  readonly activities = signal<TripActivityCard[]>([]);
  readonly selectedActivityIds = signal<string[]>([]);
  readonly tripPlanningId = signal<number | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly loadWarning = signal('');
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly savedActivities = signal<SelectedTripActivity[]>([]);
  private readonly activitiesPerCity = 6;

  ngOnInit(): void {
    this.tripPlanningId.set(this.readTripPlanningId());
    this.selectedCities.set(this.readSelectedCities());
    this.loadSavedActivitiesSelection();
    this.loadActivities();
  }

  loadActivities(): void {
    this.isLoading.set(true);
    this.loadWarning.set('');
    this.loadError.set('');
    const cities = this.selectedCities();

    // Reuses existing Activities API before falling back to local suggestions.
    forkJoin(cities.map((city) => this.loadActivitiesForCity(city)))
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.cdr.detectChanges();
        }),
      )
      .subscribe((results) => {
        const activities = this.dedupeActivities(results.flatMap((result) => result.activities));
        const failedCities = results.filter((result) => result.usedFallback).map((result) => result.city);

        this.activities.set(activities);
        this.preselectSavedActivities(activities);

        if (failedCities.length) {
          this.loadWarning.set(`Using planning suggestions for: ${failedCities.join(', ')}.`);
        }

        if (!activities.length) {
          this.loadError.set('Could not load activity ideas for the selected cities. Please try again.');
        }
      });
  }

  toggleActivity(activity: TripActivityCard): void {
    const selectedIds = this.selectedActivityIds();

    // Allows selecting multiple activities for the trip.
    this.selectedActivityIds.set(
      selectedIds.includes(activity.id)
        ? selectedIds.filter((selectedId) => selectedId !== activity.id)
        : [...selectedIds, activity.id],
    );
    this.saveError.set('');
  }

  private preselectSavedActivities(activities: TripActivityCard[]): void {
    if (this.selectedActivityIds().length) {
      return;
    }

    const savedNames = new Set(
      [
        ...this.tripTempService.getTripTemp().selectedActivities,
        ...this.savedActivities(),
      ].map((activity) => this.normalizeForDuplicateKey(activity.name)),
    );

    if (!savedNames.size) {
      return;
    }

    const matchedIds = activities
      .filter((activity) => savedNames.has(this.normalizeForDuplicateKey(activity.name)))
      .map((activity) => activity.id);

    if (matchedIds.length) {
      this.selectedActivityIds.set(matchedIds);
    }
  }

  isSelected(activity: TripActivityCard): boolean {
    return this.selectedActivityIds().includes(activity.id);
  }

  selectedActivities(): TripActivityCard[] {
    const selectedIds = new Set(this.selectedActivityIds());
    return this.activities().filter((activity) => selectedIds.has(activity.id));
  }

  selectedCount(): number {
    return this.selectedActivities().length;
  }

  selectedTotal(): number {
    return this.selectedActivities().reduce((total, activity) => total + activity.price, 0);
  }

  continueToOverview(): void {
    if (this.isSaving()) {
      return;
    }

    const tripPlanningId = this.tripPlanningId();

    if (!tripPlanningId) {
      this.saveError.set('Trip planning session is missing. Continue from the Budget step first.');
      return;
    }

    this.isSaving.set(true);
    this.saveError.set('');

    const selectedActivitySnapshots = this.selectedActivities().map((activity) => this.toTripTempActivity(activity));
    const request = {
      activities: selectedActivitySnapshots.map(({ date: _date, time: _time, ...activity }) => activity),
    };
    this.tripTempService.updateTripTemp({
      selectedActivities: selectedActivitySnapshots,
      selectedActivitiesTotal: this.selectedTotal(),
    });

    // Saves selected activities for the current trip planning session.
    this.tripPlanningService
      .saveActivitiesStep(tripPlanningId, request)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          if (this.routeExists('/trips/create/overview')) {
            void this.router.navigate(['/trips/create/overview'], { queryParams: this.tripPlanningQueryParams() });
          }
          // Keeps Overview navigation safe until the route exists.
        },
        error: (error: unknown) => {
          this.saveError.set(this.saveActivitiesErrorMessage(error));
        },
      });
  }

  goToPreviousStep(): void {
    void this.router.navigate(['/trips/create/hotels'], { queryParams: this.tripPlanningQueryParams() });
  }

  stepRoute(step: TripStep): string | null {
    return step.route && this.routeExists(step.route) ? step.route : null;
  }

  tripPlanningQueryParams(): Params {
    const tripPlanningId = this.tripPlanningId();
    return tripPlanningId ? { ...this.route.snapshot.queryParams, tripPlanningId } : this.route.snapshot.queryParams;
  }

  private readTripPlanningId(): number | null {
    const routeTripPlanningId = Number(this.route.snapshot.queryParamMap.get('tripPlanningId'));

    if (Number.isFinite(routeTripPlanningId) && routeTripPlanningId > 0) {
      this.tripTempService.updateTripTemp({ tripPlanningId: routeTripPlanningId });
      return routeTripPlanningId;
    }

    return this.tripTempService.getTripTemp().tripPlanningId ?? null;
  }

  private loadSavedActivitiesSelection(): void {
    const tripPlanningId = this.tripPlanningId();

    if (!tripPlanningId) {
      return;
    }

    this.tripPlanningService.getOverview(tripPlanningId).subscribe({
      next: (overview) => {
        const selectedActivities = overview.selectedActivities ?? [];
        this.savedActivities.set(selectedActivities);

        if (selectedActivities.length) {
          this.tripTempService.updateTripTemp({
            selectedActivities,
            selectedActivitiesTotal: Number(overview.totalActivitiesCost ?? 0),
          });
        }

        this.preselectSavedActivities(this.activities());
      },
      error: () => this.preselectSavedActivities(this.activities()),
    });
  }

  private saveActivitiesErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Could not save your activities. Please try again.';
    }

    if (error.status === 0) {
      return 'Could not reach the backend. Make sure it is running on port 8080.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'Your login session cannot save these activities. Please log in again.';
    }

    if (error.status === 404) {
      return 'This trip planning session was not found. Start again from the Budget step.';
    }

    const message = this.backendErrorMessage(error);
    return message || `Could not save your activities. Backend returned ${error.status}.`;
  }

  private backendErrorMessage(error: HttpErrorResponse): string {
    const errorBody = error.error as { detail?: unknown; message?: unknown; title?: unknown } | string | null;

    if (typeof errorBody === 'string') {
      return errorBody;
    }

    if (typeof errorBody?.message === 'string') {
      return errorBody.message;
    }

    if (typeof errorBody?.detail === 'string') {
      return errorBody.detail;
    }

    return typeof errorBody?.title === 'string' ? errorBody.title : '';
  }

  private toSaveableActivity(activity: TripActivityCard): SelectedTripActivity {
    return {
      name: this.cleanText(activity.name) || 'Selected activity',
      category: this.cleanText(activity.category) || 'Leisure',
      price: Math.max(0, Math.round(Number(activity.price) || 0)),
      // The backend requires a non-empty duration. Some real event rows only
      // provide a date/time, so we store a clear fallback instead of failing.
      duration: this.cleanText(activity.duration) || this.cleanText(activity.timeRange) || 'See event time',
      city: this.cleanText(activity.city) || this.cleanText(activity.tripCity) || this.cityListText(this.selectedCities()),
    };
  }

  private toTripTempActivity(activity: TripActivityCard) {
    return {
      ...this.toSaveableActivity(activity),
      date: this.cleanText(activity.eventDate),
      time: this.cleanText(activity.timeRange) || this.cleanText(activity.startTime),
    };
  }

  subtitle(): string {
    const cityText = this.cityListText(this.selectedCities());
    const locationText = this.isMultiCityTrip() ? `across ${cityText}` : `in ${cityText}`;
    const dateText = this.dateRangeText();
    const travelerText = this.pluralize(Math.max(this.tripTemp.travelers || 1, 1), 'traveler');
    const searchContext = [dateText, travelerText].filter(Boolean).join(' · ');

    return `Discover activities ${locationText}${searchContext ? ` · ${searchContext}` : ''}. Select as many as you'd like.`;
  }

  isMultiCityTrip(): boolean {
    return this.selectedCities().length > 1;
  }

  cityGroups(): Array<{ city: string; activities: TripActivityCard[] }> {
    return this.selectedCities()
      .map((city) => ({
        city,
        activities: this.activities().filter((activity) => activity.tripCity === city),
      }))
      .filter((group) => group.activities.length);
  }

  trackByActivityId(_index: number, activity: TripActivityCard): string {
    return activity.id;
  }

  private loadActivitiesForCity(city: string) {
    return this.activitiesService.getActivities(city, undefined, 0, 8).pipe(
      timeout(12000),
      map((response) => {
        const rawActivities = response.items ?? [];
        const apiActivities = rawActivities
          .filter((activity) => this.isUsableActivity(activity))
          .map((activity) => this.toTripActivity(activity, city));
        const uniqueApiActivities = this.dedupeActivities(apiActivities);
        const activities = this.fillWithFallbackActivities(city, uniqueApiActivities).slice(0, this.activitiesPerCity);

        console.debug('[TripPlanningActivities]', {
          city,
          rawCount: rawActivities.length,
          deduplicatedCount: uniqueApiActivities.length,
          finalNames: activities.map((activity) => activity.name),
        });

        return {
          city,
          usedFallback: uniqueApiActivities.length < this.activitiesPerCity,
          activities,
        };
      }),
      catchError(() =>
        {
          const activities = this.fallbackActivities(city).slice(0, this.activitiesPerCity);
          console.debug('[TripPlanningActivities]', {
            city,
            rawCount: 0,
            deduplicatedCount: 0,
            finalNames: activities.map((activity) => activity.name),
          });

          return of({
            city,
            usedFallback: true,
            activities,
          });
        },
      ),
    );
  }

  private toTripActivity(activity: Activity, city: string): TripActivityCard {
    const category = this.normalizeCategory(activity.category || activity.segment || activity.genre || 'Leisure');
    const startTime = this.getDisplayTime(activity.startDate);
    const endTime = this.getDisplayTime(activity.endDate);
    const venue = this.cleanText(activity.venue) || this.cleanText(activity.venueDetails?.name);
    const description = this.getDisplayDescription(activity);
    const source = this.cleanText(activity.promoterName) || this.cleanText(activity.source);

    return {
      id: activity.id?.trim() ? `${city}-${activity.id.trim()}` : this.activityFallbackId(activity, city),
      name: this.cleanText(activity.title) || 'Untitled activity',
      category,
      price: this.resolveActivityPrice(activity),
      duration: this.getDisplayDuration(activity),
      city: this.cleanText(activity.city) || city,
      tripCity: city,
      startTime,
      endTime,
      timeRange: this.formatTimeRange(startTime, endTime),
      eventDate: this.getDisplayDate(activity.startDate),
      venue,
      address: this.getDisplayAddress(activity),
      description,
      rating: typeof activity.rating === 'number' && Number.isFinite(activity.rating) ? activity.rating : 0,
      source,
      icon: this.iconForCategory(category),
      tone: this.toneForCategory(category),
    };
  }

  private fallbackActivities(city: string): TripActivityCard[] {
    // TODO: replace fallback cards with Destination/Activities API data once the full flow is connected.
    return [
      this.createFallbackActivity(city, 'City Highlights Walk', 'Tours', 32, '2.5 hours'),
      this.createFallbackActivity(city, 'Museum & Gallery Pass', 'Arts & Culture', 28, '3 hours'),
      this.createFallbackActivity(city, 'Local Music Night', 'Music', 45, '2 hours'),
      this.createFallbackActivity(city, 'Stadium Experience', 'Sports', 55, '2 hours'),
      this.createFallbackActivity(city, 'Sunset Leisure Cruise', 'Leisure', 64, '90 minutes'),
      this.createFallbackActivity(city, 'Neighbourhood Market Visit', 'Leisure', 18, '1.5 hours'),
    ];
  }

  private fillWithFallbackActivities(city: string, activities: TripActivityCard[]): TripActivityCard[] {
    if (activities.length >= this.activitiesPerCity) {
      return activities;
    }

    const existingNames = new Set(activities.map((activity) => this.normalizeForDuplicateKey(activity.name)));
    const fallbackActivities = this.fallbackActivities(city)
      .filter((activity) => !existingNames.has(this.normalizeForDuplicateKey(activity.name)))
      .slice(0, this.activitiesPerCity - activities.length);

    return [...activities, ...fallbackActivities];
  }

  private createFallbackActivity(
    city: string,
    name: string,
    category: string,
    price: number,
    duration: string,
  ): TripActivityCard {
    return {
      id: `${city}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      category,
      price,
      duration,
      city,
      tripCity: city,
      startTime: '',
      endTime: '',
      timeRange: '',
      eventDate: '',
      venue: `${city} city centre`,
      address: '',
      description: `${name} is a suggested activity for your ${city} itinerary.`,
      rating: 0,
      source: 'Planning suggestion',
      icon: this.iconForCategory(category),
      tone: this.toneForCategory(category),
    };
  }

  private dedupeActivities(activities: TripActivityCard[]): TripActivityCard[] {
    const uniqueActivities = new Map<string, TripActivityCard>();

    activities.forEach((activity) => {
      // Removes duplicate activities from API/fallback results.
      const key = [
        this.normalizeForDuplicateKey(activity.name),
        this.normalizeForDuplicateKey(activity.tripCity),
        this.normalizeForDuplicateKey(activity.venue || activity.address),
      ].join('|');
      const existingActivity = uniqueActivities.get(key);

      if (!existingActivity || this.shouldReplaceDuplicate(existingActivity, activity)) {
        uniqueActivities.set(key, activity);
      }
    });

    return Array.from(uniqueActivities.values());
  }

  private shouldReplaceDuplicate(current: TripActivityCard, candidate: TripActivityCard): boolean {
    if (candidate.price !== current.price) {
      return candidate.price < current.price;
    }

    return this.timeRank(candidate.startTime) < this.timeRank(current.startTime);
  }

  private timeRank(eventTime: string): number {
    const match = eventTime.match(/^(\d{1,2}):(\d{2})$/);

    if (!match) {
      return Number.MAX_SAFE_INTEGER;
    }

    return Number(match[1]) * 60 + Number(match[2]);
  }

  private normalizeForDuplicateKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private isUsableActivity(activity: Activity): boolean {
    return Boolean(this.cleanText(activity?.title));
  }

  private resolveActivityPrice(activity: Activity): number {
    const price = typeof activity.price === 'number' && Number.isFinite(activity.price) ? activity.price : undefined;
    const minPrice = typeof activity.minPrice === 'number' && Number.isFinite(activity.minPrice) ? activity.minPrice : undefined;

    return Math.max(0, Math.round(price ?? minPrice ?? 0));
  }

  private getDisplayDuration(activity: Activity): string {
    const duration = this.cleanText(activity.duration);

    if (!duration || duration === '2h' || duration === 'See event time') {
      return '';
    }

    return duration;
  }

  private getDisplayTime(value?: string | null): string {
    const parsed = value ? new Date(value) : null;

    if (parsed && !Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return '';
  }

  private getDisplayDate(value?: string | null): string {
    const parsed = value ? new Date(value) : null;

    if (!parsed || Number.isNaN(parsed.getTime())) {
      return '';
    }

    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private formatTimeRange(startTime: string, endTime: string): string {
    if (startTime && endTime) {
      return `${startTime} - ${endTime}`;
    }

    return startTime || endTime;
  }

  private getDisplayAddress(activity: Activity): string {
    const address = this.cleanText(activity.venueAddress);
    const postalCode = this.cleanText(activity.venuePostalCode);
    const city = this.cleanText(activity.city);

    return [address, postalCode, city].filter(Boolean).join(', ');
  }

  private getDisplayDescription(activity: Activity): string {
    const description = this.cleanText(activity.description) || this.cleanText(activity.info);

    if (!description || description === 'Live event details are loading.') {
      return 'More details will be available from the activity provider.';
    }

    return description.length > 130 ? `${description.slice(0, 127).trim()}...` : description;
  }

  private activityFallbackId(activity: Activity, city: string): string {
    return `${city}-${activity.title || 'activity'}-${activity.startDate || activity.price || 0}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  }

  private cleanText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeCategory(category: string): string {
    const normalized = category.toLowerCase();

    if (normalized.includes('sport')) {
      return 'Sports';
    }

    if (normalized.includes('music')) {
      return 'Music';
    }

    if (normalized.includes('tour') || normalized.includes('sightseeing')) {
      return 'Tours';
    }

    if (normalized.includes('culture') || normalized.includes('art')) {
      return 'Arts & Culture';
    }

    return 'Leisure';
  }

  private iconForCategory(category: string): string {
    const normalizedCategory = this.normalizeCategory(category);
    return {
      'Arts & Culture': 'Art',
      Sports: 'Sp',
      Music: 'Mu',
      Tours: 'Go',
      Leisure: 'Sun',
    }[normalizedCategory] ?? '.';
  }

  private toneForCategory(category: string): string {
    const normalizedCategory = this.normalizeCategory(category);
    return {
      'Arts & Culture': 'culture',
      Sports: 'sports',
      Music: 'music',
      Tours: 'tours',
      Leisure: 'leisure',
    }[normalizedCategory] ?? 'leisure';
  }

  private readSelectedCities(): string[] {
    const cityParams = this.route.snapshot.queryParamMap.getAll('city');
    const citiesParam = this.route.snapshot.queryParamMap.get('cities');
    const multiCitySegmentsParam = this.route.snapshot.queryParamMap.get('multiCitySegments');
    const tripTemp = this.tripTempService.getTripTemp();
    const rawCities = cityParams.length
      ? cityParams
      : citiesParam?.split(',') ?? this.destinationCitiesFromMultiCitySegments(multiCitySegmentsParam);
    const selectedCities = rawCities.map((city) => this.cityOnly(city)).filter(Boolean);

    if (selectedCities.length) {
      return Array.from(new Set(selectedCities));
    }

    if (tripTemp.destinationCities.length) {
      return Array.from(new Set(tripTemp.destinationCities.map((city) => this.cityOnly(city)).filter(Boolean)));
    }

    const destinationCity = this.cityOnly(tripTemp.destination);
    return destinationCity ? [destinationCity] : ['Barcelona'];
  }

  private destinationCitiesFromMultiCitySegments(rawSegments: string | null): string[] {
    if (!rawSegments) {
      return [];
    }

    try {
      const segments = JSON.parse(rawSegments) as Array<{ toText?: string }>;
      return segments.map((segment) => segment.toText ?? '');
    } catch {
      return [];
    }
  }

  private cityOnly(value: string): string {
    return value.replace(/\s*\([A-Za-z]{3}\)$/, '').trim();
  }

  private cityListText(cities: string[]): string {
    if (cities.length <= 1) {
      return cities[0] ?? 'your destination';
    }

    return `${cities.slice(0, -1).join(', ')} and ${cities[cities.length - 1]}`;
  }

  private dateRangeText(): string {
    const departureDate = this.formatDisplayDate(this.tripTemp.departureDate);
    const returnDate = this.formatDisplayDate(this.tripTemp.returnDate);

    return departureDate && returnDate ? `${departureDate} to ${returnDate}` : departureDate;
  }

  private pluralize(count: number, label: string): string {
    return `${count} ${label}${count === 1 ? '' : 's'}`;
  }

  private formatDisplayDate(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private routeExists(route: string): boolean {
    const normalizedRoute = route.replace(/^\//, '');
    return this.router.config.some((routeConfig) => routeConfig.path === normalizedRoute);
  }
}
