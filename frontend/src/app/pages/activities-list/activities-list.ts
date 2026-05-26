import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, NgZone, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
import { ActivitiesService, Activity, ActivitySearchResponse } from '../../services/activities';
import { HOTEL_DESTINATIONS } from '../hotels/hotel-search/hotel-destinations';
import { CalendarEvent } from '../hotels/models/hotel.model';
import { CalendarService } from '../hotels/services/calendar.service';
import { StatusToastComponent, StatusToastType } from '../../shared/status-toast/status-toast.component';

interface CalendarDay {
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}

interface SearchCity {
  name: string;
  aliases: readonly string[];
}

interface ActivitiesListViewState {
  cityText: string;
  selectedCity: string;
  searchTerm: string;
  selectedCategory: string;
  selectedPriceLevel: string;
  selectedTimeOfDay: string;
  selectedSort: ActivitySort;
  selectedDate: string;
  hasSearched: boolean;
  isShowingCachedResults: boolean;
  errorMessage: string;
  activities: Activity[];
  scrollY: number;
  currentPage: number;
  hasMoreResults: boolean;
}

type ActivitySort = 'recommended' | 'rating' | 'price-low' | 'price-high' | 'title';

@Component({
  selector: 'app-activities-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatusToastComponent],
  templateUrl: './activities-list.html',
  styleUrls: ['./activities-list.css'],
})
export class ActivitiesListComponent implements OnInit, OnDestroy {
  cityText = '';
  selectedCity = '';
  searchTerm = '';
  selectedCategory = 'All Categories';
  selectedPriceLevel = 'All Prices';
  selectedTimeOfDay = 'Any Time';
  selectedSort: ActivitySort = 'recommended';
  selectedDate = '';

  hasSearched = false;
  loading = false;
  loadingMore = false;
  isShowingCachedResults = false;
  errorMessage = '';
  toastMessage = '';
  toastType: StatusToastType = 'info';
  selectedActivity: Activity | null = null;
  activityCalendarMessage = '';
  isAddingActivityToCalendar = false;
  activeCitySuggestions = false;
  activeKeywordSuggestions = false;
  activeDatePicker = false;
  filtersDrawerOpen = false;
  datePickerMonth = new Date();
  manualDateText = '';
  manualDateError = '';

  private readonly requestTimeoutMs = 12000;
  private readonly pageSize = 12;
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentRequestId = 0;
  private uniqueActivitiesCacheSource: Activity[] | null = null;
  private uniqueActivitiesCache: Activity[] = [];
  private filteredActivitiesCacheSource: Activity[] | null = null;
  private filteredActivitiesCacheSignature = '';
  private filteredActivitiesCache: Activity[] = [];
  hasMoreResults = false;
  private currentPage = 0;

  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly cityOptions: SearchCity[] = HOTEL_DESTINATIONS.map((destination) => ({
    name: destination.name,
    aliases: destination.aliases ?? [],
  }));
  readonly eventKeywords = [
    'concert',
    'live music',
    'festival',
    'theater',
    'comedy',
    'stand-up',
    'opera',
    'ballet',
    'musical',
    'exhibition',
    'art gallery',
    'museum',
    'nightlife',
    'club',
    'dj set',
    'sports',
    'football',
    'family events',
    'food festival',
    'market',
    'workshop',
    'conference',
    'guided tour',
    'rooftop party',
    'jazz',
  ];
  readonly defaultCategories: string[] = ['All Categories', 'Music', 'Arts & Theatre', 'Sports', 'Miscellaneous'];
  readonly priceOptions = ['All Prices', 'Budget', 'Mid-Range', 'Premium', 'Unknown'];
  readonly timeOptions = ['Any Time', 'Morning', 'Afternoon', 'Evening', 'Night'];
  readonly sortOptions: Array<{ value: ActivitySort; label: string; meta: string }> = [
    { value: 'recommended', label: 'Recommended', meta: 'Featured first' },
    { value: 'rating', label: 'Highest rating', meta: 'Best reviewed' },
    { value: 'price-low', label: 'Lowest price', meta: 'Budget first' },
    { value: 'price-high', label: 'Highest price', meta: 'Premium first' },
    { value: 'title', label: 'Title A-Z', meta: 'Alphabetical' },
  ];

  private readonly fallbackImage = `data:image/svg+xml;utf8,
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
      <rect width="1200" height="675" fill="%23111111"/>
      <rect x="30" y="30" width="1140" height="615" rx="28" fill="%23191919" stroke="%23d4a017" stroke-width="2"/>
      <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="42" fill="%23d4a017">No image available</text>
      <text x="50%" y="57%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="24" fill="%23dddddd">Roamer Activities</text>
    </svg>`;

