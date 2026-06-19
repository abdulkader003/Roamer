import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, timeout } from 'rxjs';
import { ActivitiesService, Activity } from '../../../../services/activities';
import { SelectedTripActivity, TripPlanningService } from '../../../../services/trip-planning.service';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly steps: TripStep[] = [
    { label: 'Budget', route: '/trips/create/budget' },
    { label: 'Destination', route: '/trips/create/destination' },
    { label: 'Flights' },
    { label: 'Hotels', route: '/trips/create/hotels' },
    { label: 'Activities', route: '/trips/create/activities' },
    { label: 'Overview' },
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
  private readonly activitiesPerCity = 6;

  ngOnInit(): void {
    const tripPlanningId = Number(this.route.snapshot.queryParamMap.get('tripPlanningId'));
    this.tripPlanningId.set(Number.isFinite(tripPlanningId) && tripPlanningId > 0 ? tripPlanningId : null);
    this.selectedCities.set(this.readSelectedCities());
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

    const request = {
      activities: this.selectedActivities().map(({ name, category, price, duration, city }) => ({
        name,
        category,
        price,
        duration,
        city,
      })),
    };

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
        error: () => {
          this.saveError.set('Could not save your activities. Please try again.');
        },
      });
  }

  goToPreviousStep(): void {
    void this.router.navigate(['/trips/create/hotels'], { queryParams: this.tripPlanningQueryParams() });
  }

  stepRoute(step: TripStep): string | null {
    return step.route && this.routeExists(step.route) ? step.route : null;
  }

  tripPlanningQueryParams(): { tripPlanningId: number } | undefined {
    const tripPlanningId = this.tripPlanningId();
    return tripPlanningId ? { tripPlanningId } : undefined;
  }

  subtitle(): string {
    const cities = this.selectedCities().join(', ');
    return `Discover the best things to do in ${cities}. Select as many as you'd like.`;
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
    const rawCities = cityParams.length ? cityParams : citiesParam?.split(',') ?? [];
    const selectedCities = rawCities.map((city) => city.trim()).filter(Boolean);

    return selectedCities.length ? Array.from(new Set(selectedCities)) : ['Barcelona'];
  }

  private routeExists(route: string): boolean {
    const normalizedRoute = route.replace(/^\//, '');
    return this.router.config.some((routeConfig) => routeConfig.path === normalizedRoute);
  }
}
