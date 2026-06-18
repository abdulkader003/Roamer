import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, timeout } from 'rxjs';
import { Hotel } from '../../../hotels/models/hotel.model';
import { HotelService } from '../../../hotels/services/hotel.service';
import { TripPlanningService } from '../../../../services/trip-planning.service';

interface TripStep {
  label: string;
  route?: string;
}

interface TripPlanningHotel extends Hotel {
  tripCity: string;
}

@Component({
  selector: 'app-hotels-step',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './hotels-step.component.html',
  styleUrl: './hotels-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HotelsStepComponent implements OnInit {
  private readonly hotelService = inject(HotelService);
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
  readonly hotels = signal<TripPlanningHotel[]>([]);
  readonly selectedHotel = signal<TripPlanningHotel | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly loadError = signal('');
  readonly loadWarning = signal('');
  readonly saveError = signal('');
  readonly tripPlanningId = signal<number | null>(null);
  readonly selectedCities = signal<string[]>(['Barcelona']);
  readonly imageIndexes = signal<Record<string, number>>({});
  readonly failedImageUrls = signal<Record<string, string[]>>({});

  readonly nights = 7;
  readonly guests = 2;
  readonly checkIn = this.formatDate(this.addDays(new Date(), 30));
  readonly checkOut = this.formatDate(this.addDays(new Date(), 37));
  readonly fallbackHotelImage =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 520%22%3E%3Crect width=%22800%22 height=%22520%22 fill=%22%23eef4fb%22/%3E%3Cpath d=%22M130 390h540L535 245l-95 105-70-75z%22 fill=%22%23c9d8eb%22/%3E%3Ccircle cx=%22595%22 cy=%22150%22 r=%2245%22 fill=%22%23dbe6f4%22/%3E%3Ctext x=%22400%22 y=%22455%22 text-anchor=%22middle%22 fill=%22%2370879f%22 font-family=%22Arial,sans-serif%22 font-size=%2232%22 font-weight=%22700%22%3EHotel image unavailable%3C/text%3E%3C/svg%3E';

  ngOnInit(): void {
    const tripPlanningId = Number(this.route.snapshot.queryParamMap.get('tripPlanningId'));
    this.tripPlanningId.set(Number.isFinite(tripPlanningId) && tripPlanningId > 0 ? tripPlanningId : null);
    this.selectedCities.set(this.readSelectedCities());
    this.loadHotels();
  }

  loadHotels(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    this.loadWarning.set('');
    this.selectedHotel.set(null);
    const cities = this.selectedCities();

    // Fetches hotels for each selected city using the existing hotel API.
    forkJoin(cities.map((city) => this.searchHotelsForCity(city)))
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (results) => {
          const successfulResults = results.filter((result) => result.success);
          const failedCities = results.filter((result) => !result.success).map((result) => result.city);
          const hotels = successfulResults.flatMap((result) => result.hotels);

          this.hotels.set(hotels);

          if (failedCities.length && hotels.length) {
            this.loadWarning.set(`Some hotel searches failed: ${failedCities.join(', ')}.`);
          }

          if (!hotels.length) {
            this.loadError.set('Could not load hotels for the selected cities. Please try again.');
          }
        },
      });
  }

  selectHotel(hotel: TripPlanningHotel): void {
    // Allows users to change their mind and remove a hotel selection.
    this.selectedHotel.set(this.isSelectedHotel(hotel) ? null : hotel);
    this.saveError.set('');
  }

  selectHotelFromKeyboard(event: KeyboardEvent, hotel: TripPlanningHotel): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.selectHotel(hotel);
  }

  isSelectedHotel(hotel: TripPlanningHotel): boolean {
    const selectedHotel = this.selectedHotel();
    return selectedHotel?.id === hotel.id && selectedHotel.tripCity === hotel.tripCity;
  }

  cardImages(hotel: Hotel): string[] {
    const failedImages = this.failedImageUrls()[this.hotelImageKey(hotel as TripPlanningHotel)] ?? [];
    const images = (hotel.images ?? [])
      .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
      .map((image) => image.trim())
      .filter((image, index, allImages) => allImages.indexOf(image) === index)
      .filter((image) => !failedImages.includes(image));

    if (images.length) {
      return images;
    }

    const primaryImage = typeof hotel.image === 'string' ? hotel.image.trim() : '';
    return primaryImage && !failedImages.includes(primaryImage) ? [primaryImage] : [];
  }

  imageSource(hotel: TripPlanningHotel): string {
    const images = this.cardImages(hotel);
    const imageIndex = Math.min(this.currentImageIndex(hotel), Math.max(images.length - 1, 0));

    return images[imageIndex] ?? this.fallbackHotelImage;
  }

  currentImageIndex(hotel: TripPlanningHotel): number {
    const images = this.cardImages(hotel);
    const imageIndex = this.imageIndexes()[this.hotelImageKey(hotel)] ?? 0;

    if (!images.length) {
      return 0;
    }

    return Math.min(imageIndex, images.length - 1);
  }

  selectHotelImage(hotel: TripPlanningHotel, index: number, event: Event): void {
    event.stopPropagation();
    // Allows image navigation through indicator dots.
    this.setHotelImageIndex(hotel, index);
  }

  handleHotelImageError(hotel: TripPlanningHotel, image: string): void {
    if (!image || image === this.fallbackHotelImage) {
      return;
    }

    const imageKey = this.hotelImageKey(hotel);

    // Removes broken image URLs from this card's carousel.
    this.failedImageUrls.update((failedImages) => ({
      ...failedImages,
      [imageKey]: Array.from(new Set([...(failedImages[imageKey] ?? []), image])),
    }));
    this.setHotelImageIndex(hotel, this.currentImageIndex(hotel));
  }

  continueToActivities(): void {
    const hotel = this.selectedHotel();

    if (!hotel || this.isSaving()) {
      return;
    }
    // TODO: allow selecting one hotel per city for multi-city trips.

    const tripPlanningId = this.tripPlanningId();

    if (!tripPlanningId) {
      this.saveError.set('Trip planning session is missing. Continue from the Budget step first.');
      return;
    }

    this.isSaving.set(true);
    this.saveError.set('');

    this.tripPlanningService
      .saveHotelStep(tripPlanningId, { hotelId: hotel.id })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          if (this.routeExists('/trips/create/activities')) {
            void this.router.navigate(['/trips/create/activities'], { queryParams: this.tripPlanningQueryParams() });
          }
        },
        error: () => {
          this.saveError.set('Could not save your hotel. Please try again.');
        },
      });
  }

  goToPreviousStep(): void {
    const destinationRoute = '/trips/create/destination';

    if (this.routeExists(destinationRoute)) {
      void this.router.navigate([destinationRoute], { queryParams: this.tripPlanningQueryParams() });
      return;
    }

    // Navigate only to implemented trip planning steps.
    void this.router.navigate(['/trips/create/budget'], { queryParams: this.tripPlanningQueryParams() });
  }

  previousButtonLabel(): string {
    return this.routeExists('/trips/create/destination') ? 'Previous — Destination' : 'Previous — Budget';
  }

  stepRoute(step: TripStep): string | null {
    return step.route && this.routeExists(step.route) ? step.route : null;
  }

  tripPlanningQueryParams(): { tripPlanningId: number } | undefined {
    const tripPlanningId = this.tripPlanningId();
    return tripPlanningId ? { tripPlanningId } : undefined;
  }

  subtitle(): string {
    return `${this.selectedCities().join(', ')} · ${this.nights} nights · ${this.guests} guests`;
  }

  isMultiCityTrip(): boolean {
    return this.selectedCities().length > 1;
  }

  cityGroups(): Array<{ city: string; hotels: TripPlanningHotel[] }> {
    return this.selectedCities()
      .map((city) => ({
        city,
        hotels: this.hotels().filter((hotel) => hotel.tripCity === city),
      }))
      .filter((group) => group.hotels.length);
  }

  totalPrice(hotel: Hotel): number {
    return Math.round((hotel.pricePerNight || 0) * this.nights);
  }

  ratingScore(hotel: Hotel): string {
    return `${hotel.ratingScore ?? Number((hotel.rating * 2).toFixed(1))}`;
  }

  ratingLabel(hotel: Hotel): string {
    if (hotel.ratingLabel) {
      return hotel.ratingLabel;
    }

    const score = Number(this.ratingScore(hotel));
    return score >= 9 ? 'Superb' : score >= 8 ? 'Fabulous' : 'Very good';
  }

  keyAmenities(hotel: Hotel): string[] {
    return hotel.amenities?.slice(0, 3) ?? [];
  }

  starSlots(hotel: Hotel): number[] {
    return Array.from({ length: Math.max(1, hotel.stars || 4) }, (_value, index) => index);
  }

  trackByHotelId(_index: number, hotel: Hotel): number {
    return hotel.id;
  }

  trackByImage(_index: number, image: string): string {
    return image;
  }

  private searchHotelsForCity(city: string) {
    return this.hotelService
      .searchHotels(city, this.checkIn, this.checkOut, this.guests, 0)
      .pipe(
        timeout(30000),
        map((hotels) => ({
          city,
          success: true,
          hotels: (Array.isArray(hotels) ? hotels : []).map((hotel) => ({
            ...hotel,
            tripCity: city,
          })),
        })),
        catchError(() =>
          of({
            city,
            success: false,
            hotels: [] as TripPlanningHotel[],
          }),
        ),
      );
  }

  private setHotelImageIndex(hotel: TripPlanningHotel, index: number): void {
    const imageCount = this.cardImages(hotel).length;

    if (!imageCount) {
      return;
    }

    // Keeps image navigation independent per hotel card.
    this.imageIndexes.update((indexes) => ({
      ...indexes,
      [this.hotelImageKey(hotel)]: Math.min(Math.max(index, 0), imageCount - 1),
    }));
  }

  private hotelImageKey(hotel: TripPlanningHotel): string {
    return `${hotel.tripCity}-${hotel.id}`;
  }

  private readSelectedCities(): string[] {
    const cityParams = this.route.snapshot.queryParamMap.getAll('city');
    const citiesParam = this.route.snapshot.queryParamMap.get('cities');
    const rawCities = cityParams.length ? cityParams : citiesParam?.split(',') ?? [];
    const selectedCities = rawCities.map((city) => city.trim()).filter(Boolean);

    // Keeps Barcelona fallback until Destination/Flights state is connected.
    return selectedCities.length ? Array.from(new Set(selectedCities)) : ['Barcelona'];
  }

  private addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private routeExists(route: string): boolean {
    const normalizedRoute = route.replace(/^\//, '');
    return this.router.config.some((routeConfig) => routeConfig.path === normalizedRoute);
  }
}
