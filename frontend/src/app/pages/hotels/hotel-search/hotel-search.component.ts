import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CalendarEvent, Hotel, HotelSort } from '../models/hotel.model';
import { HotelService } from '../services/hotel.service';
import { CalendarService } from '../services/calendar.service';
import { finalize, timeout } from 'rxjs';
import { SharedDatePickerComponent } from '../../../shared/date-picker/shared-date-picker.component';
import { StatusToastComponent, StatusToastType } from '../../../shared/status-toast/status-toast.component';
import { HOTEL_DESTINATION_NAMES, getHotelDestinationSuggestions } from './hotel-destinations';

interface CalendarDay {
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  isToday: boolean;
}

@Component({
  selector: 'app-hotel-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SharedDatePickerComponent, StatusToastComponent],
  templateUrl: './hotel-search.component.html',
  styleUrls: ['./hotel-search.component.css'],
})
export class HotelSearchComponent implements OnDestroy, OnInit {
  location = '';
  checkIn = '';
  checkOut = '';
  adults = 2;
  children = 0;
  guestsOpen = false;
  isLoading = false;
  isSearching = false;
  hasSearched = false;
  dateError = '';
  guestError = '';
  searchError = '';
  hotels: Hotel[] = [];
  readonly maxGuests = 10;
  toastMessage = '';
  toastType: StatusToastType = 'info';
  activeDatePicker: 'checkIn' | 'checkOut' | null = null;
  activeCitySuggestions = false;
  datePickerMonth = new Date();
  manualDateText = '';
  manualDateError = '';
  displayedHotels: Hotel[] = [];
  selectedHotel: Hotel | null = null;
  selectedSort: HotelSort = 'recommended';
  selectedPriceFilter = 'All prices';
  selectedStarFilter = 'All stars';
  selectedScoreFilter = 'Any score';
  selectedAmenities: string[] = [];
  filtersDrawerOpen = false;
  calendarMessage = '';
  currentImageIndex = 0;
  activeCitySuggestionIndex = 0;
  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly priceFilters = ['All prices', 'Budget', 'Mid-range', 'Premium'];
  readonly starFilters = ['All stars', '5-star', '4-star', '3-star & below'];
  readonly scoreFilters = ['Any score', 'Wonderful 9+', 'Very good 8+', 'Good 7+'];
  readonly sortOptions: Array<{ value: HotelSort; label: string; meta: string }> = [
    { value: 'recommended', label: 'Recommended', meta: 'Balanced value' },
    { value: 'rating', label: 'Top rated', meta: 'Best guest score' },
    { value: 'price', label: 'Lowest price', meta: 'Budget first' },
    { value: 'stars', label: 'Most stars', meta: 'Luxury first' },
  ];

  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private previousBodyOverflow: string | null = null;
  private destinationFocusTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private deepLinkedHotelId: number | null = null;

  readonly cityOptions = HOTEL_DESTINATION_NAMES;

  @ViewChild('resultsSection') resultsSection!: ElementRef<HTMLElement>;
  @ViewChild('destinationModalInput') destinationModalInput?: ElementRef<HTMLInputElement>;

  constructor(
    private hotelService: HotelService,
    private calendarService: CalendarService,
    private route: ActivatedRoute,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.applyDealQueryParams();
  }

