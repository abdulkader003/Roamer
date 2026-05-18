import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type ActivityCategory =
  | 'Sightseeing'
  | 'Adventure'
  | 'Nightlife'
  | 'Food & Drink'
  | 'Relax'
  | 'Culture'
  | string;

export type PriceLevel = 'Free' | 'Budget' | 'Mid-Range' | 'Premium' | string;
export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night' | string;

export interface ActivityImage {
  url?: string;
  ratio?: string;
  width?: number;
  height?: number;
  fallback?: boolean;
  attribution?: string;
}

export interface ActivityPriceRange {
  type?: string;
  currency?: string;
  min?: number;
  max?: number;
}

export interface ActivityEntityRef {
  id?: string;
  name?: string;
}

export interface ActivityClassification {
  primary?: boolean;
  family?: boolean;
  segment?: ActivityEntityRef;
  genre?: ActivityEntityRef;
  subGenre?: ActivityEntityRef;
  type?: ActivityEntityRef;
  subType?: ActivityEntityRef;
}

export interface ActivityAttraction {
  id?: string;
  name?: string;
  type?: string;
  url?: string;
  images?: ActivityImage[];
  classifications?: ActivityClassification[];
}

export interface ActivityPromoter {
  id?: string;
  name?: string;
  description?: string;
}

export interface ActivityOutlet {
  url?: string;
  type?: string;
}

export interface ActivityProduct {
  id?: string;
  name?: string;
  type?: string;
  url?: string;
}

export interface ActivityAddress {
  line1?: string;
  line2?: string;
  line3?: string;
}

export interface ActivityLocation {
  latitude?: string;
  longitude?: string;
}

export interface ActivityVenueDetails {
  id?: string;
  name?: string;
  type?: string;
  url?: string;
  timezone?: string;
  postalCode?: string;
  address?: ActivityAddress;
  city?: ActivityEntityRef;
  state?: {
    name?: string;
    stateCode?: string;
  };
  country?: {
    name?: string;
    countryCode?: string;
  };
  location?: ActivityLocation;
  parkingDetail?: string;
  accessibleSeatingDetail?: string;
  generalInfo?: {
    generalRule?: string;
    childRule?: string;
  };
  boxOfficeInfo?: {
    phoneNumberDetail?: string;
    openHoursDetail?: string;
    acceptedPaymentDetail?: string;
    willCallDetail?: string;
  };
  social?: {
    twitter?: {
      handle?: string;
      hashtags?: string[];
    };
  };
}

export interface ActivityPresale {
  name?: string;
  description?: string;
  url?: string;
  startDateTime?: string;
  endDateTime?: string;
}

export interface ActivitySales {
  public?: {
    startDateTime?: string;
    endDateTime?: string;
    startTBD?: boolean;
  };
  presales?: ActivityPresale[];
}

export interface Activity {
  id: string;
  title: string;
  type?: string;
  url?: string;
  locale?: string;
  source?: string;
  city: string;
  country: string;
  state?: string;
  category: ActivityCategory;
  segment?: string;
  genre?: string;
  subGenre?: string;
  priceLevel: PriceLevel;
  priceCurrency?: string;
  price: number;
  minPrice?: number;
  maxPrice?: number;
  rating: number;
  timeOfDay: TimeOfDay;
  duration: string;
  venue: string;
  venueId?: string;
  venueUrl?: string;
  venueTimezone?: string;
  venueAddress?: string;
  venuePostalCode?: string;
  venueLatitude?: number | null;
  venueLongitude?: number | null;
  description: string;
  info?: string;
  pleaseNote?: string;
  image: string;
  seatmapUrl?: string;
  accessibilityInfo?: string;
  ticketLimitInfo?: string;
  status?: string;
  promoterName?: string;
  promoterDescription?: string;
  featured?: boolean;
  tba?: boolean;
  tbd?: boolean;
  spanMultipleDays?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  salesStartDate?: string | null;
  salesEndDate?: string | null;
  sales?: ActivitySales | null;
  priceRanges?: ActivityPriceRange[] | null;
  images?: ActivityImage[] | null;
  venueDetails?: ActivityVenueDetails | null;
  attractions?: ActivityAttraction[] | null;
  classifications?: ActivityClassification[] | null;
  promoter?: ActivityPromoter | null;
  promoters?: ActivityPromoter[] | null;
  outlets?: ActivityOutlet[] | null;
  products?: ActivityProduct[] | null;
}

export interface ActivitySearchResponse {
  items: Activity[];
  page: number;
  size: number;
  hasMore: boolean;
}

type ActivitiesCacheStore = Record<string, Activity[]>;

