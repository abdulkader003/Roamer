import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { FriendCommunityService, FriendItem } from '../../../services/friend-community.service';
import { FriendNotificationService } from '../../../services/friend-notification.service';
import {
  CreateTripRequest,
  TripInvitationResponse,
  TripParticipantResponse,
  TripPlanningService,
  TripResponse,
} from '../../../services/trip-planning.service';
import { TripTemp, TripTempActivity, TripTempFlightSegment, TripTempHotelStay, TripTempService } from '../create/trip-temp.service';
import type { TripSummaryPdfSource } from '../create/overview/trip-summary-pdf.exporter';

interface TripEditForm {
  name: string;
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

interface SummaryDetailRow {
  label: string;
  value: string;
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
  private readonly friendCommunityService = inject(FriendCommunityService);
  private readonly friendNotificationService = inject(FriendNotificationService);
  private readonly tripTempService = inject(TripTempService);
  private readonly router = inject(Router);

  readonly trips = signal<TripResponse[]>([]);
  readonly incomingInvitations = signal<TripInvitationResponse[]>([]);
  readonly tripParticipants = signal<TripParticipantResponse[]>([]);
  readonly tripSentInvitations = signal<TripInvitationResponse[]>([]);
  readonly acceptedFriends = signal<FriendItem[]>([]);
  readonly isLoading = signal(false);
  readonly isInvitationsLoading = signal(false);
  readonly isParticipantsLoading = signal(false);
  readonly isSentInvitationsLoading = signal(false);
  readonly isFriendsLoading = signal(false);
  readonly loadError = signal('');
  readonly invitationError = signal('');
  readonly participantsError = signal('');
  readonly sentInvitationsError = signal('');
  readonly friendsError = signal('');
  readonly selectedTrip = signal<TripResponse | null>(null);
  readonly isEditing = signal(false);
  readonly isActionSaving = signal(false);
  readonly actionError = signal('');
  readonly isExportingPdf = signal(false);
  readonly isExportMenuOpen = signal(false);
  readonly isInviteDialogOpen = signal(false);
  readonly isInviting = signal(false);
  readonly inviteError = signal('');
  readonly inviteSuccess = signal('');
  readonly exportError = signal('');
  readonly showDeleteConfirm = signal(false);
  readonly activeEditDatePicker = signal<'startDate' | 'endDate' | null>(null);
  readonly editManualDateText = signal('');
  readonly editManualDateError = signal('');
  readonly editDatePickerMonth = signal(this.firstDayOfMonth(new Date()));
  editTripForm: TripEditForm | null = null;

