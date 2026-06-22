import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CreateTripRequest, TripPlanningService, TripResponse } from '../../../services/trip-planning.service';
import { TripTemp, TripTempService } from '../create/trip-temp.service';

interface TripEditForm {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
}

interface CalendarDay {
  date: Date;
  label: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isInRange: boolean;
}

@Component({
  selector: 'app-trip',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './trip.component.html',
  styleUrl: './trip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripComponent implements OnInit {
  private readonly tripPlanningService = inject(TripPlanningService);
  private readonly tripTempService = inject(TripTempService);
  private readonly router = inject(Router);

  readonly trips = signal<TripResponse[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal('');
  readonly selectedTrip = signal<TripResponse | null>(null);
  readonly isEditing = signal(false);
  readonly isActionSaving = signal(false);
  readonly actionError = signal('');
  readonly showDeleteConfirm = signal(false);
  readonly activeEditDatePicker = signal<'startDate' | 'endDate' | null>(null);
  readonly editManualDateText = signal('');
  readonly editManualDateError = signal('');
  readonly editDatePickerMonth = signal(this.firstDayOfMonth(new Date()));
  editTripForm: TripEditForm | null = null;

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.tripPlanningService.listSavedTrips().subscribe({
      next: (trips) => {
        this.trips.set(trips);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load your trips. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  formatBudget(trip: TripResponse): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(trip.budget);
  }

  statusFor(trip: TripResponse): string {
    return trip.status === 'UPCOMING' ? 'Confirmed' : 'Draft';
  }

  durationLabel(trip: TripResponse): string {
    const start = new Date(`${trip.startDate}T00:00:00`);
    const end = new Date(`${trip.endDate}T00:00:00`);
    const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

    return `${trip.destination} · ${nights} night${nights === 1 ? '' : 's'}`;
  }

  openTrip(trip: TripResponse): void {
    this.selectedTrip.set(trip);
    this.isEditing.set(false);
    this.isActionSaving.set(false);
    this.actionError.set('');
    this.showDeleteConfirm.set(false);
    this.editTripForm = this.toEditForm(trip);
  }

  openTripFromKeyboard(event: KeyboardEvent, trip: TripResponse): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.openTrip(trip);
  }

  closeTripModal(): void {
    if (this.isActionSaving()) {
      return;
    }

    this.selectedTrip.set(null);
    this.isEditing.set(false);
    this.actionError.set('');
    this.showDeleteConfirm.set(false);
    this.closeEditDatePicker();
    this.editTripForm = null;
  }

  startEditing(): void {
    const trip = this.selectedTrip();

    if (!trip) {
      return;
    }

    this.editTripForm = this.toEditForm(trip);
    this.isEditing.set(true);
    this.actionError.set('');
    this.closeEditDatePicker();
  }

  cancelEditing(): void {
    const trip = this.selectedTrip();
    this.editTripForm = trip ? this.toEditForm(trip) : null;
    this.isEditing.set(false);
    this.actionError.set('');
    this.closeEditDatePicker();
  }

  saveTripEdits(): void {
    const trip = this.selectedTrip();

    if (!trip || !this.editTripForm || this.isActionSaving()) {
      return;
    }

    this.updateTrip(trip, trip.status);
  }

  continueDraft(): void {
    const trip = this.selectedTrip();

    if (!trip || this.isActionSaving()) {
      return;
    }

    const currentTripTemp = this.tripTempService.getTripTemp();
    const canResumeStoredDraft = currentTripTemp.draftTripId === trip.id;

    if (!canResumeStoredDraft) {
      this.tripTempService.clearTripTemp();
    }

    const nextTripTemp = this.tripTempService.updateTripTemp({
      draftTripId: trip.id,
      tripPlanningId: trip.tripPlanningId ?? (canResumeStoredDraft ? currentTripTemp.tripPlanningId : null),
      tripName: trip.name,
      budget: trip.budget,
      currency: trip.currency || 'EUR',
      durationNights: trip.durationNights ?? this.nightsFor(trip),
      travelStyle: trip.travelStyle || (canResumeStoredDraft ? currentTripTemp.travelStyle : 'Mid-range'),
      origin: trip.origin || (canResumeStoredDraft ? currentTripTemp.origin : ''),
      destination: trip.destination,
      destinationCities: this.destinationCitiesFor(trip, currentTripTemp, canResumeStoredDraft),
      departureDate: trip.startDate,
      returnDate: trip.endDate,
      travelers: trip.travelers || (canResumeStoredDraft ? currentTripTemp.travelers || 2 : 2),
      selectedFlightId: trip.flightId || (canResumeStoredDraft ? currentTripTemp.selectedFlightId : ''),
      selectedFlightAirline: trip.flightAirline || (canResumeStoredDraft ? currentTripTemp.selectedFlightAirline : ''),
      selectedFlightNumber: trip.flightNumber || (canResumeStoredDraft ? currentTripTemp.selectedFlightNumber : ''),
      selectedFlightDepartureTime: trip.flightDepartureTime || (canResumeStoredDraft ? currentTripTemp.selectedFlightDepartureTime : ''),
      selectedFlightArrivalTime: trip.flightArrivalTime || (canResumeStoredDraft ? currentTripTemp.selectedFlightArrivalTime : ''),
      selectedFlightDuration: trip.flightDuration || (canResumeStoredDraft ? currentTripTemp.selectedFlightDuration : ''),
      selectedFlightStops: trip.flightStops || (canResumeStoredDraft ? currentTripTemp.selectedFlightStops : ''),
      selectedFlightTotal: trip.flightTotal ?? (canResumeStoredDraft ? currentTripTemp.selectedFlightTotal : null),
      selectedHotelName: trip.hotelName || (canResumeStoredDraft ? currentTripTemp.selectedHotelName : ''),
      selectedHotelCity: trip.hotelCity || (canResumeStoredDraft ? currentTripTemp.selectedHotelCity : ''),
      selectedHotelStars: trip.hotelStars ?? (canResumeStoredDraft ? currentTripTemp.selectedHotelStars : null),
      selectedHotelTotal: trip.hotelTotal ?? (canResumeStoredDraft ? currentTripTemp.selectedHotelTotal : null),
      selectedActivities: this.activitiesFor(trip, currentTripTemp, canResumeStoredDraft),
      selectedActivitiesTotal: trip.activitiesTotal ?? (canResumeStoredDraft ? currentTripTemp.selectedActivitiesTotal : 0),
    });

    const resumeRoute = this.resumeRouteFor(nextTripTemp);
    const queryParams = nextTripTemp.tripPlanningId ? { tripPlanningId: nextTripTemp.tripPlanningId } : undefined;
    void this.router.navigate([resumeRoute], { queryParams });
  }

  editTripInWizard(): void {
    const trip = this.selectedTrip();

    if (!trip || this.isActionSaving()) {
      return;
    }

    const existing = this.matchingTripTemp(trip);

    this.tripTempService.clearTripTemp();
    this.tripTempService.updateTripTemp({
      draftTripId: trip.id,
      tripPlanningId: existing?.tripPlanningId,
      tripName: trip.name,
      budget: trip.budget,
      currency: 'EUR',
      durationNights: this.nightsFor(trip),
      travelStyle: existing?.travelStyle || 'Mid-range',
      origin: existing?.origin || '',
      destination: existing?.destination || trip.destination,
      destinationCities: existing?.destinationCities?.length
        ? existing.destinationCities
        : [this.cityOnly(trip.destination)].filter(Boolean),
      departureDate: trip.startDate,
      returnDate: trip.endDate,
      travelers: trip.travelers || existing?.travelers || 2,
      ...this.flightTempFromTrip(trip, existing),
      ...this.hotelTempFromTrip(trip, existing),
      ...this.activitiesTempFromTrip(trip, existing),
    });

    void this.router.navigate(['/trips/create/budget']);
  }

  private flightTempFromTrip(trip: TripResponse, existing: TripTemp | null): Partial<TripTemp> {
    if (existing?.selectedFlightId) {
      return {};
    }

    const title = (trip.flightTitle ?? '').trim();
    const total = Number(trip.flightTotal ?? 0);

    if ((!title || title === 'Flight not selected') && total <= 0) {
      return {};
    }

    const [airline, flightNumber] = title.split('·').map((part) => part.trim());
    const details = (trip.flightDetails ?? '').split('·').map((part) => part.trim());
    const [departureTime, arrivalTime] = (details[0] ?? '').split('→').map((part) => part.trim());

    return {
      selectedFlightId: `restored-${trip.id}`,
      selectedFlightAirline: airline || '',
      selectedFlightNumber: flightNumber || '',
      selectedFlightDepartureTime: departureTime || '',
      selectedFlightArrivalTime: arrivalTime || '',
      selectedFlightDuration: details[1] || '',
      selectedFlightStops: details[2] || '',
      selectedFlightTotal: total,
    };
  }

  private hotelTempFromTrip(trip: TripResponse, existing: TripTemp | null): Partial<TripTemp> {
    if (existing?.selectedHotelName) {
      return {};
    }

    const name = (trip.hotelName ?? '').trim();
    const total = Number(trip.hotelTotal ?? 0);

    if ((!name || name === 'Hotel not selected') && total <= 0) {
      return {};
    }

    const details = (trip.hotelDetails ?? '').split('·').map((part) => part.trim());
    const city = details[0] || this.cityOnly(trip.destination);
    const starsMatch = (trip.hotelDetails ?? '').match(/(\d+(?:\.\d+)?)\s*stars?/i);

    return {
      selectedHotelName: name,
      selectedHotelCity: city,
      selectedHotelStars: starsMatch ? Number(starsMatch[1]) : 0,
      selectedHotelTotal: total,
    };
  }

  private activitiesTempFromTrip(trip: TripResponse, existing: TripTemp | null): Partial<TripTemp> {
    if (existing?.selectedActivities?.length) {
      return {};
    }

    const total = Number(trip.activitiesTotal ?? 0);
    const names = (trip.activitiesDetails ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (!names.length && total <= 0) {
      return {};
    }

    const perActivity = names.length ? total / names.length : 0;
    const city = this.cityOnly(trip.destination);

    return {
      selectedActivities: names.map((name) => ({
        name,
        category: 'Activity',
        price: perActivity,
        duration: '',
        city,
      })),
      selectedActivitiesTotal: total,
    };
  }

  confirmDeleteTrip(): void {
    this.showDeleteConfirm.set(true);
  }

  cancelDeleteTrip(): void {
    this.showDeleteConfirm.set(false);
  }

  deleteSelectedTrip(): void {
    const trip = this.selectedTrip();

    if (!trip || this.isActionSaving()) {
      return;
    }

    this.isActionSaving.set(true);
    this.actionError.set('');
    this.showDeleteConfirm.set(false);

    this.tripPlanningService.deleteTrip(trip.id).subscribe({
      next: () => {
        this.trips.update((trips) => trips.filter((savedTrip) => savedTrip.id !== trip.id));
        this.isActionSaving.set(false);
        this.closeTripModal();
      },
      error: () => {
        this.actionError.set('Could not delete this trip. Please try again.');
        this.isActionSaving.set(false);
      },
    });
  }

  formatDateRange(trip: TripResponse): string {
    return `${this.formatDisplayDate(trip.startDate)} → ${this.formatDisplayDate(trip.endDate)}`;
  }

  modalDestinationName(trip: TripResponse): string {
    return trip.destination || this.matchingTripTemp(trip)?.destination || 'Destination';
  }

  modalTravelerLabel(trip: TripResponse): string {
    const travelers = trip.travelers || this.matchingTripTemp(trip)?.travelers || 1;
    return `${travelers} traveler${travelers === 1 ? '' : 's'}`;
  }

  modalFlightTitle(trip: TripResponse): string {
    if (trip.flightTitle) {
      return trip.flightTitle;
    }

    const tripTemp = this.matchingTripTemp(trip);

    if (!tripTemp?.selectedFlightAirline && !tripTemp?.selectedFlightNumber) {
      return 'Flight not selected';
    }

    return [tripTemp.selectedFlightAirline, tripTemp.selectedFlightNumber].filter(Boolean).join(' · ');
  }

  modalFlightDetails(trip: TripResponse): string {
    if (trip.flightDetails) {
      return trip.flightDetails;
    }

    const tripTemp = this.matchingTripTemp(trip);

    if (!tripTemp?.selectedFlightId) {
      return 'Departure → Arrival';
    }

    return [
      tripTemp.selectedFlightDepartureTime && tripTemp.selectedFlightArrivalTime
        ? `${tripTemp.selectedFlightDepartureTime} → ${tripTemp.selectedFlightArrivalTime}`
        : '',
      tripTemp.selectedFlightDuration,
      tripTemp.selectedFlightStops,
    ].filter(Boolean).join(' · ');
  }

  modalFlightTotal(trip: TripResponse): number {
    return Number(trip.flightTotal ?? this.matchingTripTemp(trip)?.selectedFlightTotal ?? 0);
  }

  modalHotelName(trip: TripResponse): string {
    return trip.hotelName || this.matchingTripTemp(trip)?.selectedHotelName || 'Hotel not selected';
  }

  modalHotelDetails(trip: TripResponse): string {
    if (trip.hotelDetails) {
      return trip.hotelDetails;
    }

    const tripTemp = this.matchingTripTemp(trip);

    return [
      tripTemp?.selectedHotelCity || this.modalDestinationName(trip),
      tripTemp?.selectedHotelStars ? `${tripTemp.selectedHotelStars} stars` : '',
    ].filter(Boolean).join(' · ');
  }

  modalHotelTotal(trip: TripResponse): number {
    return Number(trip.hotelTotal ?? this.matchingTripTemp(trip)?.selectedHotelTotal ?? 0);
  }

  modalActivitiesTitle(trip: TripResponse): string {
    if (trip.activitiesTitle) {
      return trip.activitiesTitle;
    }

    const count = this.matchingTripTemp(trip)?.selectedActivities.length ?? 0;
    return `${count} selected`;
  }

  modalActivitiesDetails(trip: TripResponse): string {
    if (trip.activitiesDetails) {
      return trip.activitiesDetails;
    }

    const activities = this.matchingTripTemp(trip)?.selectedActivities ?? [];
    return activities.length ? activities.map((activity) => activity.name).join(', ') : 'No activities selected';
  }

  modalActivitiesTotal(trip: TripResponse): number {
    return Number(trip.activitiesTotal ?? this.matchingTripTemp(trip)?.selectedActivitiesTotal ?? 0);
  }

  modalTotalUsed(trip: TripResponse): number {
    return this.modalFlightTotal(trip) + this.modalHotelTotal(trip) + this.modalActivitiesTotal(trip);
  }

  modalRemaining(trip: TripResponse): number {
    return Number(trip.budget || 0) - this.modalTotalUsed(trip);
  }

  modalUsedPercent(trip: TripResponse): number {
    if (!trip.budget) {
      return 0;
    }

    return Math.min(100, Math.round((this.modalTotalUsed(trip) / Number(trip.budget)) * 100));
  }

  modalHasStoredDetails(trip: TripResponse): boolean {
    return this.modalHasFlightData(trip) || this.modalHasHotelData(trip) || this.modalHasActivitiesData(trip);
  }

  modalHasFlightData(trip: TripResponse): boolean {
    const hasDbTitle = Boolean(trip.flightTitle) && trip.flightTitle !== 'Flight not selected';
    const hasDbCost = Number(trip.flightTotal ?? 0) > 0;
    const tripTemp = this.matchingTripTemp(trip);
    return hasDbTitle || hasDbCost || Boolean(tripTemp?.selectedFlightId);
  }

  modalHasHotelData(trip: TripResponse): boolean {
    const hasDbName = Boolean(trip.hotelName) && trip.hotelName !== 'Hotel not selected';
    const hasDbCost = Number(trip.hotelTotal ?? 0) > 0;
    const tripTemp = this.matchingTripTemp(trip);
    return hasDbName || hasDbCost || Boolean(tripTemp?.selectedHotelName);
  }

  modalHasActivitiesData(trip: TripResponse): boolean {
    const hasDbTitle = Boolean(trip.activitiesTitle) && trip.activitiesTitle !== '0 selected';
    const hasDbCost = Number(trip.activitiesTotal ?? 0) > 0;
    const tripTemp = this.matchingTripTemp(trip);
    return hasDbTitle || hasDbCost || Boolean(tripTemp?.selectedActivities?.length);
  }

  editDateLabel(value: string): string {
    return value ? this.formatDisplayDate(value) : 'Select date';
  }

  toggleEditDatePicker(kind: 'startDate' | 'endDate'): void {
    if (!this.editTripForm) {
      return;
    }

    if (this.activeEditDatePicker() === kind) {
      this.closeEditDatePicker();
      return;
    }

    this.activeEditDatePicker.set(kind);
    this.syncEditDatePickerState(this.editTripForm[kind]);
  }

  closeEditDatePicker(): void {
    this.activeEditDatePicker.set(null);
    this.editManualDateText.set('');
    this.editManualDateError.set('');
  }

  moveEditDatePickerMonth(change: number): void {
    const currentMonth = this.editDatePickerMonth();
    this.editDatePickerMonth.set(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + change, 1));
  }

  updateEditDatePickerInput(value: string): void {
    this.editManualDateText.set(value);

    if (!value.trim()) {
      this.setActiveEditDate('');
      this.editManualDateError.set('');
      return;
    }

    const parsed = this.parseDateInput(value);

    if (!parsed) {
      this.editManualDateError.set('Use a valid date in YYYY-MM-DD format.');
      return;
    }

    this.applyEditDateValue(this.formatDateInput(parsed), false);
  }

  selectEditCalendarDay(day: CalendarDay): void {
    this.applyEditDateValue(this.formatDateInput(day.date), true);
  }

  activeEditDatePickerTitle(): string {
    return this.activeEditDatePicker() === 'endDate' ? 'Choose end date' : 'Choose start date';
  }

  activeEditDatePickerHint(): string {
    if (this.editManualDateError()) {
      return this.editManualDateError();
    }

    return this.activeEditDatePicker() === 'endDate'
      ? 'Pick the trip end date.'
      : 'Pick the trip start date.';
  }

  editCalendarDays(): CalendarDay[] {
    const month = this.editDatePickerMonth();
    const firstVisibleDate = new Date(month.getFullYear(), month.getMonth(), 1);
    firstVisibleDate.setDate(firstVisibleDate.getDate() - firstVisibleDate.getDay());

    const startDate = this.parseDateInput(this.editTripForm?.startDate ?? '');
    const endDate = this.parseDateInput(this.editTripForm?.endDate ?? '');
    const activeDate = this.parseDateInput(
      this.activeEditDatePicker() === 'endDate'
        ? this.editTripForm?.endDate ?? ''
        : this.editTripForm?.startDate ?? '',
    );
    const today = new Date();

    return Array.from({ length: 42 }, (_value, index) => {
      const date = new Date(firstVisibleDate);
      date.setDate(firstVisibleDate.getDate() + index);
      const isRangeStart = this.isSameDate(date, startDate);
      const isRangeEnd = this.isSameDate(date, endDate);
      const isBetweenRange = Boolean(startDate && endDate && date > startDate && date < endDate);

      return {
        date,
        label: String(date.getDate()),
        isCurrentMonth: date.getMonth() === month.getMonth(),
        isToday: this.isSameDate(date, today),
        isSelected: isRangeStart || isRangeEnd || this.isSameDate(date, activeDate),
        isInRange: isBetweenRange,
      };
    });
  }

  startNewTrip(): void {
    this.tripTempService.clearTripTemp();
  }

  private updateTrip(trip: TripResponse, status: TripResponse['status']): void {
    const request = this.buildUpdateRequest(trip, status);

    if (!request) {
      this.actionError.set('Please complete all trip fields before saving.');
      return;
    }

    if (new Date(`${request.endDate}T00:00:00`) < new Date(`${request.startDate}T00:00:00`)) {
      this.actionError.set('End date must be on or after the start date.');
      return;
    }

    this.isActionSaving.set(true);
    this.actionError.set('');

    this.tripPlanningService.updateTrip(trip.id, request).subscribe({
      next: (updatedTrip) => {
        this.trips.update((trips) => trips.map((savedTrip) => savedTrip.id === updatedTrip.id ? updatedTrip : savedTrip));
        this.selectedTrip.set(updatedTrip);
        this.editTripForm = this.toEditForm(updatedTrip);
        this.isEditing.set(false);
        this.isActionSaving.set(false);
      },
      error: () => {
        this.actionError.set('Could not save this trip. Please try again.');
        this.isActionSaving.set(false);
      },
    });
  }

  private buildUpdateRequest(trip: TripResponse, status: TripResponse['status']): CreateTripRequest | null {
    const form = this.editTripForm;

    if (!form || !form.name.trim() || !form.destination.trim() || !form.startDate || !form.endDate) {
      return null;
    }

    const request: CreateTripRequest = {
      name: form.name.trim(),
      destination: form.destination.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      budget: Number(form.budget) || 0,
      status,
    };

    this.addIfPresent(request, 'travelers', trip.travelers ?? this.matchingTripTemp(trip)?.travelers);
    this.addIfPresent(request, 'tripPlanningId', trip.tripPlanningId);
    this.addIfPresent(request, 'origin', trip.origin);
    this.addIfPresent(request, 'destinationCities', trip.destinationCities);
    this.addIfPresent(request, 'currency', trip.currency);
    this.addIfPresent(request, 'durationNights', trip.durationNights);
    this.addIfPresent(request, 'travelStyle', trip.travelStyle);
    this.addIfPresent(request, 'flightId', trip.flightId);
    this.addIfPresent(request, 'flightTitle', trip.flightTitle);
    this.addIfPresent(request, 'flightAirline', trip.flightAirline);
    this.addIfPresent(request, 'flightNumber', trip.flightNumber);
    this.addIfPresent(request, 'flightDepartureTime', trip.flightDepartureTime);
    this.addIfPresent(request, 'flightArrivalTime', trip.flightArrivalTime);
    this.addIfPresent(request, 'flightDuration', trip.flightDuration);
    this.addIfPresent(request, 'flightStops', trip.flightStops);
    this.addIfPresent(request, 'flightDetails', trip.flightDetails);
    this.addIfPresent(request, 'flightTotal', trip.flightTotal);
    this.addIfPresent(request, 'hotelName', trip.hotelName);
    this.addIfPresent(request, 'hotelCity', trip.hotelCity);
    this.addIfPresent(request, 'hotelStars', trip.hotelStars);
    this.addIfPresent(request, 'hotelDetails', trip.hotelDetails);
    this.addIfPresent(request, 'hotelTotal', trip.hotelTotal);
    this.addIfPresent(request, 'activitiesTitle', trip.activitiesTitle);
    this.addIfPresent(request, 'activitiesDetails', trip.activitiesDetails);
    this.addIfPresent(request, 'activitiesJson', trip.activitiesJson);
    this.addIfPresent(request, 'activitiesTotal', trip.activitiesTotal);

    return request;
  }

  private addIfPresent<K extends keyof CreateTripRequest>(
    request: CreateTripRequest,
    key: K,
    value: CreateTripRequest[K] | null | undefined,
  ): void {
    if (value !== null && value !== undefined && value !== '') {
      request[key] = value;
    }
  }

  private toEditForm(trip: TripResponse): TripEditForm {
    return {
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      budget: trip.budget,
    };
  }

  nightsFor(trip: TripResponse): number {
    const start = new Date(`${trip.startDate}T00:00:00`);
    const end = new Date(`${trip.endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 0;
    }

    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  }

  private cityOnly(value: string): string {
    return value.replace(/\s*\([A-Za-z]{3}\)\s*$/, '').trim();
  }

  private matchingTripTemp(trip: TripResponse): TripTemp | null {
    const tripTemp = this.tripTempService.getTripTemp();

    if (tripTemp.draftTripId === trip.id) {
      return tripTemp;
    }

    const sameSummary =
      tripTemp.tripName === trip.name &&
      tripTemp.departureDate === trip.startDate &&
      tripTemp.returnDate === trip.endDate &&
      this.cityOnly(tripTemp.destination) === this.cityOnly(trip.destination);

    return sameSummary ? tripTemp : null;
  }

  private destinationCitiesFor(trip: TripResponse, tripTemp: TripTemp, canResumeStoredDraft: boolean): string[] {
    const savedCities = this.parseJsonArray<string>(trip.destinationCities);

    if (savedCities.length) {
      return savedCities;
    }

    if (canResumeStoredDraft && tripTemp.destinationCities.length) {
      return tripTemp.destinationCities;
    }

    return [this.cityOnly(trip.destination)].filter(Boolean);
  }

  private activitiesFor(trip: TripResponse, tripTemp: TripTemp, canResumeStoredDraft: boolean): TripTemp['selectedActivities'] {
    const savedActivities = this.parseJsonArray<TripTemp['selectedActivities'][number]>(trip.activitiesJson);

    if (savedActivities.length) {
      return savedActivities;
    }

    return canResumeStoredDraft ? tripTemp.selectedActivities : [];
  }

  private parseJsonArray<T>(value: string | null | undefined): T[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }

  private resumeRouteFor(tripTemp: TripTemp): string {
    if (!tripTemp.origin || !tripTemp.destination || !tripTemp.departureDate) {
      return '/trips/create/destination';
    }

    if (!tripTemp.selectedFlightId) {
      return '/trips/create/flights';
    }

    if (!tripTemp.selectedHotelName) {
      return '/trips/create/hotels';
    }

    if (!tripTemp.selectedActivities.length) {
      return '/trips/create/activities';
    }

    return '/trips/create/overview';
  }

  private applyEditDateValue(value: string, closeAfterValidSelection: boolean): void {
    if (!this.editTripForm) {
      return;
    }

    const activePicker = this.activeEditDatePicker();

    if (!activePicker) {
      return;
    }

    if (activePicker === 'endDate' && this.editTripForm.startDate && value < this.editTripForm.startDate) {
      this.editManualDateError.set('End date cannot be before start date.');
      return;
    }

    if (activePicker === 'startDate' && this.editTripForm.endDate && value > this.editTripForm.endDate) {
      this.editManualDateError.set('Start date cannot be after end date.');
      return;
    }

    this.setActiveEditDate(value);
    this.editManualDateText.set(value);
    this.editManualDateError.set('');

    if (closeAfterValidSelection) {
      this.closeEditDatePicker();
    }
  }

  private setActiveEditDate(value: string): void {
    const activePicker = this.activeEditDatePicker();

    if (!this.editTripForm || !activePicker) {
      return;
    }

    this.editTripForm = {
      ...this.editTripForm,
      [activePicker]: value,
    };
  }

  private syncEditDatePickerState(value: string): void {
    const parsed = this.parseDateInput(value);
    const selectedDate = parsed ?? new Date();

    this.editManualDateText.set(value);
    this.editManualDateError.set('');
    this.editDatePickerMonth.set(this.firstDayOfMonth(selectedDate));
  }

  private parseDateInput(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private firstDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private isSameDate(left: Date | null, right: Date | null): boolean {
    return Boolean(
      left &&
      right &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
    );
  }

  private formatDisplayDate(value: string): string {
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
}
