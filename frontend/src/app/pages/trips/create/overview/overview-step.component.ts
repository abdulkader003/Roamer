import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CalendarEvent } from '../../../hotels/models/hotel.model';
import { CalendarService } from '../../../hotels/services/calendar.service';
import { CreateTripRequest, TripOverviewResponse, TripPlanningService, TripStatus } from '../../../../services/trip-planning.service';
import { TripTempService } from '../trip-temp.service';

interface TripStep {
  number: number;
  label: string;
  state: 'complete' | 'active';
  route?: string;
}

@Component({
  selector: 'app-overview-step',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './overview-step.component.html',
  styleUrl: './overview-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewStepComponent implements OnInit {
  readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripPlanningService = inject(TripPlanningService);
  private readonly tripTempService = inject(TripTempService);
  private readonly calendarService = inject(CalendarService);

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
  readonly loadError = signal('');
  readonly saveError = signal('');
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

  dateRange(): string {
    if (!this.tripTemp.departureDate && !this.tripTemp.returnDate) {
      return 'Dates not selected';
    }

    return [this.tripTemp.departureDate, this.tripTemp.returnDate].filter(Boolean).join(' → ');
  }

  travelerLabel(): string {
    return `${this.tripTemp.travelers} traveler${this.tripTemp.travelers === 1 ? '' : 's'}`;
  }

  nights(): number {
    return this.overview()?.duration || this.tripTemp.durationNights || 1;
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
    if (!this.overview()?.selectedHotel && this.tripTemp.selectedHotelTotal !== null) {
      return this.tripTemp.selectedHotelTotal;
    }

    const pricePerNight = Number(this.overview()?.selectedHotel?.pricePerNight ?? 0);
    return Math.round(pricePerNight * this.nights());
  }

  selectedActivities() {
    return this.overview()?.selectedActivities?.length
      ? this.overview()?.selectedActivities ?? []
      : this.tripTemp.selectedActivities;
  }

  activitiesTotal(): number {
    return Number(this.overview()?.totalActivitiesCost ?? this.tripTemp.selectedActivitiesTotal ?? 0);
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

  private cityOnly(value: string): string {
    return value.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim();
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
      durationNights: this.tripTemp.durationNights,
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
      hotelName: this.hotelName(),
      hotelCity: this.hotelCity(),
      hotelStars: this.hotelStars(),
      hotelDetails: [
        this.hotelCity(),
        this.hotelStars() ? `${this.hotelStars()} stars` : '',
      ].filter(Boolean).join(' · '),
      hotelTotal: this.hotelTotal(),
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
    const events = this.buildCalendarEvents(tripId);

    for (const event of events) {
      await this.calendarService.addEvent(event);
    }
  }

  private buildCalendarEvents(tripId?: number): CalendarEvent[] {
    const startDate = this.tripTemp.departureDate;
    const endDate = this.tripTemp.returnDate || this.tripTemp.departureDate;
    const events: CalendarEvent[] = [];

    events.push({
      title: this.tripName(),
      startDate,
      endDate,
      price: this.totalUsed(),
      location: this.destinationName(),
      category: 'Trip',
      description: `${this.destinationName()} · ${this.nights()} nights · ${this.travelerLabel()}`,
      notes: `Budget: ${this.currencySymbol()}${this.budget()}`,
      tripId,
    });

    if (this.flightTotal() > 0) {
      events.push({
        title: `Flight: ${this.flightTitle()}`,
        startDate,
        endDate: startDate,
        price: this.flightTotal(),
        location: this.flightDetails(),
        category: 'Flight',
        description: this.flightDetails(),
        startTime: this.tripTemp.selectedFlightDepartureTime || '00:00',
        endTime: this.tripTemp.selectedFlightArrivalTime || '23:59',
        tripId,
      });
    }

    if (this.hotelName() !== 'Hotel not selected' && this.hotelTotal() > 0) {
      events.push({
        title: `Hotel: ${this.hotelName()}`,
        startDate,
        endDate,
        price: this.hotelTotal(),
        location: this.hotelCity(),
        category: 'Hotel',
        description: `${this.hotelName()} in ${this.hotelCity()}`,
        tripId,
      });
    }

    for (const activity of this.selectedActivities()) {
      events.push({
        title: activity.name,
        startDate,
        endDate: startDate,
        price: activity.price,
        location: activity.city,
        category: 'Activity',
        description: `${activity.category} · ${activity.duration}`,
        tripId,
      });
    }

    return events;
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