@Injectable({
  providedIn: 'root',
})
export class ActivitiesService {
  private readonly apiUrl = '/api/activities';
  private readonly cacheKey = 'roamer_activities_cache';
  private readonly detailKeyPrefix = '__detail__::';
  private readonly viewStateKey = 'roamer_activities_view_state';

  constructor(private readonly http: HttpClient) {}

  getActivities(city?: string, keyword?: string, page = 0, size = 12): Observable<ActivitySearchResponse> {
    let params = new HttpParams();

    if (city && city !== 'All Cities') {
      params = params.set('city', city);
    }

    if (keyword && keyword.trim()) {
      params = params.set('keyword', keyword.trim());
    }

    params = params
      .set('page', page)
      .set('size', size);

    return this.http.get<ActivitySearchResponse>(this.apiUrl, { params }).pipe(
      tap((response) => {
        if (Array.isArray(response?.items)) {
          response.items.forEach((activity) => this.setCachedActivity(activity));
        }
      })
    );
  }

  getActivityById(id: string): Observable<Activity> {
    return this.http.get<Activity>(`${this.apiUrl}/${id}`).pipe(
      tap((activity) => this.setCachedActivity(activity))
    );
  }

  setCachedActivities(cacheKey: string, activities: Activity[]): void {
    try {
      const store = this.getCacheStore();
      store[cacheKey] = Array.isArray(activities) ? activities : [];

      if (Array.isArray(activities)) {
        activities.forEach((activity) => {
          if (activity?.id) {
            store[this.detailCacheKey(activity.id)] = [activity];
          }
        });
      }

      sessionStorage.setItem(this.cacheKey, JSON.stringify(store));
    } catch (error) {
      console.warn('Could not cache activities in sessionStorage', error);
    }
  }

  mergeCachedActivities(cacheKey: string, activities: Activity[]): Activity[] {
    const existing = this.getCachedActivities(cacheKey);
    const merged = new Map<string, Activity>();

    existing.forEach((activity) => {
      if (activity?.id) {
        merged.set(activity.id, activity);
      }
    });

    activities.forEach((activity) => {
      if (activity?.id) {
        merged.set(activity.id, activity);
      }
    });

    const result = Array.from(merged.values());
    this.setCachedActivities(cacheKey, result);
    return result;
  }

  setCachedActivity(activity: Activity): void {
    if (!activity?.id) {
      return;
    }

    try {
      const store = this.getCacheStore();
      store[this.detailCacheKey(activity.id)] = [activity];

      for (const [key, activities] of Object.entries(store)) {
        if (!Array.isArray(activities) || key.startsWith(this.detailKeyPrefix)) {
          continue;
        }

        store[key] = activities.map((current) => current.id === activity.id ? activity : current);
      }

      sessionStorage.setItem(this.cacheKey, JSON.stringify(store));
    } catch (error) {
      console.warn('Could not cache activity details in sessionStorage', error);
    }
  }

  getCachedActivities(cacheKey?: string): Activity[] {
    try {
      const store = this.getCacheStore();

      if (cacheKey) {
        return Array.isArray(store[cacheKey]) ? store[cacheKey] : [];
      }

      return Object.entries(store)
        .filter(([key]) => !key.startsWith(this.detailKeyPrefix))
        .flatMap(([, activities]) => Array.isArray(activities) ? activities : []);
    } catch (error) {
      console.warn('Could not read cached activities from sessionStorage', error);
      return [];
    }
  }

  getCachedActivityById(id: string): Activity | null {
    const store = this.getCacheStore();
    const detail = store[this.detailCacheKey(id)];
    if (Array.isArray(detail) && detail[0]) {
      return detail[0];
    }

    const activities = this.getCachedActivities();
    return activities.find((activity) => activity.id === id) ?? null;
  }

  buildCacheKey(city?: string, keyword?: string): string {
    const normalizedCity = city?.trim().toLowerCase() || 'all-cities';
    const normalizedKeyword = keyword?.trim().toLowerCase() || 'all-keywords';
    return `${normalizedCity}::${normalizedKeyword}`;
  }

  setViewState(state: Record<string, unknown>): void {
    try {
      sessionStorage.setItem(this.viewStateKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Could not save activities view state', error);
    }
  }

  getViewState<T>(): T | null {
    try {
      const raw = sessionStorage.getItem(this.viewStateKey);

      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn('Could not read activities view state', error);
      return null;
    }
  }

  private detailCacheKey(id: string): string {
    return `${this.detailKeyPrefix}${id}`;
  }

  private getCacheStore(): ActivitiesCacheStore {
    const raw = sessionStorage.getItem(this.cacheKey);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ActivitiesCacheStore : {};
  }
}
