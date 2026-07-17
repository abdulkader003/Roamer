import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CalendarEvent } from '../../../hotels/models/hotel.model';
import { CalendarService } from '../../../hotels/services/calendar.service';
import { FriendNotificationService } from '../../../../services/friend-notification.service';
import { CreateTripRequest, TripOverviewResponse, TripPlanningService, TripStatus } from '../../../../services/trip-planning.service';
import { TripTempActivity, TripTempHotelStay, TripTempService } from '../trip-temp.service';
import type { TripSummaryPdfSource } from './trip-summary-pdf.exporter';

interface TripStep {
  number: number;
  label: string;
  state: 'complete' | 'active';
  route?: string;
}

interface OverviewFlightSegment {
  label: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: string;
  price: number;
}

interface OverviewHotelStay {
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  stars: number | null;
  price: number;
}

@Component({
  selector: 'app-overview-step',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './overview-step.component.html',
  styleUrl: './overview-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewStepComponent implements OnInit, TripSummaryPdfSource {
  readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripPlanningService = inject(TripPlanningService);
  private readonly tripTempService = inject(TripTempService);
  private readonly calendarService = inject(CalendarService);
  private readonly friendNotificationService = inject(FriendNotificationService);

  readonly steps: TripStep[] = [
    { number: 1, label: 'Budget', state: 'complete', route: '/trips/create/budget' },
    { number: 2, label: 'Destination', state: 'complete', route: '/trips/create/destination' },
    { number: 3, label: 'Flights', state: 'complete', route: '/trips/create/flights' },
    { number: 4, label: 'Hotels', state: 'complete', route: '/trips/create/hotels' },
    { number: 5, label: 'Activities', state: 'complete', route: '/trips/create/activities' },
    { number: 6, label: 'Overview', state: 'active' },
  ];

  readonly overview = signal<TripOverviewResponse | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isExportingPdf = signal(false);
  readonly isExportMenuOpen = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly exportError = signal('');
  readonly tripTemp = this.tripTempService.getTripTemp();

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    const tripPlanningId = this.readTripPlanningId();

    if (!tripPlanningId) {
      this.loadError.set(this.hasFallbackSummary()
        ? ''
        : 'Trip planning session is missing. Please start again from the Budget step.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set('');
    this.tripPlanningService.getOverview(tripPlanningId).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.overviewErrorMessage(error));
        this.isLoading.set(false);
      },
    });
  }

  hasFallbackSummary(): boolean {
    return Boolean(
      this.tripTemp.tripName ||
      this.tripTemp.destination ||
      this.tripTemp.budget ||
      this.tripTemp.selectedFlightId ||
      this.tripTemp.selectedHotelName ||
      this.tripTemp.selectedActivities.length,
    );
  }

  tripName(): string {
    return this.overview()?.tripName || this.tripTemp.tripName || 'Your trip';
  }

  destinationName(): string {
    return this.cityOnly(this.tripTemp.destination) || this.overview()?.selectedHotel?.hotelCity || 'Destination';
  }

  tripRouteSummary(): string {
    const segments = this.flightSegments();

    if (segments.length > 1) {
      const routeCities = [
        this.cityOnly(segments[0].from),
        ...segments.map((segment) => this.cityOnly(segment.to)),
      ].filter(Boolean);

      return routeCities.filter((city, index) => city !== routeCities[index - 1]).join(' → ');
    }

    return this.destinationName();
  }

  dateRange(): string {
    if (!this.tripTemp.departureDate && !this.tripTemp.returnDate) {
      return 'Dates not selected';
    }

    return [this.tripTemp.departureDate, this.tripTemp.returnDate].filter(Boolean).join(' → ');
  }

  travelerLabel(): string {
    const travelers = this.travelerCount();
    return `${travelers} traveler${travelers === 1 ? '' : 's'}`;
  }

  nights(): number {
    return this.effectiveNights();
  }

  flightTotal(): number {
    return this.tripTemp.selectedFlightTotal ?? 0;
  }

  flightTitle(): string {
    return this.tripTemp.selectedFlightAirline ||
      this.tripTemp.selectedFlightNumber ||
      this.tripTemp.selectedFlightId ||
      'Flight not selected';
  }

  flightDetails(): string {
    if (this.tripTemp.selectedFlightDepartureTime || this.tripTemp.selectedFlightArrivalTime) {
      return [
        [this.tripTemp.selectedFlightDepartureTime || 'Departure', this.tripTemp.selectedFlightArrivalTime || 'Arrival'].join(' → '),
        this.tripTemp.selectedFlightDuration,
        this.tripTemp.selectedFlightStops,
      ].filter(Boolean).join(' · ');
    }

    return `${this.tripTemp.origin || 'Origin'} → ${this.tripTemp.destination || 'Destination'}`;
  }

  flightSegments(): OverviewFlightSegment[] {
    if (this.tripTemp.selectedFlightSegments?.length) {
      return this.tripTemp.selectedFlightSegments;
    }

    if (this.isMultiCityTrip()) {
      return this.multiCityFlightSegments();
    }

    if (this.isRoundTrip()) {
      return this.roundTripFlightSegments();
    }

    return [this.singleFlightSegment('Flight', this.tripTemp.origin, this.tripTemp.destination, this.tripTemp.departureDate, {
      id: this.tripTemp.selectedFlightId,
      airline: this.tripTemp.selectedFlightAirline,
      flightNumber: this.tripTemp.selectedFlightNumber,
      departureTime: this.tripTemp.selectedFlightDepartureTime,
      arrivalTime: this.tripTemp.selectedFlightArrivalTime,
      duration: this.tripTemp.selectedFlightDuration,
      stops: this.tripTemp.selectedFlightStops,
      price: this.flightTotal(),
    })];
  }

  hotelName(): string {
    return this.overview()?.selectedHotel?.hotelName || this.tripTemp.selectedHotelName || 'Hotel not selected';
  }

  hotelCity(): string {
    return this.overview()?.selectedHotel?.hotelCity || this.tripTemp.selectedHotelCity || destinationNameFallback(this.tripTemp.destination);
  }

  hotelStars(): number | null {
    return this.overview()?.selectedHotel?.stars ?? this.tripTemp.selectedHotelStars;
  }

  hotelTotal(): number {
    const selectedHotelStays = this.selectedHotelStays();

    if (selectedHotelStays.length) {
      return this.repricedHotelStays(selectedHotelStays).reduce((total, stay) => total + stay.price, 0);
    }

    if (!this.overview()?.selectedHotel && this.tripTemp.selectedHotelTotal !== null) {
      const originalNights = this.tripTemp.durationNights || this.overview()?.duration || 0;
      const dateBasedNights = this.dateBasedNights();

      if (dateBasedNights && originalNights > 0) {
        return Math.round((this.tripTemp.selectedHotelTotal / originalNights) * dateBasedNights * this.travelerCount());
      }

      return Math.round(this.tripTemp.selectedHotelTotal * this.travelerCount());
    }

    const pricePerNight = Number(this.overview()?.selectedHotel?.pricePerNight ?? 0);
    return Math.round(pricePerNight * this.nights() * this.travelerCount());
  }

  hotelStays(): OverviewHotelStay[] {
    const selectedHotelStays = this.selectedHotelStays();

    if (selectedHotelStays.length) {
      return this.repricedHotelStays(selectedHotelStays);
    }

    if (this.hotelName() === 'Hotel not selected') {
      return [];
    }

    return [{
      hotelName: this.hotelName(),
      city: this.hotelCity(),
      checkIn: this.tripTemp.departureDate,
      checkOut: this.tripTemp.returnDate || this.tripTemp.departureDate,
      nights: this.nights(),
      stars: this.hotelStars(),
      price: this.hotelTotal(),
    }];
  }

  hotelGroups(): Array<{ city: string; stays: OverviewHotelStay[] }> {
    const groups = new Map<string, OverviewHotelStay[]>();

    this.hotelStays().forEach((stay) => {
      groups.set(stay.city, [...(groups.get(stay.city) ?? []), stay]);
    });

    return Array.from(groups.entries()).map(([city, stays]) => ({ city, stays }));
  }

  formatDisplayDate(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  selectedActivities(): TripTempActivity[] {
    const overviewActivities = this.overview()?.selectedActivities;

    if (!overviewActivities?.length) {
      return this.tripTemp.selectedActivities;
    }

    return overviewActivities.map((activity) => {
      const localActivity = this.tripTemp.selectedActivities.find((savedActivity) => (
        savedActivity.name === activity.name && savedActivity.city === activity.city
      ));

      return {
        ...activity,
        date: localActivity?.date,
        time: localActivity?.time,
      };
    });
  }

  activitiesTotal(): number {
    const activities = this.selectedActivities();

    if (activities.length) {
      return activities.reduce((total, activity) => total + this.activityTotal(activity), 0);
    }

    return Math.round(Number(this.overview()?.totalActivitiesCost ?? this.tripTemp.selectedActivitiesTotal ?? 0) * this.travelerCount());
  }

  activityTotal(activity: TripTempActivity): number {
    return Math.round(Number(activity.price || 0) * this.travelerCount());
  }

  activityGroups(): Array<{ city: string; activities: TripTempActivity[] }> {
    const activities = this.selectedActivities();
    const groups = new Map<string, TripTempActivity[]>();

    activities.forEach((activity) => {
      const city = activity.city || 'Destination';
      groups.set(city, [...(groups.get(city) ?? []), activity]);
    });

    return Array.from(groups.entries()).map(([city, groupedActivities]) => ({
      city,
      activities: groupedActivities,
    }));
  }

  totalUsed(): number {
    return this.flightTotal() + this.hotelTotal() + this.activitiesTotal();
  }

  budget(): number {
    return Number(this.overview()?.budget ?? this.tripTemp.budget ?? 0);
  }

  remaining(): number {
    return this.budget() - this.totalUsed();
  }

  usedPercent(): number {
    if (!this.budget()) {
      return 0;
    }

    return Math.min(100, Math.round((this.totalUsed() / this.budget()) * 100));
  }

  currencySymbol(): string {
    const currency = this.overview()?.currency || this.tripTemp.currency;
    return currency === 'EUR' ? '€' : currency;
  }

  async confirmTrip(): Promise<void> {
    await this.saveTrip('UPCOMING', true);
  }

  async saveLater(): Promise<void> {
    await this.saveTrip('PLANNING', false);
  }

  isEditingSavedTrip(): boolean {
    return Boolean(this.tripTemp.draftTripId);
  }

  async primarySaveAction(): Promise<void> {
    if (this.isEditingSavedTrip()) {
      await this.saveChanges();
      return;
    }

    await this.confirmTrip();
  }

  async saveChanges(): Promise<void> {
    const tripId = this.tripTemp.draftTripId;

    if (!tripId || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.saveError.set('');

    try {
      const savedTrip = await firstValueFrom(this.tripPlanningService.getTrip(tripId));
      const updatedTrip = await firstValueFrom(this.tripPlanningService.updateTrip(
        tripId,
        this.buildCreateTripRequest(savedTrip.status),
      ));
      this.friendNotificationService.refresh();
      this.tripTempService.updateTripTemp({ draftTripId: updatedTrip.id });
      void this.router.navigate(['/trips']);
    } catch (error: unknown) {
      this.saveError.set(this.saveErrorMessage(error, false));
    } finally {
      this.isSaving.set(false);
    }
  }

  toggleExportMenu(): void {
    if (this.isExportingPdf()) {
      return;
    }

    this.isExportMenuOpen.update((isOpen) => !isOpen);
  }

  @HostListener('document:click', ['$event'])
  closeExportMenuOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (!target?.closest('.export-wrapper')) {
      this.isExportMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeExportMenuOnEscape(): void {
    this.isExportMenuOpen.set(false);
  }

  async exportTripSummary(): Promise<void> {
    if (this.isExportingPdf()) {
      return;
    }

    this.isExportingPdf.set(true);
    this.isExportMenuOpen.set(false);
    this.exportError.set('');

    try {
      const { exportTripSummaryPdf } = await this.loadPdfExporter();
      await exportTripSummaryPdf(this);
    } catch {
      this.exportError.set('Could not export your trip summary. Please try again.');
    } finally {
      this.isExportingPdf.set(false);
    }
  }

  cityOnly(value: string): string {
    return value.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim();
  }

  private loadPdfExporter(): Promise<typeof import('./trip-summary-pdf.exporter')> {
    return import('./trip-summary-pdf.exporter');
  }

  tripTypeLabel(): string {
    if (this.isMultiCityTrip()) {
      return 'Multi-City';
    }

    if (this.isRoundTrip()) {
      return 'Round Trip';
    }

    return 'One Way';
  }

  private travelerCount(): number {
    return Math.max(Number(this.tripTemp.travelers) || 1, 1);
  }

  private airportOrCity(value: string): string {
    return value.trim() || 'Not selected';
  }

  private isRoundTrip(): boolean {
    return Boolean(this.tripTemp.returnDate && this.tripTemp.selectedFlightId.includes('|') && !this.isMultiCityTrip());
  }

  private isMultiCityTrip(): boolean {
    return this.route.snapshot.queryParamMap.get('tripType') === 'multi-city'
      || this.multiCitySegmentsFromQuery().length > 0;
  }

  private singleFlightSegment(
    label: string,
    from: string,
    to: string,
    date: string,
    details: {
      id: string;
      airline: string;
      flightNumber: string;
      departureTime: string;
      arrivalTime: string;
      duration: string;
      stops: string;
      price: number;
    },
  ): OverviewFlightSegment {
    return {
      label,
      airline: details.airline || 'Airline not selected',
      flightNumber: details.flightNumber || details.id || '',
      from: this.airportOrCity(from),
      to: this.airportOrCity(to),
      date,
      departureTime: details.departureTime,
      arrivalTime: details.arrivalTime,
      duration: details.duration,
      stops: details.stops || 'Direct',
      price: details.price,
    };
  }

  private roundTripFlightSegments(): OverviewFlightSegment[] {
    const ids = this.splitSelection(this.tripTemp.selectedFlightId, '|');
    const airlines = this.splitSelection(this.tripTemp.selectedFlightAirline, '+');
    const flightNumbers = this.splitSelection(this.tripTemp.selectedFlightNumber, '/');
    const durations = this.extractLabelledParts(this.tripTemp.selectedFlightDuration, ['Outbound', 'Return']);
    const stops = this.extractLabelledParts(this.tripTemp.selectedFlightStops, ['outbound', 'return']);
    const price = this.flightTotal() ? Math.round(this.flightTotal() / 2) : 0;

    return [
      this.singleFlightSegment('Outbound', this.tripTemp.origin, this.tripTemp.destination, this.tripTemp.departureDate, {
        id: ids[0] ?? '',
        airline: airlines[0] ?? '',
        flightNumber: flightNumbers[0] ?? '',
        departureTime: this.tripTemp.selectedFlightDepartureTime,
        arrivalTime: '',
        duration: durations[0] ?? '',
        stops: stops[0] ?? '',
        price,
      }),
      this.singleFlightSegment('Return', this.tripTemp.destination, this.tripTemp.origin, this.tripTemp.returnDate, {
        id: ids[1] ?? '',
        airline: airlines[1] ?? airlines[0] ?? '',
        flightNumber: flightNumbers[1] ?? '',
        departureTime: '',
        arrivalTime: this.tripTemp.selectedFlightArrivalTime,
        duration: durations[1] ?? '',
        stops: stops[1] ?? '',
        price: this.flightTotal() - price,
      }),
    ];
  }

  private multiCityFlightSegments(): OverviewFlightSegment[] {
    const routeSegments = this.multiCitySegmentsFromQuery();
    const ids = this.splitSelection(this.tripTemp.selectedFlightId, '|');
    const airlines = this.splitSelection(this.tripTemp.selectedFlightAirline, '+');
    const flightNumbers = this.splitSelection(this.tripTemp.selectedFlightNumber, '/');
    const durations = this.extractSegmentParts(this.tripTemp.selectedFlightDuration);
    const stops = this.extractSegmentParts(this.tripTemp.selectedFlightStops);
    const segmentCount = Math.max(routeSegments.length, ids.length, airlines.length, flightNumbers.length, 1);
    const basePrice = segmentCount > 0 && this.flightTotal() ? Math.floor(this.flightTotal() / segmentCount) : 0;

    return Array.from({ length: segmentCount }, (_value, index) => {
      const routeSegment = routeSegments[index];
      const price = index === segmentCount - 1
        ? this.flightTotal() - basePrice * (segmentCount - 1)
        : basePrice;

      return this.singleFlightSegment(`Segment ${index + 1}`, routeSegment?.fromText ?? '', routeSegment?.toText ?? '', routeSegment?.date ?? '', {
        id: ids[index] ?? '',
        airline: airlines[index] ?? '',
        flightNumber: flightNumbers[index] ?? '',
        departureTime: index === 0 ? this.tripTemp.selectedFlightDepartureTime : '',
        arrivalTime: index === segmentCount - 1 ? this.tripTemp.selectedFlightArrivalTime : '',
        duration: durations[index] ?? '',
        stops: stops[index] ?? '',
        price,
      });
    });
  }

  private multiCitySegmentsFromQuery(): Array<{ fromText: string; toText: string; date: string }> {
    const rawSegments = this.route.snapshot.queryParamMap.get('multiCitySegments');

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

  private splitSelection(value: string, separator: string): string[] {
    return value
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private extractLabelledParts(value: string, labels: string[]): string[] {
    if (!value) {
      return [];
    }

    return labels.map((label) => {
      const escapedLabels = labels.map((currentLabel) => currentLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const nextLabels = escapedLabels.filter((currentLabel) => currentLabel.toLowerCase() !== label.toLowerCase()).join('|');
      const pattern = nextLabels
        ? new RegExp(`${label}\\s+(.+?)(?:\\s+·\\s+(?:${nextLabels})\\s+|$)`, 'i')
        : new RegExp(`${label}\\s+(.+)$`, 'i');
      return value.match(pattern)?.[1]?.trim() ?? '';
    });
  }

  private extractSegmentParts(value: string): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/\s+·\s+/)
      .map((part) => part.replace(/^Segment\s+\d+\s+/i, '').trim())
      .filter(Boolean);
  }

  private effectiveNights(): number {
    const fallbackNights = this.tripTemp.durationNights || this.overview()?.duration || 1;
    return this.dateBasedNights() ?? fallbackNights;
  }

  private dateBasedNights(): number | null {
    // Destination dates override the initial Budget duration estimate.
    return this.nightsBetween(this.tripTemp.departureDate, this.tripTemp.returnDate)
      ?? this.multiCityDateNights();
  }

  private multiCityDateNights(): number | null {
    const segmentDates = this.multiCitySegmentsFromQuery()
      .map((segment) => segment.date)
      .filter(Boolean);

    if (segmentDates.length < 2) {
      return null;
    }

    return this.nightsBetween(segmentDates[0], segmentDates[segmentDates.length - 1]);
  }

  private selectedHotelStays(): TripTempHotelStay[] {
    const overviewHotelStays = this.parseJsonArray<TripTempHotelStay>(this.overview()?.selectedHotelStaysJson);
    return overviewHotelStays.length ? overviewHotelStays : this.tripTemp.selectedHotels ?? [];
  }

  private repricedHotelStays(stays: TripTempHotelStay[]): OverviewHotelStay[] {
    return stays.map((stay) => this.repriceHotelStay(stay));
  }

  private repriceHotelStay(stay: TripTempHotelStay): OverviewHotelStay {
    const stayDates = this.hotelStayDates(stay.city) ?? { checkIn: stay.checkIn, checkOut: stay.checkOut };
    const dateNights = this.nightsBetween(stayDates.checkIn, stayDates.checkOut);
    const nights = dateNights ?? stay.nights ?? this.nights();
    const pricePerNight = stay.nights > 0 && stay.price > 0 ? stay.price / stay.nights : 0;

    return {
      hotelName: stay.hotelName,
      city: stay.city,
      checkIn: stayDates.checkIn,
      checkOut: stayDates.checkOut,
      nights,
      stars: stay.stars,
      price: Math.round((dateNights && pricePerNight ? pricePerNight * nights : stay.price) * this.travelerCount()),
    };
  }

  private hotelStayDates(city: string): { checkIn: string; checkOut: string } | null {
    const segments = this.flightSegments();

    if (segments.length < 2 && !this.isMultiCityTrip()) {
      return null;
    }

    const cityName = this.cityOnly(city);
    const arrivalIndex = segments.findIndex((segment) => this.cityOnly(segment.to) === cityName);

    if (arrivalIndex < 0) {
      return null;
    }

    const arrivalSegment = segments[arrivalIndex];
    const nextSegment = segments[arrivalIndex + 1];
    const departureSegment = segments.find((segment) => (
      this.cityOnly(segment.from) === cityName
      && segment.date > arrivalSegment.date
    ));
    const checkIn = arrivalSegment.date;
    const checkOut = departureSegment?.date || nextSegment?.date || this.tripTemp.returnDate;

    return checkIn && checkOut ? { checkIn, checkOut } : null;
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

  private parseJsonArray<T>(value: string | null | undefined): T[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as T[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async saveTrip(status: TripStatus, exportToCalendar: boolean): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    const request = this.buildCreateTripRequest(status);

    if (!request.startDate || !request.endDate) {
      this.saveError.set('Choose trip dates before saving this trip.');
      return;
    }

    this.isSaving.set(true);
    this.saveError.set('');

    try {
      const savedTrip = await firstValueFrom(this.tripTemp.draftTripId
        ? this.tripPlanningService.updateTrip(this.tripTemp.draftTripId, request)
        : this.tripPlanningService.createTrip(request));
      this.friendNotificationService.refresh();
      this.tripTemp.draftTripId = savedTrip.id;
      this.tripTempService.updateTripTemp({ draftTripId: savedTrip.id });

      if (exportToCalendar) {
        try {
          await this.exportTripToCalendar();
        } catch {
          this.saveError.set('Trip saved, but it could not be exported to the calendar.');
        }
      }

      if (!this.saveError()) {
        void this.router.navigate(['/trips']);
      }
    } catch (error: unknown) {
      this.saveError.set(this.saveErrorMessage(error, exportToCalendar));
    } finally {
      this.isSaving.set(false);
    }
  }

  private saveErrorMessage(error: unknown, exportToCalendar: boolean): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.backendErrorMessage(error);

      if (backendMessage) {
        return backendMessage;
      }

      if (error.status === 0) {
        return 'Could not reach the backend. Make sure the backend is running on port 8080.';
      }

      if (error.status === 401 || error.status === 403) {
        return 'Your login session cannot save this trip. Please log in again.';
      }

      return `Could not save this trip. Backend returned ${error.status}.`;
    }

    return exportToCalendar
      ? 'Could not confirm this trip. Please try again.'
      : 'Could not save this trip as a draft. Please try again.';
  }

  private backendErrorMessage(error: HttpErrorResponse): string {
    const errorBody = error.error as { message?: unknown } | string | null;

    if (typeof errorBody === 'string') {
      return errorBody;
    }

    return typeof errorBody?.message === 'string' ? errorBody.message : '';
  }

  private buildCreateTripRequest(status: TripStatus): CreateTripRequest {
    const startDate = this.tripTemp.departureDate;
    const endDate = this.tripTemp.returnDate || this.tripTemp.departureDate;

    return {
      name: this.tripName().trim(),
      destination: this.destinationName(),
      startDate,
      endDate,
      budget: this.budget(),
      status,
      tripPlanningId: this.tripTemp.tripPlanningId,
      origin: this.tripTemp.origin,
      destinationCities: JSON.stringify(this.tripTemp.destinationCities),
      currency: this.tripTemp.currency,
      durationNights: this.nights(),
      travelStyle: this.tripTemp.travelStyle,
      travelers: this.tripTemp.travelers,
      flightId: this.tripTemp.selectedFlightId,
      flightTitle: this.flightTitle(),
      flightAirline: this.tripTemp.selectedFlightAirline,
      flightNumber: this.tripTemp.selectedFlightNumber,
      flightDepartureTime: this.tripTemp.selectedFlightDepartureTime,
      flightArrivalTime: this.tripTemp.selectedFlightArrivalTime,
      flightDuration: this.tripTemp.selectedFlightDuration,
      flightStops: this.tripTemp.selectedFlightStops,
      flightDetails: this.flightDetails(),
      flightTotal: this.flightTotal(),
      flightSegmentsJson: JSON.stringify(this.flightSegments()),
      hotelName: this.hotelName(),
      hotelCity: this.hotelCity(),
      hotelStars: this.hotelStars(),
      hotelDetails: [
        this.hotelCity(),
        this.hotelStars() ? `${this.hotelStars()} stars` : '',
      ].filter(Boolean).join(' · '),
      hotelTotal: this.hotelTotal(),
      hotelStaysJson: JSON.stringify(this.hotelStays()),
      activitiesTitle: `${this.selectedActivities().length} selected`,
      activitiesDetails: this.selectedActivities().length
        ? this.selectedActivities().map((activity) => activity.name).join(', ')
        : 'No activities selected',
      activitiesJson: JSON.stringify(this.selectedActivities()),
      activitiesTotal: this.activitiesTotal(),
    };
  }

  private async exportTripToCalendar(): Promise<void> {
    const tripId = this.tripTemp.draftTripId ?? undefined;

    if (tripId) {
      // Replaces previous Trip Planning calendar items for this confirmed trip.
      await this.calendarService.deleteEventsForTrip(tripId);
    }

    const events = this.buildCalendarEvents(tripId);

    for (const event of events) {
      await this.calendarService.addEvent(event);
    }
  }

  private buildCalendarEvents(tripId?: number): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    if (this.tripTemp.selectedFlightId || this.tripTemp.selectedFlightSegments?.length) {
      this.flightSegments().forEach((segment) => {
        const departureDate = this.calendarDate(segment.date);

        if (!departureDate) {
          return;
        }

        events.push({
          title: `Flight: ${[segment.airline, segment.flightNumber].filter(Boolean).join(' ') || `${segment.from} to ${segment.to}`}`,
          startDate: departureDate,
          endDate: departureDate,
          price: segment.price,
          location: `${segment.from} → ${segment.to}`,
          category: 'Flight',
          description: [
            `${segment.from} → ${segment.to}`,
            segment.airline,
            segment.flightNumber,
            segment.duration,
            segment.stops,
          ].filter(Boolean).join(' · '),
          startTime: this.calendarTime(segment.departureTime),
          endTime: this.calendarTime(segment.arrivalTime),
          tripId,
        });
      });
    }

    this.hotelStays().forEach((stay) => {
      const checkIn = this.calendarDate(stay.checkIn);
      const checkOut = this.calendarDate(stay.checkOut);

      if (!checkIn || !checkOut) {
        return;
      }

      events.push({
        title: `Hotel: ${stay.hotelName}`,
        startDate: checkIn,
        endDate: checkOut,
        price: stay.price,
        location: stay.city,
        category: 'Hotel',
        description: [
          `${stay.hotelName} in ${stay.city}`,
          `${stay.nights} ${stay.nights === 1 ? 'night' : 'nights'}`,
          stay.stars ? `${stay.stars} stars` : '',
        ].filter(Boolean).join(' · '),
        tripId,
      });
    });

    this.selectedActivities().forEach((activity) => {
      const activityDate = this.calendarDate(activity.date);

      if (!activityDate) {
        return;
      }

      const activityTimes = this.calendarTimeRange(activity.time);

      events.push({
        title: activity.name,
        startDate: activityDate,
        endDate: activityDate,
        price: this.activityTotal(activity),
        location: activity.city,
        category: 'Activity',
        description: `${activity.category} · ${activity.duration}`,
        startTime: activityTimes.startTime,
        endTime: activityTimes.endTime,
        tripId,
      });
    });

    return this.uniqueCalendarEvents(events);
  }

  private calendarDate(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    const trimmedValue = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      return trimmedValue;
    }

    const parsed = new Date(trimmedValue);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return this.formatDate(parsed);
  }

  private calendarTime(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const match = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : undefined;
  }

  private calendarTimeRange(value: string | undefined): { startTime?: string; endTime?: string } {
    if (!value) {
      return {};
    }

    const matches = Array.from(value.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g));

    return {
      startTime: matches[0] ? `${matches[0][1].padStart(2, '0')}:${matches[0][2]}` : undefined,
      endTime: matches[1] ? `${matches[1][1].padStart(2, '0')}:${matches[1][2]}` : undefined,
    };
  }

  private uniqueCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
    const seen = new Set<string>();

    return events.filter((event) => {
      const key = [
        event.category,
        event.title,
        event.startDate,
        event.endDate,
        event.location,
      ].join('|');

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private overviewErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (this.hasFallbackSummary() && error.status === 404) {
        return '';
      }

      if (error.status === 0) {
        return 'Could not reach the backend. Make sure the backend is running on port 8080.';
      }

      if (error.status === 401 || error.status === 403) {
        return 'Your login session cannot access this trip overview. Please log in again.';
      }

      if (error.status === 404) {
        return 'This trip planning record was not found. Start again from the Budget step.';
      }

      return `Could not load your trip overview. Backend returned ${error.status}.`;
    }

    return 'Could not load your trip overview. Please try again.';
  }

  private readTripPlanningId(): number | null {
    const routeTripPlanningId = Number(this.route.snapshot.queryParamMap.get('tripPlanningId'));

    if (Number.isFinite(routeTripPlanningId) && routeTripPlanningId > 0) {
      return routeTripPlanningId;
    }

    return this.tripTemp.tripPlanningId ?? null;
  }
}

function destinationNameFallback(value: string): string {
  return value.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim() || 'Destination';
}