  ngOnInit(): void {
    this.loadTrips();
    this.loadIncomingInvitations();
    this.loadAcceptedFriends();
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

  loadIncomingInvitations(): void {
    this.isInvitationsLoading.set(true);
    this.invitationError.set('');

    this.tripPlanningService.listIncomingTripInvitations().subscribe({
      next: (invitations) => {
        this.incomingInvitations.set(invitations);
        this.isInvitationsLoading.set(false);
      },
      error: () => {
        this.incomingInvitations.set([]);
        this.invitationError.set('Could not load trip invitations.');
        this.isInvitationsLoading.set(false);
      },
    });
  }

  loadAcceptedFriends(): void {
    this.isFriendsLoading.set(true);
    this.friendsError.set('');

    this.friendCommunityService.listFriends().subscribe({
      next: (friends) => {
        this.acceptedFriends.set(friends);
        this.isFriendsLoading.set(false);
      },
      error: () => {
        this.acceptedFriends.set([]);
        this.friendsError.set('Could not load your friends list.');
        this.isFriendsLoading.set(false);
      },
    });
  }

  private loadTripParticipants(tripId: number): void {
    this.isParticipantsLoading.set(true);
    this.participantsError.set('');

    this.tripPlanningService.listTripParticipants(tripId).subscribe({
      next: (participants) => {
        this.tripParticipants.set(participants);
        this.isParticipantsLoading.set(false);
      },
      error: () => {
        this.tripParticipants.set([]);
        this.participantsError.set('Could not load participants for this trip.');
        this.isParticipantsLoading.set(false);
      },
    });
  }

  private loadTripSentInvitations(tripId: number): void {
    this.isSentInvitationsLoading.set(true);
    this.sentInvitationsError.set('');

    this.tripPlanningService.listSentTripInvitations().subscribe({
      next: (invitations) => {
        this.tripSentInvitations.set(invitations.filter((invitation) => invitation.trip.id === tripId));
        this.isSentInvitationsLoading.set(false);
      },
      error: () => {
        this.tripSentInvitations.set([]);
        this.sentInvitationsError.set('Could not load sent invitations for this trip.');
        this.isSentInvitationsLoading.set(false);
      },
    });
  }

  private refreshTripNotifications(): void {
    this.friendNotificationService.refresh();
  }

  formatBudget(trip: TripResponse): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(trip.budget);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(value);
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
    this.isExportMenuOpen.set(false);
    this.exportError.set('');
    this.showDeleteConfirm.set(false);
    this.isInviteDialogOpen.set(false);
    this.inviteError.set('');
    this.inviteSuccess.set('');
    this.loadTripParticipants(trip.id);
    this.loadTripSentInvitations(trip.id);
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
    this.isExportMenuOpen.set(false);
    this.exportError.set('');
    this.showDeleteConfirm.set(false);
    this.isInviteDialogOpen.set(false);
    this.inviteError.set('');
    this.inviteSuccess.set('');
    this.isParticipantsLoading.set(false);
    this.isSentInvitationsLoading.set(false);
    this.tripParticipants.set([]);
    this.tripSentInvitations.set([]);
    this.participantsError.set('');
    this.sentInvitationsError.set('');
    this.closeEditDatePicker();
    this.editTripForm = null;
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

  openInviteDialog(): void {
    const trip = this.selectedTrip();

    if (!trip || !this.canInvite(trip) || this.isInviting()) {
      return;
    }

    this.inviteError.set('');
    this.inviteSuccess.set('');
    this.isInviteDialogOpen.set(true);

    if (!this.acceptedFriends().length && !this.isFriendsLoading()) {
      this.loadAcceptedFriends();
    }
  }

  closeInviteDialog(): void {
    if (this.isInviting()) {
      return;
    }

    this.isInviteDialogOpen.set(false);
    this.inviteError.set('');
    this.inviteSuccess.set('');
  }

  inviteFriend(friend: FriendItem): void {
    const trip = this.selectedTrip();

    if (!trip || !this.canInvite(trip) || this.isInviting()) {
      return;
    }

    this.isInviting.set(true);
    this.inviteError.set('');
    this.inviteSuccess.set('');

    this.tripPlanningService.inviteFriendToTrip(trip.id, { invitedUserId: friend.user.id }).subscribe({
      next: () => {
        this.inviteSuccess.set(`Invitation sent to ${this.friendLabel(friend)}.`);
        this.loadTripSentInvitations(trip.id);
        this.isInviting.set(false);
      },
      error: (error) => {
        this.inviteError.set(this.extractInviteError(error));
        this.isInviting.set(false);
      },
    });
  }

  tripActionLabel(trip: TripResponse): string {
    return trip.accessRole === 'PARTICIPANT' ? 'Leave Trip' : 'Delete Trip';
  }

  tripActionTitle(trip: TripResponse): string {
    return trip.accessRole === 'PARTICIPANT'
      ? 'Are you sure you want to leave this shared trip?'
      : 'Are you sure you want to delete this trip?';
  }

  acceptTripInvitation(invitation: TripInvitationResponse): void {
    this.tripPlanningService.acceptTripInvitation(invitation.id).subscribe({
      next: () => {
        this.loadIncomingInvitations();
        this.loadTrips();
        this.refreshTripNotifications();
      },
      error: () => {
        this.invitationError.set('Could not accept this trip invitation.');
      },
    });
  }

  declineTripInvitation(invitation: TripInvitationResponse): void {
    this.tripPlanningService.declineTripInvitation(invitation.id).subscribe({
      next: () => {
        this.loadIncomingInvitations();
        this.refreshTripNotifications();
      },
      error: () => {
        this.invitationError.set('Could not decline this trip invitation.');
      },
    });
  }

  async exportTripSummary(trip: TripResponse): Promise<void> {
    if (this.isExportingPdf()) {
      return;
    }

    this.isExportingPdf.set(true);
    this.isExportMenuOpen.set(false);
    this.exportError.set('');

    try {
      const { exportTripSummaryPdf } = await this.loadPdfExporter();
      await exportTripSummaryPdf(this.confirmedTripPdfSource(trip));
    } catch {
      this.exportError.set('Could not export your trip summary. Please try again.');
    } finally {
      this.isExportingPdf.set(false);
    }
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
    const nextTripTemp = this.tripTempService.updateTripTemp({
      draftTripId: trip.id,
      tripPlanningId: trip.tripPlanningId ?? existing?.tripPlanningId,
      tripName: trip.name,
      budget: trip.budget,
      currency: trip.currency || existing?.currency || 'EUR',
      durationNights: trip.durationNights ?? this.nightsFor(trip),
      travelStyle: trip.travelStyle || existing?.travelStyle || 'Mid-range',
      origin: trip.origin || existing?.origin || '',
      destination: trip.destination || existing?.destination || '',
      destinationCities: this.destinationCitiesFor(trip, existing ?? this.tripTempService.getTripTemp(), Boolean(existing)),
      departureDate: trip.startDate,
      returnDate: trip.endDate,
      travelers: trip.travelers || existing?.travelers || 2,
      ...this.flightTempFromTrip(trip, existing),
      ...this.hotelTempFromTrip(trip, existing),
      ...this.activitiesTempFromTrip(trip, existing),
    });

    void this.router.navigate(['/trips/create/budget'], { queryParams: this.wizardQueryParams(nextTripTemp) });
  }

  private flightTempFromTrip(trip: TripResponse, existing: TripTemp | null): Partial<TripTemp> {
    if (existing?.selectedFlightId) {
      return {};
    }

    const selectedFlightSegments = this.flightSegmentsFor(trip);
    const title = (trip.flightTitle ?? '').trim();
    const total = Number(trip.flightTotal ?? 0);

    if ((!title || title === 'Flight not selected') && total <= 0 && !selectedFlightSegments.length) {
      return {};
    }

    const [airline, flightNumber] = title.split('·').map((part) => part.trim());
    const details = (trip.flightDetails ?? '').split('·').map((part) => part.trim());
    const [departureTime, arrivalTime] = (details[0] ?? '').split('→').map((part) => part.trim());

    return {
      selectedFlightId: trip.flightId || selectedFlightSegments.map((segment) => segment.flightNumber).filter(Boolean).join('|') || `restored-${trip.id}`,
      selectedFlightAirline: airline || '',
      selectedFlightNumber: flightNumber || '',
      selectedFlightDepartureTime: departureTime || '',
      selectedFlightArrivalTime: arrivalTime || '',
      selectedFlightDuration: details[1] || '',
      selectedFlightStops: details[2] || '',
      selectedFlightTotal: total,
      selectedFlightSegments,
    };
  }

  private hotelTempFromTrip(trip: TripResponse, existing: TripTemp | null): Partial<TripTemp> {
    if (existing?.selectedHotelName) {
      return {};
    }

    const selectedHotels = this.hotelStaysFor(trip);
    const name = (trip.hotelName ?? '').trim();
    const total = Number(trip.hotelTotal ?? 0);

    if ((!name || name === 'Hotel not selected') && total <= 0 && !selectedHotels.length) {
      return {};
    }

    const details = (trip.hotelDetails ?? '').split('·').map((part) => part.trim());
    const firstStay = selectedHotels[0];
    const city = trip.hotelCity || firstStay?.city || details[0] || this.cityOnly(trip.destination);
    const starsMatch = (trip.hotelDetails ?? '').match(/(\d+(?:\.\d+)?)\s*stars?/i);

    return {
      selectedHotelName: name || firstStay?.hotelName || '',
      selectedHotelCity: city,
      selectedHotelStars: trip.hotelStars ?? firstStay?.stars ?? (starsMatch ? Number(starsMatch[1]) : 0),
      selectedHotelTotal: total,
      selectedHotels,
    };
  }

  private activitiesTempFromTrip(trip: TripResponse, existing: TripTemp | null): Partial<TripTemp> {
    if (existing?.selectedActivities?.length) {
      return {};
    }

    const total = Number(trip.activitiesTotal ?? 0);
    const savedActivities = this.activitiesFor(trip, this.tripTempService.getTripTemp(), false);
    const names = (trip.activitiesDetails ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (!savedActivities.length && !names.length && total <= 0) {
      return {};
    }

    if (savedActivities.length) {
      return {
        selectedActivities: savedActivities,
        selectedActivitiesTotal: total,
      };
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
    if (this.isActionSaving()) {
      return;
    }

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

    if (trip.accessRole === 'PARTICIPANT') {
      this.tripPlanningService.leaveTrip(trip.id).subscribe({
        next: () => {
          this.trips.update((trips) => trips.filter((savedTrip) => savedTrip.id !== trip.id));
          this.isActionSaving.set(false);
          this.closeTripModal();
        },
        error: () => {
          this.actionError.set('Could not leave this trip. Please try again.');
          this.isActionSaving.set(false);
        },
      });
      return;
    }

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

  formatDateRange(trip: { startDate: string; endDate: string }): string {
    return `${this.formatDisplayDate(trip.startDate)} → ${this.formatDisplayDate(trip.endDate)}`;
  }

  modalDestinationName(trip: TripResponse): string {
    return trip.destination || this.matchingTripTemp(trip)?.destination || 'Destination';
  }

  modalRouteSummary(trip: TripResponse): string {
    const segments = this.modalFlightSegments(trip);

    if (segments.length > 1) {
      const routeCities = [
        this.cityOnly(segments[0].from),
        ...segments.map((segment) => this.cityOnly(segment.to)),
      ].filter(Boolean);

      return routeCities.filter((city, index) => city !== routeCities[index - 1]).join(' → ');
    }

    return this.modalDestinationName(trip);
  }

  modalTravelerLabel(trip: TripResponse): string {
    const travelers = this.travelerCountFor(trip);
    return `${travelers} traveler${travelers === 1 ? '' : 's'}`;
  }

  tripAccessLabel(trip: TripResponse): string {
    return trip.accessRole === 'PARTICIPANT' ? 'Shared with you' : 'Owned by you';
  }

  tripAccessHint(trip: TripResponse): string {
    return trip.accessRole === 'PARTICIPANT'
      ? 'Shared trip. You can edit it or leave it.'
      : 'Owned trip. You can edit it, invite friends, or delete it.';
  }

  modalFlightTotal(trip: TripResponse): number {
    return Number(trip.flightTotal ?? this.matchingTripTemp(trip)?.selectedFlightTotal ?? 0);
  }

  modalFlightSegments(trip: TripResponse): TripTempFlightSegment[] {
    const savedSegments = this.flightSegmentsFor(trip);

    if (savedSegments.length) {
      return savedSegments;
    }

    if (!this.modalHasFlightData(trip)) {
      return [];
    }

    const tripTemp = this.matchingTripTemp(trip);
    const details = (trip.flightDetails || [
      tripTemp?.selectedFlightDepartureTime && tripTemp?.selectedFlightArrivalTime
        ? `${tripTemp.selectedFlightDepartureTime} → ${tripTemp.selectedFlightArrivalTime}`
        : '',
      tripTemp?.selectedFlightDuration,
      tripTemp?.selectedFlightStops,
    ].filter(Boolean).join(' · ')).split('·').map((part) => part.trim());
    const [departureTime, arrivalTime] = (details[0] ?? '').split('→').map((part) => part.trim());

    return [{
      label: 'Flight',
      airline: trip.flightAirline || tripTemp?.selectedFlightAirline || trip.flightTitle || 'Airline not selected',
      flightNumber: trip.flightNumber || trip.flightId || '',
      from: trip.origin || 'Origin',
      to: trip.destination || 'Destination',
      date: trip.startDate,
      departureTime: departureTime || trip.flightDepartureTime || '',
      arrivalTime: arrivalTime || trip.flightArrivalTime || '',
      duration: trip.flightDuration || details[1] || '',
      stops: trip.flightStops || details[2] || '',
      price: this.modalFlightTotal(trip),
    }];
  }

  modalFlightDetailRows(segment: TripTempFlightSegment): SummaryDetailRow[] {
    return [
      { label: 'Airline', value: segment.airline },
      { label: 'Flight', value: segment.flightNumber },
      { label: 'Date', value: this.formatDisplayDate(segment.date) },
      { label: 'Departure', value: segment.departureTime },
      { label: 'Arrival', value: segment.arrivalTime },
      { label: 'Duration', value: segment.duration },
      { label: 'Stops', value: segment.stops },
      { label: 'Price', value: segment.price ? `€${this.formatNumber(segment.price)}` : '' },
    ].filter((row) => row.value);
  }

  modalHotelName(trip: TripResponse): string {
    return trip.hotelName || this.matchingTripTemp(trip)?.selectedHotelName || 'Hotel not selected';
  }

  modalHotelTotal(trip: TripResponse): number {
    const stays = this.hotelStaysFor(trip);

    if (stays.length) {
      return stays.reduce((total, stay) => total + Number(stay.price || 0), 0);
    }

    return Number(trip.hotelTotal ?? this.matchingTripTemp(trip)?.selectedHotelTotal ?? 0);
  }

  modalHotelGroups(trip: TripResponse): Array<{ city: string; stays: TripTempHotelStay[] }> {
    const groups = new Map<string, TripTempHotelStay[]>();

    this.hotelStaysFor(trip).forEach((stay) => {
      groups.set(stay.city, [...(groups.get(stay.city) ?? []), stay]);
    });

    return Array.from(groups.entries()).map(([city, stays]) => ({ city, stays }));
  }

  modalHotelDetailRows(stay: TripTempHotelStay): SummaryDetailRow[] {
    return [
      { label: 'City', value: stay.city },
      { label: 'Check-in', value: this.formatDisplayDate(stay.checkIn) },
      { label: 'Check-out', value: this.formatDisplayDate(stay.checkOut) },
      { label: 'Nights', value: String(stay.nights) },
      { label: 'Rating', value: stay.stars ? `${stay.stars} stars` : '' },
    ].filter((row) => row.value);
  }

  modalActivitiesTotal(trip: TripResponse): number {
    const activities = this.modalActivities(trip);

    if (activities.length) {
      return activities.reduce((total, activity) => total + this.modalActivityTotal(trip, activity), 0);
    }

    return Number(trip.activitiesTotal ?? this.matchingTripTemp(trip)?.selectedActivitiesTotal ?? 0);
  }

  modalActivities(trip: TripResponse): TripTempActivity[] {
    const parsedActivities = this.parseJsonArray<TripTempActivity>(trip.activitiesJson);

    if (parsedActivities.length) {
      return parsedActivities;
    }

    const tripTempActivities = this.matchingTripTemp(trip)?.selectedActivities ?? [];

    if (tripTempActivities.length) {
      return tripTempActivities;
    }

    return this.activitiesTempFromTrip(trip, null).selectedActivities ?? [];
  }

  modalActivityGroups(trip: TripResponse): Array<{ city: string; activities: TripTempActivity[] }> {
    const groups = new Map<string, TripTempActivity[]>();

    this.modalActivities(trip).forEach((activity) => {
      const city = activity.city || this.cityOnly(trip.destination) || 'Destination';
      groups.set(city, [...(groups.get(city) ?? []), activity]);
    });

    return Array.from(groups.entries()).map(([city, activities]) => ({ city, activities }));
  }

  modalActivityTotal(trip: TripResponse, activity: TripTempActivity): number {
    return Math.round(Number(activity.price || 0) * this.travelerCountFor(trip));
  }

  modalActivityDetailRows(activity: TripTempActivity): SummaryDetailRow[] {
    return [
      { label: 'City', value: activity.city },
      { label: 'Date', value: activity.date ?? '' },
      { label: 'Time', value: activity.time ?? '' },
    ].filter((row) => row.value);
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
    return hasDbTitle || hasDbCost || Boolean(trip.flightSegmentsJson) || Boolean(tripTemp?.selectedFlightId);
  }

  modalHasHotelData(trip: TripResponse): boolean {
    const hasDbName = Boolean(trip.hotelName) && trip.hotelName !== 'Hotel not selected';
    const hasDbCost = Number(trip.hotelTotal ?? 0) > 0;
    const tripTemp = this.matchingTripTemp(trip);
    return hasDbName || hasDbCost || Boolean(trip.hotelStaysJson) || Boolean(tripTemp?.selectedHotelName);
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

    if (!form || !form.name.trim() || !form.startDate || !form.endDate) {
      return null;
    }

    const request: CreateTripRequest = {
      name: form.name.trim(),
      destination: trip.destination,
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
    this.addIfPresent(request, 'flightSegmentsJson', trip.flightSegmentsJson);
    this.addIfPresent(request, 'hotelName', trip.hotelName);
    this.addIfPresent(request, 'hotelCity', trip.hotelCity);
    this.addIfPresent(request, 'hotelStars', trip.hotelStars);
    this.addIfPresent(request, 'hotelDetails', trip.hotelDetails);
    this.addIfPresent(request, 'hotelTotal', trip.hotelTotal);
    this.addIfPresent(request, 'hotelStaysJson', trip.hotelStaysJson);
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

  cityOnly(value: string): string {
    return value.replace(/\s*\([A-Za-z]{3}\)\s*$/, '').trim();
  }

  private loadPdfExporter(): Promise<typeof import('../create/overview/trip-summary-pdf.exporter')> {
    return import('../create/overview/trip-summary-pdf.exporter');
  }

  private confirmedTripPdfSource(trip: TripResponse): TripSummaryPdfSource {
    return {
      tripName: () => trip.name,
      tripTypeLabel: () => this.tripTypeLabelFor(trip),
      tripRouteSummary: () => this.modalRouteSummary(trip),
      dateRange: () => this.formatDateRange(trip),
      nights: () => this.nightsFor(trip),
      travelerLabel: () => this.modalTravelerLabel(trip),
      currencySymbol: () => this.currencySymbolFor(trip),
      budget: () => Number(trip.budget || 0),
      flightTotal: () => this.modalFlightTotal(trip),
      hotelTotal: () => this.modalHotelTotal(trip),
      activitiesTotal: () => this.modalActivitiesTotal(trip),
      totalUsed: () => this.modalTotalUsed(trip),
      remaining: () => this.modalRemaining(trip),
      flightSegments: () => this.modalFlightSegments(trip),
      hotelStays: () => this.hotelStaysFor(trip),
      activityGroups: () => this.modalActivityGroups(trip),
      activityTotal: (activity) => this.modalActivityTotal(trip, activity as TripTempActivity),
      cityOnly: (value) => this.cityOnly(value),
      formatDisplayDate: (value) => this.formatDisplayDate(value),
    };
  }

  private tripTypeLabelFor(trip: TripResponse): string {
    if (this.modalFlightSegments(trip).length > 1) {
      return 'Multi-City';
    }

    return trip.startDate !== trip.endDate ? 'Round Trip' : 'One Way';
  }

  private currencySymbolFor(trip: TripResponse): string {
    return trip.currency === 'USD' ? '$' : '€';
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

  private flightSegmentsFor(trip: TripResponse): TripTempFlightSegment[] {
    const savedSegments = this.parseJsonArray<TripTempFlightSegment>(trip.flightSegmentsJson);

    if (savedSegments.length) {
      return savedSegments;
    }

    return this.matchingTripTemp(trip)?.selectedFlightSegments ?? [];
  }

  private hotelStaysFor(trip: TripResponse): TripTempHotelStay[] {
    const savedStays = this.parseJsonArray<TripTempHotelStay>(trip.hotelStaysJson);

    if (savedStays.length) {
      return savedStays;
    }

    const tripTemp = this.matchingTripTemp(trip);
    const tripTempStays = tripTemp?.selectedHotels ?? [];

    if (tripTempStays.length) {
      return tripTempStays;
    }

    if (!this.modalHasHotelData(trip)) {
      return [];
    }

    return [{
      hotelName: this.modalHotelName(trip),
      city: trip.hotelCity || tripTemp?.selectedHotelCity || this.cityOnly(trip.destination) || 'Destination',
      checkIn: trip.startDate,
      checkOut: trip.endDate,
      nights: this.nightsFor(trip),
      stars: trip.hotelStars ?? tripTemp?.selectedHotelStars ?? null,
      price: Number(trip.hotelTotal ?? tripTemp?.selectedHotelTotal ?? 0),
    }];
  }

  private travelerCountFor(trip: TripResponse): number {
    return Math.max(Number(trip.travelers ?? this.matchingTripTemp(trip)?.travelers ?? 1) || 1, 1);
  }

  friendLabel(friend: FriendItem): string {
    const fullName = `${friend.user.firstName ?? ''} ${friend.user.lastName ?? ''}`.trim();
    return fullName || friend.user.username;
  }

  userLabel(user: { username: string; firstName?: string | null; lastName?: string | null }): string {
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return fullName || user.username;
  }

  invitationNights(invitation: TripInvitationResponse): number {
    const start = new Date(`${invitation.trip.startDate}T00:00:00`);
    const end = new Date(`${invitation.trip.endDate}T00:00:00`);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  }

  canInvite(trip: TripResponse | null): boolean {
    return Boolean(trip && trip.accessRole !== 'PARTICIPANT');
  }

  isSharedTrip(trip: TripResponse): boolean {
    return trip.accessRole === 'PARTICIPANT';
  }

  participantRoleLabel(role: TripParticipantResponse['role']): string {
    return role === 'OWNER' ? 'Owner' : 'Participant';
  }

  participantDisplayName(participant: TripParticipantResponse): string {
    return this.userLabel(participant.user);
  }

  inviteSummaryLabel(invitation: TripInvitationResponse): string {
    return this.userLabel(invitation.invitedUser);
  }

  pendingSentInvitations(trip: TripResponse | null): TripInvitationResponse[] {
    if (!trip) {
      return [];
    }

    return this.tripSentInvitations().filter((invitation) => invitation.trip.id === trip.id && invitation.status === 'PENDING');
  }

  cancelTripInvitation(invitation: TripInvitationResponse): void {
    if (this.isActionSaving()) {
      return;
    }

    this.isActionSaving.set(true);
    this.sentInvitationsError.set('');

    this.tripPlanningService.cancelTripInvitation(invitation.id).subscribe({
      next: () => {
        const trip = this.selectedTrip();
        if (trip) {
          this.loadTripSentInvitations(trip.id);
        }
        this.refreshTripNotifications();
        this.isActionSaving.set(false);
      },
      error: () => {
        this.sentInvitationsError.set('Could not cancel this invitation.');
        this.isActionSaving.set(false);
      },
    });
  }

  private extractInviteError(error: unknown): string {
    if (typeof error === 'object' && error && 'error' in error) {
      const body = (error as { error?: { message?: string } }).error;
      if (body?.message) {
        return body.message;
      }
    }

    return 'Could not send this invitation.';
  }

  private wizardQueryParams(tripTemp: TripTemp): Record<string, string | number> | undefined {
    const queryParams: Record<string, string | number> = {};

    if (tripTemp.tripPlanningId) {
      queryParams['tripPlanningId'] = tripTemp.tripPlanningId;
    }

    const segments = tripTemp.selectedFlightSegments ?? [];

    if (segments.length > 1) {
      queryParams['tripType'] = 'multi-city';
      queryParams['multiCitySegments'] = JSON.stringify(segments.map((segment) => ({
        fromText: segment.from,
        toText: segment.to,
        date: segment.date,
      })));
    } else if (tripTemp.returnDate) {
      queryParams['tripType'] = 'round-trip';
    }

    return Object.keys(queryParams).length ? queryParams : undefined;
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

  formatDisplayDate(value: string): string {
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