  ngOnDestroy(): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }

    if (this.destinationFocusTimeoutId) {
      clearTimeout(this.destinationFocusTimeoutId);
    }

    this.unlockPageScroll();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.activeDatePicker) {
      this.closeDatePicker();
      return;
    }

    if (this.activeCitySuggestions) {
      this.closeDestinationOverlay();
      return;
    }

    if (this.guestsOpen) {
      this.closeGuestsModal();
    }
  }

  search(): void {
    this.dateError = this.getDateError();
    this.guestError = this.getGuestError();
    this.searchError = '';

    if (this.dateError || this.guestError) {
      this.showToast(this.dateError || this.guestError, 'error');
      return;
    }

    this.guestsOpen = false;
    this.setActiveDatePicker(null);
    this.setDestinationOverlayOpen(false);
    this.closeFiltersDrawer();
    this.isLoading = true;
    this.isSearching = true;
    this.hasSearched = true;
    this.hotels = [];
    this.displayedHotels = [];
    this.selectedHotel = null;

    const selectedLocation = this.location.trim();
    const apiCheckIn = this.toApiDate(this.checkIn);
    const apiCheckOut = this.toApiDate(this.checkOut);

    this.hotelService
      .searchHotels(selectedLocation, apiCheckIn, apiCheckOut, this.adults, this.children)
      .pipe(
        timeout(30000),
        finalize(() => {
          this.isLoading = false;
          this.isSearching = false;
          this.changeDetectorRef.detectChanges();
        })
      )
      .subscribe({
        next: (hotels) => {
          this.hotels = this.withSearchDetails(Array.isArray(hotels) ? hotels : []);
          this.applySort();
          this.openDeepLinkedHotel();
          this.showToast(
            this.hotels.length
              ? `${this.hotels.length} stay${this.hotels.length === 1 ? '' : 's'} found in ${selectedLocation}.`
              : `No stays matched ${selectedLocation}.`,
            this.hotels.length ? 'success' : 'info'
          );
          this.changeDetectorRef.detectChanges();
        },
        error: (error) => {
          console.error('[HotelSearch] search failed', error);
          this.searchError = this.getSearchErrorMessage(error);
          this.hotels = [];
          this.displayedHotels = [];
          this.showToast(this.searchError, 'error');
          this.changeDetectorRef.detectChanges();
        },
      });

    window.requestAnimationFrame(() => {
      this.resultsSection?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  updateLocationText(value: string): void {
    this.location = value;
    this.setDestinationOverlayOpen(true);
    this.updateActiveCitySuggestionIndex();
  }

  showCitySuggestions(): void {
    this.guestsOpen = false;
    this.setActiveDatePicker(null);
    this.setDestinationOverlayOpen(true);
    this.updateActiveCitySuggestionIndex();
    this.focusDestinationModalInput();
  }

  get citySuggestions(): string[] {
    return getHotelDestinationSuggestions(this.location);
  }

  selectDestination(destination: string): void {
    this.location = destination;
    this.setDestinationOverlayOpen(false);
  }

  closeDestinationOverlay(): void {
    this.setDestinationOverlayOpen(false);
  }

  handleDestinationKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDestinationOverlay();
      return;
    }

    const suggestions = this.citySuggestions;
    if (!suggestions.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeCitySuggestionIndex = (this.activeCitySuggestionIndex + 1) % suggestions.length;
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeCitySuggestionIndex =
        (this.activeCitySuggestionIndex - 1 + suggestions.length) % suggestions.length;
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.selectDestination(suggestions[this.activeCitySuggestionIndex] ?? suggestions[0]);
    }
  }

  private updateActiveCitySuggestionIndex(): void {
    const suggestions = this.citySuggestions;
    this.activeCitySuggestionIndex = suggestions.length ? Math.min(this.activeCitySuggestionIndex, suggestions.length - 1) : 0;
  }

  private setDestinationOverlayOpen(isOpen: boolean): void {
    this.activeCitySuggestions = isOpen;

    if (!isOpen) {
      this.activeCitySuggestionIndex = 0;
    }

    this.updatePageScrollLock();
  }

  private setActiveDatePicker(kind: 'checkIn' | 'checkOut' | null): void {
    this.activeDatePicker = kind;
    this.updatePageScrollLock();
  }

  private applyDealQueryParams(): void {
    const query = this.route.snapshot.queryParamMap;
    const location = query.get('location')?.trim();
    const checkIn = query.get('checkIn')?.trim();
    const checkOut = query.get('checkOut')?.trim();
    const adults = Number(query.get('adults'));
    const children = Number(query.get('children'));
    const hotelId = Number(query.get('hotelId'));

    if (location) {
      this.location = location;
    }

    if (checkIn) {
      this.checkIn = checkIn;
    }

    if (checkOut) {
      this.checkOut = checkOut;
    }

    if (Number.isFinite(adults) && adults > 0) {
      this.adults = Math.min(this.maxGuests, Math.floor(adults));
    }

    if (Number.isFinite(children) && children >= 0) {
      this.children = Math.min(this.maxGuests - this.adults, Math.floor(children));
    }

    if (Number.isFinite(hotelId) && hotelId > 0) {
      this.deepLinkedHotelId = Math.floor(hotelId);
    }

    if (query.get('autoSearch') === 'true' && this.location && this.checkIn && this.checkOut) {
      setTimeout(() => this.search());
    }
  }

  private openDeepLinkedHotel(): void {
    if (this.deepLinkedHotelId === null) {
      return;
    }

    const matchingHotel = this.hotels.find((hotel) => hotel.id === this.deepLinkedHotelId);
    if (!matchingHotel) {
      return;
    }

    this.selectHotel(matchingHotel);
    this.deepLinkedHotelId = null;
  }

  private updatePageScrollLock(): void {
    if (this.activeDatePicker || this.activeCitySuggestions || this.guestsOpen) {
      this.lockPageScroll();
      return;
    }

    this.unlockPageScroll();
  }

  private lockPageScroll(): void {
    if (typeof document === 'undefined' || this.previousBodyOverflow !== null) {
      return;
    }

    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private unlockPageScroll(): void {
    if (typeof document === 'undefined' || this.previousBodyOverflow === null) {
      return;
    }

    document.body.style.overflow = this.previousBodyOverflow;
    this.previousBodyOverflow = null;
  }

  private focusDestinationModalInput(): void {
    if (this.destinationFocusTimeoutId) {
      clearTimeout(this.destinationFocusTimeoutId);
    }

    this.destinationFocusTimeoutId = setTimeout(() => {
      this.destinationModalInput?.nativeElement.focus();
      this.destinationFocusTimeoutId = null;
    });
  }

  validateDates(): void {
    this.dateError = this.getDateError();
  }

  get guestSummary(): string {
    return `${this.adults} ${this.adults === 1 ? 'Adult' : 'Adults'}, ${this.children} ${this.children === 1 ? 'Child' : 'Children'}`;
  }

  toggleGuests(): void {
    this.guestsOpen = !this.guestsOpen;
    this.setActiveDatePicker(null);
    this.setDestinationOverlayOpen(false);
    this.updatePageScrollLock();
  }

  openGuestsModal(): void {
    if (this.guestsOpen) {
      return;
    }

    this.toggleGuests();
  }

  closeGuestsModal(): void {
    this.guestsOpen = false;
    this.updatePageScrollLock();
  }

  changeGuests(type: 'adults' | 'children', change: number): void {
    const nextAdults = type === 'adults' ? this.adults + change : this.adults;
    const nextChildren = type === 'children' ? this.children + change : this.children;

    if (nextAdults < 1 || nextChildren < 0 || nextAdults + nextChildren > this.maxGuests) {
      return;
    }

    this.adults = nextAdults;
    this.children = nextChildren;
    this.guestError = this.getGuestError();
  }

  toggleDatePicker(kind: 'checkIn' | 'checkOut'): void {
    this.guestsOpen = false;
    this.updatePageScrollLock();
    this.setDestinationOverlayOpen(false);

    if (this.activeDatePicker === kind) {
      this.setActiveDatePicker(null);
      return;
    }

    this.setActiveDatePicker(kind);
    const selectedValue = kind === 'checkOut' ? this.checkOut : this.checkIn;
    const selectedDate = this.parseDateInput(selectedValue) ?? new Date();
    this.datePickerMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    this.manualDateText = this.formatDateInput(selectedDate);
    this.manualDateError = '';
  }

  closeDatePicker(): void {
    this.setActiveDatePicker(null);
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
    const selected = this.startOfDay(day.date);

    if (this.activeDatePicker === 'checkOut') {
      const checkInDate = this.parseDateInput(this.checkIn);
      if (checkInDate && selected < checkInDate) {
        this.manualDateError = 'Check-out cannot be before check-in.';
        return;
      }

      this.checkOut = this.formatDateInput(selected);
      this.manualDateText = this.checkOut;
      this.manualDateError = '';
      this.validateDates();
      this.closeDatePicker();
      return;
    }

    this.checkIn = this.formatDateInput(selected);
    this.manualDateText = this.checkIn;
    this.manualDateError = '';

    const currentCheckOut = this.parseDateInput(this.checkOut);
    if (currentCheckOut && currentCheckOut < selected) {
      this.checkOut = '';
      this.setActiveDatePicker('checkOut');
      this.manualDateText = '';
    } else {
      this.closeDatePicker();
    }

    this.validateDates();
  }

  updateActiveDatePickerInput(value: string): void {
    this.manualDateText = value;

    if (!value.trim()) {
      this.manualDateError = this.activeDatePicker === 'checkIn' ? 'Enter a check-in date.' : 'Enter a check-out date.';
      return;
    }

    const parsed = this.parseDateInput(value);
    if (!parsed) {
      this.manualDateError = 'Use a valid date in YYYY-MM-DD format.';
      return;
    }

    if (this.activeDatePicker === 'checkOut') {
      const checkInDate = this.parseDateInput(this.checkIn);
      if (checkInDate && parsed < checkInDate) {
        this.manualDateError = 'Check-out cannot be before check-in.';
        return;
      }

      this.checkOut = this.formatDateInput(parsed);
    } else {
      this.checkIn = this.formatDateInput(parsed);
      const currentCheckOut = this.parseDateInput(this.checkOut);
      if (currentCheckOut && currentCheckOut < parsed) {
        this.checkOut = '';
      }
    }

    this.datePickerMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    this.manualDateError = '';
    this.validateDates();
  }

  activeDatePickerTitle(): string {
    return this.activeDatePicker === 'checkOut' ? 'Choose check-out date' : 'Choose check-in date';
  }

  activeDatePickerHint(): string {
    if (this.manualDateError) {
      return this.manualDateError;
    }

    return this.activeDatePicker === 'checkOut'
      ? 'Pick the departure day from your hotel.'
      : 'Pick the arrival day for your stay.';
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
    const checkInDate = this.parseDateInput(this.checkIn);
    const checkOutDate = this.parseDateInput(this.checkOut);
    const activeDate = this.activeDatePicker === 'checkOut' ? checkOutDate : checkInDate;

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const current = this.startOfDay(date);

      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === month.getMonth(),
        isSelected: this.isSameDate(date, activeDate),
        isRangeStart: !!checkInDate && this.isSameDate(date, checkInDate),
        isRangeEnd: !!checkOutDate && this.isSameDate(date, checkOutDate),
        isInRange:
          !!checkInDate &&
          !!checkOutDate &&
          current > checkInDate &&
          current < checkOutDate,
        isToday: this.isSameDate(date, new Date()),
      };
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

  sortHotels(type: HotelSort): void {
    this.selectedSort = type;
    this.applySort();
  }

  toggleFiltersDrawer(): void {
    this.filtersDrawerOpen = !this.filtersDrawerOpen;
  }

  closeFiltersDrawer(): void {
    this.filtersDrawerOpen = false;
  }

  setPriceFilter(value: string): void {
    this.selectedPriceFilter = value;
    this.applySort();
  }

  setStarFilter(value: string): void {
    this.selectedStarFilter = value;
    this.applySort();
  }

  setScoreFilter(value: string): void {
    this.selectedScoreFilter = value;
    this.applySort();
  }

  toggleAmenityFilter(amenity: string): void {
    this.selectedAmenities = this.selectedAmenities.includes(amenity)
      ? this.selectedAmenities.filter((item) => item !== amenity)
      : [...this.selectedAmenities, amenity];

    this.applySort();
  }

  resetFilters(): void {
    this.selectedPriceFilter = 'All prices';
    this.selectedStarFilter = 'All stars';
    this.selectedScoreFilter = 'Any score';
    this.selectedAmenities = [];
    this.selectedSort = 'recommended';
    this.applySort();
    this.closeFiltersDrawer();
    this.showToast('Hotel filters reset.', 'info');
  }

  selectHotel(hotel: Hotel): void {
    this.selectedHotel = hotel;
    this.calendarMessage = '';
    this.currentImageIndex = 0;
  }

  closeHotelModal(): void {
    this.selectedHotel = null;
  }

  get modalImages(): string[] {
    if (!this.selectedHotel) {
      return [];
    }

    const images = this.selectedHotel.images?.filter(Boolean) ?? [];
    return images.length ? images : this.selectedHotel.image ? [this.selectedHotel.image] : [];
  }

  get modalImageCounter(): string {
    return `${this.currentImageIndex + 1} / ${this.modalImages.length || 1}`;
  }

  previousModalImage(event: Event): void {
    event.stopPropagation();
    const imageCount = this.modalImages.length;

    if (imageCount <= 1) {
      return;
    }

    this.currentImageIndex = (this.currentImageIndex - 1 + imageCount) % imageCount;
  }

  nextModalImage(event: Event): void {
    event.stopPropagation();
    const imageCount = this.modalImages.length;

    if (imageCount <= 1) {
      return;
    }

    this.currentImageIndex = (this.currentImageIndex + 1) % imageCount;
  }

  async addHotelToCalendar(): Promise<void> {
    if (!this.selectedHotel) {
      return;
    }

    const stayDetails = this.getStayDetails(this.selectedHotel);

    if (!stayDetails) {
      this.calendarMessage = 'Please select valid check-in and check-out dates first.';
      this.showToast(this.calendarMessage, 'error');
      return;
    }

    const event: CalendarEvent = {
      title: this.selectedHotel.name,
      startDate: this.selectedHotel.checkIn,
      endDate: this.selectedHotel.checkOut,
      price: stayDetails.totalPrice,
      location: this.selectedHotel.city,
      category: 'Hotel',
      description: this.buildCalendarDescription(this.selectedHotel, stayDetails),
    };

    try {
      const result = await this.calendarService.addEventOrRedirectToLogin(event);
      this.calendarMessage = result === 'added'
        ? 'Added to calendar'
        : 'Continue with login to save this stay to your calendar.';
      this.showToast(
        result === 'added'
          ? `${this.selectedHotel.name} added to calendar.`
          : 'Continue with login to save this stay to your calendar.',
        result === 'added' ? 'success' : 'info'
      );
    } catch (error) {
      console.error('Error adding hotel stay to calendar:', error);
      this.calendarMessage = 'Unable to add this stay right now.';
      this.showToast(this.calendarMessage, 'error');
    }
  }

  trackByHotelId(_index: number, hotel: Hotel): number {
    return hotel.id;
  }

  get totalNightsLabel(): string {
    if (!this.selectedHotel) {
      return 'Selected stay';
    }

    const stayDetails = this.getStayDetails(this.selectedHotel);
    return stayDetails ? this.formatGuestStay(stayDetails) : 'Select dates';
  }

  getStayDetails(hotel: Hotel): { nights: number; adults: number; children: number; totalPrice: number } | null {
    const checkIn = this.parseDateInput(hotel.checkIn);
    const checkOut = this.parseDateInput(hotel.checkOut);

    if (!checkIn || !checkOut) {
      return null;
    }

    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
    if (nights <= 0) {
      return null;
    }

    return {
      nights,
      adults: hotel.adults ?? 2,
      children: hotel.children ?? 0,
      totalPrice: Math.round(hotel.pricePerNight * nights),
    };
  }

  formatTotalPrice(hotel: Hotel): string {
    const stayDetails = this.getStayDetails(hotel);
    return stayDetails ? `€${stayDetails.totalPrice.toLocaleString('en-US')}` : 'Select dates to see total price';
  }

  formatStayDetails(hotel: Hotel): string {
    const stayDetails = this.getStayDetails(hotel);
    return stayDetails ? this.formatGuestStay(stayDetails) : this.formatGuests(hotel.adults ?? 2, hotel.children ?? 0);
  }

  getDistanceLabel(hotel: Hotel): string {
    return `${hotel.city}: ${hotel.distanceFromCenter ?? hotel.distance}`;
  }

  getRatingScore(hotel: Hotel): string {
    return `${hotel.ratingScore ?? Number((hotel.rating * 2).toFixed(1))}`;
  }

  getRatingLabel(hotel: Hotel): string {
    if (hotel.ratingLabel) {
      return hotel.ratingLabel;
    }

    const score = Number(this.getRatingScore(hotel));
    if (score >= 9) {
      return 'Superb';
    }

    if (score >= 8) {
      return 'Fabulous';
    }

    return 'Very good';
  }

  getReviewCount(hotel: Hotel): number {
    return hotel.reviewCount ?? 24 + hotel.id * 4;
  }

  getKeyAmenities(hotel: Hotel): string[] {
    return hotel.amenities?.slice(0, 4) ?? [];
  }

  get availableAmenities(): string[] {
    const counts = new Map<string, number>();

    for (const hotel of this.hotels) {
      for (const amenity of hotel.amenities ?? []) {
        counts.set(amenity, (counts.get(amenity) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([amenity]) => amenity);
  }

  priceFilterCount(filter: string): number {
    return this.hotels.filter((hotel) => this.matchesPriceFilter(hotel, filter)).length;
  }

  starFilterCount(filter: string): number {
    return this.hotels.filter((hotel) => this.matchesStarFilter(hotel, filter)).length;
  }

  scoreFilterCount(filter: string): number {
    return this.hotels.filter((hotel) => this.matchesScoreFilter(hotel, filter)).length;
  }

  amenityFilterCount(amenity: string): number {
    return this.hotels.filter((hotel) => (hotel.amenities ?? []).includes(amenity)).length;
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
      this.changeDetectorRef.detectChanges();
    }, 2600);
  }

  private getDateError(): string {
    const today = this.getTodayDateString();
    const checkIn = this.toApiDate(this.checkIn);
    const checkOut = this.toApiDate(this.checkOut);

    if (!this.location.trim() || !this.checkIn || !this.checkOut) {
      return 'Please fill all required fields';
    }

    if (!checkIn || !checkOut) {
      return 'Dates must use a valid format';
    }

    if (checkIn < today || checkOut < today) {
      return 'Dates cannot be in the past';
    }

    if (checkIn > checkOut) {
      return 'Invalid date selection';
    }

    return '';
  }

  private getGuestError(): string {
    if (this.adults < 1) {
      return 'At least one adult is required';
    }

    if (this.adults + this.children > this.maxGuests) {
      return `Maximum ${this.maxGuests} guests allowed`;
    }

    return '';
  }

  private getSearchErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'TimeoutError') {
      return 'Hotel search timed out. Check the connection and try again.';
    }

    return 'Hotel availability could not be refreshed. Please try again.';
  }

  private getTodayDateString(): string {
    return this.formatDateInput(new Date());
  }

  private toApiDate(value: string): string {
    const trimmedValue = value.trim();
    const isoDateMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateMatch) {
      return trimmedValue;
    }

    const europeanDateMatch = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (europeanDateMatch) {
      const [, day, month, year] = europeanDateMatch;
      return `${year}-${month}-${day}`;
    }

    return '';
  }

  private withSearchDetails(hotels: Hotel[]): Hotel[] {
    return hotels.map((hotel) => ({
      ...hotel,
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      adults: this.adults,
      children: this.children,
      images: hotel.images?.length ? hotel.images : this.getHotelImages(hotel.id, hotel.image),
    }));
  }

  private getHotelImages(id: number, fallbackImage: string): string[] {
    const galleries = [
      [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
      ],
      [
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
      ],
      [
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1561501900-3701fa6a0864?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1598928636135-d146006ff4be?auto=format&fit=crop&w=1200&q=80',
      ],
      [
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1562790351-d273a961e0e9?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
      ],
    ];

    const selectedGallery = galleries[id % galleries.length];

    return Array.from(new Set([fallbackImage, ...selectedGallery])).slice(0, 6);
  }

  private applySort(): void {
    let sortedHotels = this.hotels.filter((hotel) =>
      this.matchesPriceFilter(hotel, this.selectedPriceFilter)
      && this.matchesStarFilter(hotel, this.selectedStarFilter)
      && this.matchesScoreFilter(hotel, this.selectedScoreFilter)
      && this.matchesAmenityFilters(hotel)
    );

    switch (this.selectedSort) {
      case 'price':
        sortedHotels = sortedHotels.sort((a, b) => a.pricePerNight - b.pricePerNight);
        break;
      case 'rating':
        sortedHotels = sortedHotels.sort((a, b) => b.rating - a.rating);
        break;
      case 'stars':
        sortedHotels = sortedHotels.sort((a, b) => b.stars - a.stars);
        break;
      default:
        break;
    }

    this.displayedHotels = sortedHotels;
  }

  private matchesPriceFilter(hotel: Hotel, filter: string): boolean {
    if (filter === 'All prices') {
      return true;
    }

    if (filter === 'Budget') {
      return hotel.pricePerNight <= 120;
    }

    if (filter === 'Mid-range') {
      return hotel.pricePerNight > 120 && hotel.pricePerNight <= 250;
    }

    return hotel.pricePerNight > 250;
  }

  private matchesStarFilter(hotel: Hotel, filter: string): boolean {
    if (filter === 'All stars') {
      return true;
    }

    if (filter === '5-star') {
      return hotel.stars >= 5;
    }

    if (filter === '4-star') {
      return hotel.stars >= 4;
    }

    return hotel.stars <= 3;
  }

  private matchesScoreFilter(hotel: Hotel, filter: string): boolean {
    const score = Number(this.getRatingScore(hotel));

    if (filter === 'Any score') {
      return true;
    }

    if (filter === 'Wonderful 9+') {
      return score >= 9;
    }

    if (filter === 'Very good 8+') {
      return score >= 8;
    }

    return score >= 7;
  }

  private matchesAmenityFilters(hotel: Hotel): boolean {
    if (!this.selectedAmenities.length) {
      return true;
    }

    const hotelAmenities = hotel.amenities ?? [];
    return this.selectedAmenities.every((amenity) => hotelAmenities.includes(amenity));
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

    return this.startOfDay(date);
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private buildCalendarDescription(
    hotel: Hotel,
    stayDetails: { nights: number; adults: number; children: number; totalPrice: number }
  ): string {
    return [
      `Hotel name: ${hotel.name}`,
      `Check-in: ${hotel.checkIn}`,
      `Check-out: ${hotel.checkOut}`,
      `Nights: ${stayDetails.nights}`,
      `Adults: ${stayDetails.adults}`,
      `Children: ${stayDetails.children}`,
      `Price per night: ${hotel.pricePerNight} EUR`,
      `Total price: ${stayDetails.totalPrice} EUR`,
      'Includes taxes and fees',
      `Amenities: ${hotel.amenities?.length ? hotel.amenities.join(', ') : 'Not specified'}`,
    ].join('\n');
  }

  private formatGuestStay(stayDetails: { nights: number; adults: number; children: number }): string {
    return `${stayDetails.nights} ${stayDetails.nights === 1 ? 'night' : 'nights'}, ${this.formatGuests(stayDetails.adults, stayDetails.children)}`;
  }

  private formatGuests(adults: number, children: number): string {
    const adultLabel = `${adults} ${adults === 1 ? 'adult' : 'adults'}`;
    const childLabel = `${children} ${children === 1 ? 'child' : 'children'}`;
    return `${adultLabel}, ${childLabel}`;
  }
}
