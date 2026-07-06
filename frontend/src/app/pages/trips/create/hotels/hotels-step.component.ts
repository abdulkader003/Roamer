import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, timeout } from 'rxjs';
import { Hotel } from '../../../hotels/models/hotel.model';
import { HotelService } from '../../../hotels/services/hotel.service';
import { TripPlanningService } from '../../../../services/trip-planning.service';
import { TripTempHotelStay, TripTempService } from '../trip-temp.service';

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
  readonly hotels = signal<TripPlanningHotel[]>([]);
  readonly selectedHotel = signal<TripPlanningHotel | null>(null);
  readonly selectedHotelsByCity = signal<Record<string, TripPlanningHotel>>({});
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly loadError = signal('');
  readonly loadWarning = signal('');
  readonly saveError = signal('');
  readonly tripPlanningId = signal<number | null>(null);
  readonly selectedCities = signal<string[]>(['Barcelona']);
  readonly imageIndexes = signal<Record<string, number>>({});
  readonly failedImageUrls = signal<Record<string, string[]>>({});
  readonly savedHotelId = signal<number | null>(null);

  readonly nights = this.resolveNights();
  readonly guests = Math.max(this.tripTemp.travelers || 1, 1);
  readonly checkIn = this.tripTemp.departureDate || this.formatDate(this.addDays(new Date(), 30));
  readonly checkOut = this.tripTemp.returnDate || this.formatDate(this.addDays(this.parseDateOnly(this.checkIn) ?? new Date(), Math.max(this.nights, 1)));
  readonly fallbackHotelImage =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 520%22%3E%3Crect width=%22800%22 height=%22520%22 fill=%22%23eef4fb%22/%3E%3Cpath d=%22M130 390h540L535 245l-95 105-70-75z%22 fill=%22%23c9d8eb%22/%3E%3Ccircle cx=%22595%22 cy=%22150%22 r=%2245%22 fill=%22%23dbe6f4%22/%3E%3Ctext x=%22400%22 y=%22455%22 text-anchor=%22middle%22 fill=%22%2370879f%22 font-family=%22Arial,sans-serif%22 font-size=%2232%22 font-weight=%22700%22%3EHotel image unavailable%3C/text%3E%3C/svg%3E';

  ngOnInit(): void {
    this.tripPlanningId.set(this.readTripPlanningId());
    this.selectedCities.set(this.readSelectedCities());
    this.loadSavedHotelSelection();
    this.loadHotels();
  }

  loadHotels(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    this.loadWarning.set('');
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
          this.preselectSavedHotel(hotels);

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
    if (this.isMultiCityTrip()) {
      // Keeps one hotel per destination city without overwriting earlier cities.
      this.selectedHotelsByCity.update((selectedHotels) => {
        const nextSelectedHotels = { ...selectedHotels };

        if (this.isSelectedHotel(hotel)) {
          delete nextSelectedHotels[hotel.tripCity];
        } else {
          nextSelectedHotels[hotel.tripCity] = hotel;
        }

        return nextSelectedHotels;
      });
      this.selectedHotel.set(hotel);
    } else {
      // Allows users to change their mind and remove a hotel selection.
      this.selectedHotel.set(this.isSelectedHotel(hotel) ? null : hotel);
    }

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
    if (this.isMultiCityTrip()) {
      const selectedHotel = this.selectedHotelsByCity()[hotel.tripCity];
      return selectedHotel?.id === hotel.id;
    }

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
    const selectedHotels = this.selectedHotelStays();
    const hotel = this.primarySelectedHotel();

    if (!hotel || !selectedHotels.length || this.isSaving()) {
      return;
    }

    const tripPlanningId = this.tripPlanningId();

    if (!tripPlanningId) {
      this.saveError.set('Trip planning session is missing. Continue from the Budget step first.');
      return;
    }

    this.isSaving.set(true);
    this.saveError.set('');
    this.tripTempService.updateTripTemp({
      selectedHotelName: hotel.name,
      selectedHotelCity: hotel.tripCity || hotel.city,
      selectedHotelStars: hotel.stars ?? null,
      selectedHotelTotal: selectedHotels.reduce((total, stay) => total + stay.price, 0),
      selectedHotels,
    });

    this.tripPlanningService
      .saveHotelStep(tripPlanningId, {
        hotelId: hotel.id,
        selectedHotelStaysJson: JSON.stringify(selectedHotels),
      })
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

  private loadSavedHotelSelection(): void {
    const tripPlanningId = this.tripPlanningId();

    if (!tripPlanningId) {
      return;
    }

    this.tripPlanningService.getOverview(tripPlanningId).subscribe({
      next: (overview) => {
        const savedHotel = overview.selectedHotel;
        this.hydrateSavedHotelStays(overview.selectedHotelStaysJson);

        if (!savedHotel) {
          this.preselectSavedHotel(this.hotels());
          return;
        }

        this.savedHotelId.set(savedHotel.hotelId);
        this.tripTempService.updateTripTemp({
          selectedHotelName: savedHotel.hotelName,
          selectedHotelCity: savedHotel.hotelCity,
          selectedHotelStars: savedHotel.stars ?? null,
        });
        this.preselectSavedHotel(this.hotels());
      },
      error: () => this.preselectSavedHotel(this.hotels()),
    });
  }

  private hydrateSavedHotelStays(selectedHotelStaysJson: string | null | undefined): void {
    const selectedHotels = this.parseHotelStays(selectedHotelStaysJson);

    if (selectedHotels.length) {
      this.tripTempService.updateTripTemp({ selectedHotels });
    }
  }

  private parseHotelStays(value: string | null | undefined): TripTempHotelStay[] {
    if (!value) {
      return [];
    }

    try {
      const stays = JSON.parse(value) as TripTempHotelStay[];
      return Array.isArray(stays) ? stays : [];
    } catch {
      return [];
    }
  }

  private preselectSavedHotel(hotels: TripPlanningHotel[]): void {
    if ((this.selectedHotel() || Object.keys(this.selectedHotelsByCity()).length) || !hotels.length) {
      return;
    }

    const savedHotelId = this.savedHotelId();
    const tripTemp = this.tripTempService.getTripTemp();
    const savedHotelName = tripTemp.selectedHotelName.trim().toLowerCase();
    const savedHotelCity = tripTemp.selectedHotelCity.trim().toLowerCase();
    const savedHotelStays = this.tripTempService.getTripTemp().selectedHotels ?? [];
    const matchedHotelsByCity = savedHotelStays.reduce<Record<string, TripPlanningHotel>>((selectedHotels, stay) => {
      const matchedHotel = hotels.find((hotel) => (
        hotel.name.trim().toLowerCase() === stay.hotelName.trim().toLowerCase()
        && (hotel.tripCity || hotel.city).trim().toLowerCase() === stay.city.trim().toLowerCase()
      ));

      return matchedHotel
        ? { ...selectedHotels, [matchedHotel.tripCity]: matchedHotel }
        : selectedHotels;
    }, {});

    if (Object.keys(matchedHotelsByCity).length) {
      this.selectedHotelsByCity.set(matchedHotelsByCity);
      this.selectedHotel.set(Object.values(matchedHotelsByCity)[0] ?? null);
      return;
    }

    const matchedHotel = hotels.find((hotel) => (
      (savedHotelId && hotel.id === savedHotelId)
      || (
        savedHotelName
        && hotel.name.trim().toLowerCase() === savedHotelName
        && (!savedHotelCity || (hotel.tripCity || hotel.city).trim().toLowerCase() === savedHotelCity)
      )
    ));

    if (matchedHotel) {
      if (this.isMultiCityTrip()) {
        this.selectedHotelsByCity.set({ [matchedHotel.tripCity]: matchedHotel });
      }
      this.selectedHotel.set(matchedHotel);
    }
  }

  subtitle(): string {
    const cityText = this.cityListText(this.selectedCities());
    const locationText = this.isMultiCityTrip() ? `across ${cityText}` : `in ${cityText}`;
    const dateText = this.dateRangeText();
    const parts = [
      dateText,
      this.pluralize(this.nights, 'night'),
      this.pluralize(this.guests, 'guest'),
    ].filter(Boolean);

    return `Showing hotel options ${locationText}${parts.length ? ` · ${parts.join(' · ')}` : ''}.`;
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

  totalPriceForNights(hotel: Hotel, nights: number): number {
    return Math.round((hotel.pricePerNight || 0) * nights);
  }

  canContinue(): boolean {
    return this.isMultiCityTrip()
      ? Object.keys(this.selectedHotelsByCity()).length > 0
      : Boolean(this.selectedHotel());
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

  private primarySelectedHotel(): TripPlanningHotel | null {
    if (!this.isMultiCityTrip()) {
      return this.selectedHotel();
    }

    return this.selectedCities()
      .map((city) => this.selectedHotelsByCity()[city])
      .find(Boolean) ?? null;
  }

  private selectedHotelStays(): TripTempHotelStay[] {
    if (!this.isMultiCityTrip()) {
      const hotel = this.selectedHotel();
      return hotel ? [this.toHotelStay(hotel)] : [];
    }

    return this.selectedCities()
      .map((city) => this.selectedHotelsByCity()[city])
      .filter((hotel): hotel is TripPlanningHotel => !!hotel)
      .map((hotel) => this.toHotelStay(hotel));
  }

  private toHotelStay(hotel: TripPlanningHotel): TripTempHotelStay {
    const stayDates = this.hotelStayDates(hotel.tripCity || hotel.city);
    const stayNights = this.nightsBetween(stayDates.checkIn, stayDates.checkOut) ?? this.nights;

    return {
      hotelName: hotel.name,
      city: hotel.tripCity || hotel.city,
      checkIn: stayDates.checkIn,
      checkOut: stayDates.checkOut,
      nights: stayNights,
      stars: hotel.stars ?? null,
      rating: hotel.ratingLabel || this.ratingLabel(hotel),
      price: this.totalPriceForNights(hotel, stayNights),
    };
  }

  private hotelStayDates(city: string): { checkIn: string; checkOut: string } {
    const segments = this.tripSegments();
    const cityName = this.cityOnly(city);
    const arrivalIndex = segments.findIndex((segment) => this.cityOnly(segment.to) === cityName);
    const arrivalSegment = arrivalIndex >= 0 ? segments[arrivalIndex] : null;
    const nextSegment = arrivalIndex >= 0 ? segments[arrivalIndex + 1] : null;
    const departureSegment = segments.find((segment) => (
      this.cityOnly(segment.from) === cityName
      && segment.date > (arrivalSegment?.date ?? '')
    ));
    const checkIn = arrivalSegment?.date || this.checkIn;
    const checkOut = departureSegment?.date || nextSegment?.date || this.checkOut;

    return { checkIn, checkOut };
  }

  private tripSegments(): Array<{ from: string; to: string; date: string }> {
    const selectedFlightSegments = this.tripTemp.selectedFlightSegments ?? [];

    if (selectedFlightSegments.length) {
      return selectedFlightSegments.map((segment) => ({
        from: segment.from,
        to: segment.to,
        date: segment.date,
      }));
    }

    return this.multiCitySegmentsFromQuery().map((segment) => ({
      from: segment.fromText,
      to: segment.toText,
      date: segment.date,
    }));
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
    return this.multiCitySegmentsFromQuery(rawSegments).map((segment) => segment.toText);
  }

  private multiCitySegmentsFromQuery(rawSegments = this.route.snapshot.queryParamMap.get('multiCitySegments')): Array<{ fromText: string; toText: string; date: string }> {
    if (!rawSegments) {
      return [];
    }

    try {
      const segments = JSON.parse(rawSegments) as Array<{ fromText?: string; toText?: string; date?: string }>;
      return segments.map((segment) => ({
        fromText: segment.fromText ?? '',
        toText: segment.toText ?? '',
        date: segment.date ?? '',
      }));
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
    const checkIn = this.formatDisplayDate(this.checkIn);
    const checkOut = this.formatDisplayDate(this.checkOut);

    return checkIn && checkOut ? `${checkIn} to ${checkOut}` : '';
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

  private resolveNights(): number {
    // Destination dates override the initial Budget duration estimate.
    return this.nightsBetween(this.tripTemp.departureDate, this.tripTemp.returnDate)
      ?? Math.max(this.tripTemp.durationNights ?? 0, 1);
  }

  private nightsBetween(start: string, end: string): number | null {
    const startDate = this.parseDateOnly(start);
    const endDate = this.parseDateOnly(end);

    if (!startDate || !endDate) {
      return null;
    }

    const nights = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
    return nights > 0 ? nights : null;
  }

  private parseDateOnly(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
      return null;
    }

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
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