  activities: Activity[] = [];

  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly calendarService: CalendarService,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.restoreViewState();
  }

  ngOnDestroy(): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.loadMoreIfNeeded();
  }

  searchActivities(showFeedback = true): void {
    const normalizedCity = this.normalizeCityInput(this.cityText);
    const cityRequiredMessage = 'Enter a city to search for events.';

    if (!normalizedCity) {
      this.selectedCity = '';
      this.cityText = '';
      this.activeCitySuggestions = false;
      this.activeKeywordSuggestions = false;
      this.errorMessage = '';

      if (showFeedback) {
        this.showToast(cityRequiredMessage, 'error');
      }
      return;
    }

    this.selectedCity = normalizedCity;
    this.cityText = normalizedCity;
    this.activeCitySuggestions = false;
    this.activeKeywordSuggestions = false;
    this.filtersDrawerOpen = false;

    if (!this.validateSelectedDate()) {
      this.errorMessage = this.manualDateError;
      if (showFeedback) {
        this.showToast(this.manualDateError, 'error');
      }
      return;
    }

    const requestId = ++this.currentRequestId;
    const cacheKey = this.activitiesService.buildCacheKey(this.selectedCity, this.searchTerm);
    const cachedActivities = this.normalizeActivities(this.activitiesService.getCachedActivities(cacheKey));

    this.hasSearched = true;
    this.loading = true;
    this.loadingMore = false;
    this.currentPage = 0;
    this.hasMoreResults = false;
    this.errorMessage = '';
    this.scrollToPageTop();

    if (cachedActivities.length > 0) {
      this.activities = cachedActivities;
      this.isShowingCachedResults = true;
    }

    this.activitiesService
      .getActivities(this.selectedCity, this.searchTerm, 0, this.pageSize)
      .pipe(
        timeout(this.requestTimeoutMs),
        finalize(() => {
          if (requestId === this.currentRequestId) {
            this.loading = false;
          }
        })
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.currentRequestId) {
            return;
          }

          this.activities = this.normalizeActivities(this.getResponseItems(response));
          this.activitiesService.setCachedActivities(cacheKey, this.activities);
          this.currentPage = 0;
          this.hasMoreResults = Boolean(response?.hasMore);
          this.isShowingCachedResults = false;
          this.errorMessage = '';
          this.persistViewState();
          this.queueViewportFillCheck();
          this.flushView();

          if (showFeedback) {
            const searchLabel = this.searchTerm.trim() ? ` for "${this.searchTerm.trim()}"` : '';
            this.showToast(
              this.activities.length
                ? `${this.activities.length} activit${this.activities.length === 1 ? 'y' : 'ies'} loaded for ${this.selectedCity}.`
                : `No events are available in ${this.selectedCity}${searchLabel} right now.`,
              this.activities.length ? 'success' : 'info'
            );
          }
        },
        error: (error) => {
          if (requestId !== this.currentRequestId) {
            return;
          }

          console.error('Failed to load activities:', error);
          this.activities = cachedActivities;
          this.isShowingCachedResults = cachedActivities.length > 0;
          this.errorMessage = this.getLoadErrorMessage(error, cachedActivities.length > 0);
          this.persistViewState();
          this.flushView();

          if (showFeedback) {
            this.showToast(this.errorMessage, 'error');
          }
        },
      });
  }

  retryLoad(): void {
    if (this.loading || this.loadingMore) {
      return;
    }

    this.searchActivities(true);
  }

  updateCityText(value: string): void {
    this.cityText = value;
    this.activeCitySuggestions = true;
    this.activeKeywordSuggestions = false;
  }

  updateKeywordText(value: string): void {
    this.searchTerm = value;
    this.activeKeywordSuggestions = true;
    this.activeCitySuggestions = false;
  }

  showCitySuggestions(): void {
    this.activeCitySuggestions = true;
    this.activeKeywordSuggestions = false;
    this.activeDatePicker = false;
  }

  showKeywordSuggestions(): void {
    this.activeKeywordSuggestions = true;
    this.activeCitySuggestions = false;
    this.activeDatePicker = false;
  }

  toggleFiltersDrawer(): void {
    this.filtersDrawerOpen = !this.filtersDrawerOpen;
  }

  closeFiltersDrawer(): void {
    this.filtersDrawerOpen = false;
  }

  get citySuggestions(): SearchCity[] {
    const query = this.normalizeLookupValue(this.cityText);

    if (!query) {
      return [];
    }

    return this.cityOptions
      .filter((city) => {
        const haystack = [
          city.name,
          ...city.aliases,
        ]
          .map((value) => this.normalizeLookupValue(value))
          .join(' ');

        return haystack.includes(query);
      })
      .slice(0, 8);
  }

  get keywordSuggestions(): string[] {
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      return this.eventKeywords.slice(0, 8);
    }

    return this.eventKeywords.filter((keyword) => keyword.toLowerCase().includes(query)).slice(0, 8);
  }

  applyCity(city: SearchCity): void {
    this.cityText = city.name;
    this.selectedCity = city.name;
    this.activeCitySuggestions = false;
    this.errorMessage = '';
  }

  applyKeyword(keyword: string): void {
    this.searchTerm = keyword;
    this.activeKeywordSuggestions = false;
    this.errorMessage = '';
  }

  openActivityDetails(activity: Activity): void {
    this.persistViewState();
    this.router.navigate(['/activities', activity.id]);
  }

  selectActivity(activity: Activity): void {
    this.selectedActivity = activity;
    this.activityCalendarMessage = '';
    this.flushView();
  }

  closeSelectedActivity(): void {
    this.selectedActivity = null;
    this.activityCalendarMessage = '';
    this.isAddingActivityToCalendar = false;
    this.flushView();
  }

  async addSelectedActivityToCalendar(): Promise<void> {
    const activity = this.selectedActivity;

    if (!activity || this.isAddingActivityToCalendar) {
      return;
    }

    const calendarEvent = this.buildActivityCalendarEvent(activity);

    if (!calendarEvent) {
      this.activityCalendarMessage = 'This event is missing a valid date, so it cannot be added yet.';
      this.showToast(this.activityCalendarMessage, 'error');
      this.flushView();
      return;
    }

    this.isAddingActivityToCalendar = true;
    this.activityCalendarMessage = '';
    this.flushView();

    try {
      const result = await this.calendarService.addEventOrRedirectToLogin(calendarEvent);
      this.activityCalendarMessage = result === 'added'
        ? 'Added to calendar'
        : 'Continue with login to save this event to your calendar.';
      this.showToast(
        result === 'added'
          ? `${activity.title} added to calendar.`
          : 'Continue with login to save this event to your calendar.',
        result === 'added' ? 'success' : 'info'
      );
    } catch (error) {
      console.error('Failed to add activity to calendar:', error);
      this.activityCalendarMessage = 'Unable to add this event right now.';
      this.showToast(this.activityCalendarMessage, 'error');
    } finally {
      this.isAddingActivityToCalendar = false;
      this.flushView();
    }
  }

  loadMoreActivities(): void {
    if (this.loading || this.loadingMore || !this.hasSearched || !this.hasMoreResults || !this.selectedCity) {
      return;
    }

    const requestId = this.currentRequestId;
    const nextPage = this.currentPage + 1;
    const cacheKey = this.activitiesService.buildCacheKey(this.selectedCity, this.searchTerm);
    this.loadingMore = true;

    this.activitiesService
      .getActivities(this.selectedCity, this.searchTerm, nextPage, this.pageSize)
      .pipe(
        timeout(this.requestTimeoutMs),
        finalize(() => {
          if (requestId === this.currentRequestId) {
            this.loadingMore = false;
          }
        })
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.currentRequestId) {
            return;
          }

          const nextActivities = this.normalizeActivities(this.getResponseItems(response));
          this.activities = this.activitiesService.mergeCachedActivities(cacheKey, nextActivities);
          this.currentPage = nextPage;
          this.hasMoreResults = Boolean(response?.hasMore);
          this.isShowingCachedResults = false;
          this.errorMessage = '';
          this.persistViewState();
          this.queueViewportFillCheck();
          this.flushView();
        },
        error: (error) => {
          if (requestId !== this.currentRequestId) {
            return;
          }

          console.error('Failed to load more activities:', error);
          this.errorMessage = this.getLoadErrorMessage(error, this.activities.length > 0);
          this.persistViewState();
          this.flushView();
        },
      });
  }

  toggleDatePicker(): void {
    this.activeCitySuggestions = false;
    this.activeKeywordSuggestions = false;
    this.activeDatePicker = !this.activeDatePicker;

    if (this.activeDatePicker) {
      const selectedDate = this.parseDateInput(this.selectedDate) ?? this.today();
      this.datePickerMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      this.manualDateText = this.selectedDate;
      this.manualDateError = '';
    }
  }

  closeDatePicker(): void {
    this.activeDatePicker = false;
    this.manualDateError = '';
  }

  shiftDatePickerMonth(offset: number): void {
    this.datePickerMonth = new Date(
      this.datePickerMonth.getFullYear(),
      this.datePickerMonth.getMonth() + offset,
      1
    );
  }

  onCalendarDaySelect(day: CalendarDay): void {
    if (this.isPastDate(day.date)) {
      this.manualDateError = 'Choose today or a future date.';
      this.showToast(this.manualDateError, 'error');
      return;
    }

    this.selectedDate = this.formatDateInput(day.date);
    this.manualDateText = this.selectedDate;
    this.manualDateError = '';
    this.errorMessage = '';
    this.closeDatePicker();
  }

  clearDateFilter(): void {
    this.selectedDate = '';
    this.manualDateText = '';
    this.manualDateError = '';
    this.errorMessage = '';
    this.activeKeywordSuggestions = false;
    this.closeDatePicker();
  }

  updateActiveDatePickerInput(value: string): void {
    this.manualDateText = value;

    if (!value.trim()) {
      this.selectedDate = '';
      this.manualDateError = '';
      this.errorMessage = '';
      return;
    }

    const parsed = this.parseDateInput(value);
    if (!parsed) {
      this.manualDateError = 'Use a valid date in YYYY-MM-DD format.';
      return;
    }

    if (this.isPastDate(parsed)) {
      this.manualDateError = 'Choose today or a future date.';
      return;
    }

    this.selectedDate = this.formatDateInput(parsed);
    this.datePickerMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    this.manualDateError = '';
    this.errorMessage = '';
  }

  activeDatePickerTitle(): string {
    return 'Choose event date';
  }

  activeDatePickerHint(): string {
    return this.manualDateError || 'Choose today or a future event day.';
  }

  activeDatePickerInputValue(): string {
    return this.manualDateText;
  }

  datePickerMonthLabel(): string {
    return this.datePickerMonth.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }

  calendarDays(): CalendarDay[] {
    const month = this.datePickerMonth;
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - mondayOffset);
    const selected = this.parseDateInput(this.selectedDate);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === month.getMonth(),
        isSelected: this.isSameDate(date, selected),
        isToday: this.isSameDate(date, this.today()),
      };
    });
  }

  get availableCategories(): string[] {
    const dynamicCategories = this.uniqueActivities
      .map((activity) => activity.category?.trim())
      .filter((category): category is string => !!category);

    return Array.from(new Set([...this.defaultCategories, ...dynamicCategories]));
  }

  get uniqueActivities(): Activity[] {
    if (this.uniqueActivitiesCacheSource === this.activities) {
      return this.uniqueActivitiesCache;
    }

    const seen = new Map<string, Activity>();

    for (const activity of this.activities) {
      const key = [
        activity.title?.trim().toLowerCase(),
        activity.city?.trim().toLowerCase(),
        activity.venue?.trim().toLowerCase(),
        String(activity.startDate ?? '').trim().toLowerCase(),
      ].join('|');

      if (!seen.has(key)) {
        seen.set(key, activity);
      }
    }

    this.uniqueActivitiesCacheSource = this.activities;
    this.uniqueActivitiesCache = Array.from(seen.values());
    return this.uniqueActivitiesCache;
  }

  get filteredActivities(): Activity[] {
    const uniqueActivities = this.uniqueActivities;
    const signature = [
      this.searchTerm.trim().toLowerCase(),
      this.selectedCategory,
      this.selectedPriceLevel,
      this.selectedTimeOfDay,
      this.selectedSort,
      this.selectedDate,
      uniqueActivities.length,
    ].join('|');

    if (
      this.filteredActivitiesCacheSource === uniqueActivities &&
      this.filteredActivitiesCacheSignature === signature
    ) {
      return this.filteredActivitiesCache;
    }

    let filtered = uniqueActivities.filter((activity) => {
      const matchesCategory =
        this.selectedCategory === 'All Categories' || activity.category === this.selectedCategory;

      const matchesPrice =
        this.selectedPriceLevel === 'All Prices' ||
        this.getDisplayPriceLevel(activity) === this.selectedPriceLevel;

      const matchesTime =
        this.selectedTimeOfDay === 'Any Time' || activity.timeOfDay === this.selectedTimeOfDay;

      const matchesDate = !this.selectedDate || this.activityMatchesSelectedDate(activity);

      return matchesCategory && matchesPrice && matchesTime && matchesDate;
    });

    switch (this.selectedSort) {
      case 'rating':
        filtered = [...filtered].sort((a, b) => b.rating - a.rating);
        break;
      case 'price-low':
        filtered = [...filtered].sort((a, b) => this.getNumericPrice(a) - this.getNumericPrice(b));
        break;
      case 'price-high':
        filtered = [...filtered].sort((a, b) => this.getNumericPrice(b) - this.getNumericPrice(a));
        break;
      case 'title':
        filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        filtered = [...filtered].sort((a, b) => {
          const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
          if (featuredDiff !== 0) {
            return featuredDiff;
          }
          return b.rating - a.rating;
        });
    }

    this.filteredActivitiesCacheSource = uniqueActivities;
    this.filteredActivitiesCacheSignature = signature;
    this.filteredActivitiesCache = filtered;

    return this.filteredActivitiesCache;
  }

  get totalActivities(): number {
    return this.uniqueActivities.length;
  }

  get filteredCount(): number {
    return this.filteredActivities.length;
  }

  get featuredCount(): number {
    return this.uniqueActivities.filter((activity) => activity.featured).length;
  }

  resetFilters(): void {
    this.selectedCategory = 'All Categories';
    this.selectedPriceLevel = 'All Prices';
    this.selectedTimeOfDay = 'Any Time';
    this.selectedSort = 'recommended';
    this.selectedDate = '';
    this.manualDateText = '';
    this.manualDateError = '';
    this.errorMessage = '';
    this.activeCitySuggestions = false;
    this.activeKeywordSuggestions = false;
    this.activeDatePicker = false;
    this.filtersDrawerOpen = false;
    this.persistViewState();
    this.showToast('Filters reset.', 'info');
  }

  getCategoryClass(category: string): string {
    return category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '');
  }

  trackByActivityId(_index: number, activity: Activity): string {
    return activity.id;
  }

  getImageUrl(image?: string): string {
    if (!image || !image.trim()) {
      return this.fallbackImage;
    }

    return image;
  }

  getDisplayDescription(activity: Activity): string {
    const raw = (activity.info || activity.description || '').trim();

    if (!raw || raw === 'Live event details are loading.') {
      return 'Details are limited for this event. Open the detail page for the latest event information.';
    }

    return raw;
  }

  getDisplayDuration(activity: Activity): string {
    const raw = (activity.duration || '').trim();

    if (!raw || raw === '2h') {
      return 'See event time';
    }

    return raw;
  }

  getDisplayPrice(activity: Activity): string {
    if (typeof activity.price === 'number' && activity.price > 0) {
      return `€${activity.price}`;
    }

    if (activity.priceLevel && activity.priceLevel !== 'Free') {
      return activity.priceLevel;
    }

    return 'See ticket page';
  }

  getDisplayPriceLevel(activity: Activity): string {
    if (typeof activity.price === 'number' && activity.price > 0) {
      return activity.priceLevel || 'Ticketed';
    }

    if (activity.priceLevel && activity.priceLevel !== 'Free') {
      return activity.priceLevel;
    }

    return 'Unknown';
  }

  getNumericPrice(activity: Activity): number {
    if (typeof activity.price === 'number' && Number.isFinite(activity.price) && activity.price > 0) {
      return activity.price;
    }

    return Number.MAX_SAFE_INTEGER;
  }

  getDisplayStartDate(activity: Activity): string {
    const parsed = this.parseActivityStartDate(activity.startDate);

    if (!parsed) {
      return 'Date pending';
    }

    return parsed.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }

  formatSelectedDate(value: string): string {
    const parsed = this.parseDateInput(value);

    if (!parsed) {
      return '';
    }

    return parsed.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }

  formatSelectedYear(value: string): string {
    const parsed = this.parseDateInput(value);
    return parsed ? String(parsed.getFullYear()) : '';
  }

  getDisplayStartTime(activity: Activity): string {
    const parsed = this.parseActivityDateTime(activity.startDate);

    if (!parsed) {
      return activity.timeOfDay || 'Time pending';
    }

    return parsed.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getDisplayStatus(activity: Activity): string {
    const status = (activity.status || '').trim().toLowerCase();

    if (!status) {
      return 'On sale';
    }

    return status
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  getDisplayGenre(activity: Activity): string {
    return activity.genre || activity.subGenre || activity.segment || activity.category;
  }

  hasTicketLink(activity: Activity): boolean {
    return Boolean(activity.url?.trim());
  }

  getSelectedActivityImages(activity: Activity): string[] {
    const images = Array.isArray(activity.images)
      ? activity.images.map((image) => image?.url?.trim() || '').filter(Boolean)
      : [];

    if (images.length > 0) {
      return images;
    }

    return activity.image?.trim() ? [activity.image.trim()] : [this.fallbackImage];
  }

  isPastCalendarDay(day: CalendarDay): boolean {
    return this.isPastDate(day.date);
  }

  categoryResultCount(category: string): number {
    return this.uniqueActivities.filter((activity) =>
      category === 'All Categories' ? true : activity.category === category
    ).length;
  }

  priceResultCount(priceLevel: string): number {
    return this.uniqueActivities.filter((activity) =>
      priceLevel === 'All Prices' ? true : this.getDisplayPriceLevel(activity) === priceLevel
    ).length;
  }

  timeResultCount(timeOfDay: string): number {
    return this.uniqueActivities.filter((activity) =>
      timeOfDay === 'Any Time' ? true : activity.timeOfDay === timeOfDay
    ).length;
  }

  private normalizeActivities(activities: Activity[]): Activity[] {
    return activities.map((activity, index) => {
      const pricing = this.normalizePricing(activity, index);

      return {
        ...(activity ?? {}),
        id: activity?.id?.trim() || `${this.selectedCity}-${index}-${activity?.title?.trim() || 'activity'}`,
        title: activity?.title?.trim() || 'Untitled activity',
        type: activity?.type?.trim() || 'event',
        url: activity?.url?.trim() || '',
        locale: activity?.locale?.trim() || '',
        source: activity?.source?.trim() || '',
        city: activity?.city?.trim() || this.selectedCity,
        country: activity?.country?.trim() || 'Germany',
        state: activity?.state?.trim() || '',
        category: activity?.category?.trim() || 'Miscellaneous',
        segment: activity?.segment?.trim() || '',
        genre: activity?.genre?.trim() || '',
        subGenre: activity?.subGenre?.trim() || '',
        priceLevel: pricing.priceLevel,
        priceCurrency: pricing.priceCurrency,
        price: pricing.price,
        minPrice: pricing.minPrice,
        maxPrice: pricing.maxPrice,
        rating: typeof activity?.rating === 'number' && Number.isFinite(activity.rating) ? activity.rating : 0,
        timeOfDay: activity?.timeOfDay?.trim() || 'Any Time',
        duration: activity?.duration?.trim() || 'See event time',
        venue: activity?.venue?.trim() || 'Venue details pending',
        venueId: activity?.venueId?.trim() || '',
        venueUrl: activity?.venueUrl?.trim() || '',
        venueTimezone: activity?.venueTimezone?.trim() || '',
        venueAddress: activity?.venueAddress?.trim() || '',
        venuePostalCode: activity?.venuePostalCode?.trim() || '',
        venueLatitude: typeof activity?.venueLatitude === 'number' && Number.isFinite(activity.venueLatitude) ? activity.venueLatitude : null,
        venueLongitude: typeof activity?.venueLongitude === 'number' && Number.isFinite(activity.venueLongitude) ? activity.venueLongitude : null,
        description: activity?.description?.trim() || activity?.info?.trim() || 'Live event details are loading.',
        info: activity?.info?.trim() || '',
        pleaseNote: activity?.pleaseNote?.trim() || '',
        image: activity?.image?.trim() || '',
        seatmapUrl: activity?.seatmapUrl?.trim() || '',
        accessibilityInfo: activity?.accessibilityInfo?.trim() || '',
        ticketLimitInfo: activity?.ticketLimitInfo?.trim() || '',
        status: activity?.status?.trim() || '',
        promoterName: activity?.promoterName?.trim() || '',
        promoterDescription: activity?.promoterDescription?.trim() || '',
        featured: Boolean(activity?.featured),
        tba: Boolean(activity?.tba),
        tbd: Boolean(activity?.tbd),
        spanMultipleDays: Boolean(activity?.spanMultipleDays),
        startDate: activity?.startDate || null,
        endDate: activity?.endDate || null,
        salesStartDate: activity?.salesStartDate || null,
        salesEndDate: activity?.salesEndDate || null,
        sales: activity?.sales ?? null,
        priceRanges: Array.isArray(activity?.priceRanges) ? activity.priceRanges : [],
        images: Array.isArray(activity?.images) ? activity.images : [],
        venueDetails: activity?.venueDetails ?? null,
        attractions: Array.isArray(activity?.attractions) ? activity.attractions : [],
        classifications: Array.isArray(activity?.classifications) ? activity.classifications : [],
        promoter: activity?.promoter ?? null,
        promoters: Array.isArray(activity?.promoters) ? activity.promoters : [],
        outlets: Array.isArray(activity?.outlets) ? activity.outlets : [],
        products: Array.isArray(activity?.products) ? activity.products : [],
      };
    });
  }

  private getLoadErrorMessage(error: unknown, hasCachedResults: boolean): string {
    const serverMessage = this.getServerErrorMessage(error);

    if (error && typeof error === 'object' && 'name' in error && error.name === 'TimeoutError') {
      return hasCachedResults
        ? `Live results for ${this.selectedCity} timed out. Showing saved activities instead.`
        : 'Activity search timed out. Please try again.';
    }

    if (error && typeof error === 'object' && 'status' in error && error.status === 0) {
      return hasCachedResults
        ? `The live activities API is unreachable. Showing saved results for ${this.selectedCity}.`
        : 'The activities API is unreachable. Make sure the backend is running and try again.';
    }

    if (serverMessage) {
      return serverMessage;
    }

    return hasCachedResults
      ? `Live results for ${this.selectedCity} are unavailable. Showing saved activities instead.`
      : 'Could not load activities right now. Please try again.';
  }

  private showToast(message: string, type: StatusToastType = 'info'): void {
    this.toastMessage = message;
    this.toastType = type;

    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }

    this.toastTimeoutId = setTimeout(() => {
      this.toastMessage = '';
      this.toastTimeoutId = null;
    }, 2600);
  }

  private normalizeCityInput(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    const query = this.normalizeLookupValue(trimmed);
    const matchedCity = this.cityOptions.find((city) => {
      const values = [city.name, ...city.aliases].map((candidate) => this.normalizeLookupValue(candidate));
      return values.includes(query);
    });

    if (matchedCity) {
      return matchedCity.name;
    }

    return trimmed
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private normalizeLookupValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private persistViewState(): void {
    this.activitiesService.setViewState({
      cityText: this.cityText,
      selectedCity: this.selectedCity,
      searchTerm: this.searchTerm,
      selectedCategory: this.selectedCategory,
      selectedPriceLevel: this.selectedPriceLevel,
      selectedTimeOfDay: this.selectedTimeOfDay,
      selectedSort: this.selectedSort,
      selectedDate: this.selectedDate,
      hasSearched: this.hasSearched,
      isShowingCachedResults: this.isShowingCachedResults,
      errorMessage: this.errorMessage,
      activities: this.activities,
      scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
      currentPage: this.currentPage,
      hasMoreResults: this.hasMoreResults,
    });
  }

  private restoreViewState(): void {
    const state = this.activitiesService.getViewState<ActivitiesListViewState>();

    if (!state) {
      this.activities = [];
      return;
    }

    this.cityText = state.cityText || '';
    this.selectedCity = state.selectedCity || '';
    this.searchTerm = state.searchTerm || '';
    this.selectedCategory = state.selectedCategory || 'All Categories';
    this.selectedPriceLevel = state.selectedPriceLevel || 'All Prices';
    this.selectedTimeOfDay = state.selectedTimeOfDay || 'Any Time';
    this.selectedSort = state.selectedSort || 'recommended';
    this.selectedDate = state.selectedDate || '';
    this.hasSearched = Boolean(state.hasSearched);
    this.isShowingCachedResults = Boolean(state.isShowingCachedResults);
    this.errorMessage = state.errorMessage || '';
    this.currentPage = Number.isFinite(state.currentPage) ? state.currentPage : 0;
    this.hasMoreResults = Boolean(state.hasMoreResults);
    this.activities = this.normalizeActivities(Array.isArray(state.activities) ? state.activities : []);
    this.flushView();

    if (typeof window !== 'undefined') {
      this.scrollToPageTop();
    }
  }

  private scrollToPageTop(): void {
    if (typeof window === 'undefined') {
      return;
    }

    setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }

  private normalizePricing(activity: Activity | undefined, index: number): {
    price: number;
    minPrice: number;
    maxPrice: number;
    priceCurrency: string;
    priceLevel: string;
  } {
    const priceLevel = activity?.priceLevel?.trim() || '';
    const priceCurrency = activity?.priceCurrency?.trim() || 'EUR';
    const hasExplicitFreePrice = priceLevel === 'Free';
    const fallbackPrice = this.generateFallbackPrice(activity, index);
    const basePrice = this.toPositiveNumber(activity?.price);
    const minPrice = this.toPositiveNumber(activity?.minPrice);
    const maxPrice = this.toPositiveNumber(activity?.maxPrice);

    if (hasExplicitFreePrice) {
      return {
        price: 0,
        minPrice: 0,
        maxPrice: 0,
        priceCurrency,
        priceLevel: 'Free',
      };
    }

    const resolvedMinPrice = this.roundPrice(minPrice || basePrice || fallbackPrice);
    const resolvedPrice = this.roundPrice(basePrice || resolvedMinPrice);
    const resolvedMaxPrice = this.roundPrice(maxPrice && maxPrice >= resolvedMinPrice ? maxPrice : resolvedMinPrice);

    return {
      price: resolvedPrice,
      minPrice: resolvedMinPrice,
      maxPrice: resolvedMaxPrice,
      priceCurrency,
      priceLevel: priceLevel && priceLevel !== 'Unknown' ? priceLevel : this.resolvePriceLevelFromValue(resolvedPrice),
    };
  }

  private generateFallbackPrice(activity: Activity | undefined, index: number): number {
    const seed = [
      activity?.id,
      activity?.title,
      activity?.venue,
      activity?.startDate,
      this.selectedCity,
      index,
    ].filter(Boolean).join('|');

    let hash = 0;

    for (let i = 0; i < seed.length; i += 1) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }

    return 15 + (Math.abs(hash) % 106);
  }

  private toPositiveNumber(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  }

  private roundPrice(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private resolvePriceLevelFromValue(price: number): string {
    if (price <= 25) {
      return 'Budget';
    }

    if (price <= 75) {
      return 'Mid-Range';
    }

    return 'Premium';
  }

  private getResponseItems(response: ActivitySearchResponse | null | undefined): Activity[] {
    return Array.isArray(response?.items) ? response.items : [];
  }

  private loadMoreIfNeeded(): void {
    if (!this.shouldLoadMore()) {
      return;
    }

    this.loadMoreActivities();
  }

  private shouldLoadMore(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    if (this.loading || this.loadingMore || !this.hasMoreResults || !this.hasSearched || this.filteredActivities.length === 0) {
      return false;
    }

    const scrollPosition = window.innerHeight + window.scrollY;
    const threshold = document.documentElement.scrollHeight - 320;
    return scrollPosition >= threshold;
  }

  private queueViewportFillCheck(): void {
    if (typeof window === 'undefined') {
      return;
    }

    setTimeout(() => {
      if (document.documentElement.scrollHeight <= window.innerHeight + 120 && this.hasMoreResults) {
        this.loadMoreActivities();
      }
    });
  }

  private flushView(): void {
    if (typeof window === 'undefined') {
      this.cdr.detectChanges();
      return;
    }

    requestAnimationFrame(() => {
      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });
    });
  }

  private getServerErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object' || !('error' in error)) {
      return '';
    }

    const payload = error.error;

    if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
      return payload.message;
    }

    return '';
  }

  private activityMatchesSelectedDate(activity: Activity): boolean {
    const activityDate = this.parseActivityStartDate(activity.startDate);
    const selectedDate = this.parseDateInput(this.selectedDate);

    return !!activityDate && !!selectedDate && this.isSameDate(activityDate, selectedDate);
  }

  private parseActivityStartDate(value?: string | null): Date | null {
    return this.parseActivityDateTime(value);
  }

  private buildActivityCalendarEvent(activity: Activity): CalendarEvent | null {
    const startDate = this.extractCalendarDate(activity.startDate);

    if (!startDate) {
      return null;
    }

    return {
      title: activity.title,
      startDate,
      endDate: this.extractCalendarDate(activity.endDate) || startDate,
      price: this.getNumericPrice(activity) === Number.MAX_SAFE_INTEGER ? 0 : this.getNumericPrice(activity),
      location: [activity.venue, activity.city, activity.country].filter(Boolean).join(', '),
      category: 'Activity',
      description: this.buildActivityCalendarDescription(activity)
    };
  }

  private buildActivityCalendarDescription(activity: Activity): string {
    return [
      `Event: ${activity.title}`,
      `Venue: ${activity.venue}`,
      `Location: ${activity.city}, ${activity.country}`,
      `Date: ${this.getDisplayStartDate(activity)}`,
      `Time: ${this.getDisplayStartTime(activity)}`,
      `Category: ${activity.category}`,
      `Price: ${this.getDisplayPrice(activity)}`,
      `Details: ${this.getDisplayDescription(activity)}`
    ].join('\n');
  }

  private extractCalendarDate(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return this.formatDateInput(parsed);
  }

  private parseActivityDateTime(value?: string | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private parseDateInput(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return null;
    }

    const [year, month, day] = trimmed.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }

    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private validateSelectedDate(): boolean {
    if (!this.selectedDate) {
      this.manualDateError = '';
      return true;
    }

    const parsed = this.parseDateInput(this.selectedDate);
    if (!parsed) {
      this.manualDateError = 'Use a valid date in YYYY-MM-DD format.';
      return false;
    }

    if (this.isPastDate(parsed)) {
      this.manualDateError = 'Choose today or a future date.';
      return false;
    }

    this.manualDateError = '';
    return true;
  }

  private isPastDate(date: Date): boolean {
    return date.getTime() < this.today().getTime();
  }

  private today(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private isSameDate(a: Date | null, b: Date | null): boolean {
    if (!a || !b) {
      return false;
    }

    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
