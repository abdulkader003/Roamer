import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { Airport, Flight, MultiCitySegment, SearchParams, TripType } from '../../../flights/flight.model';
import { FlightsService } from '../../../flights/flights.service';
import { TripTempService } from '../trip-temp.service';

interface WizardStep {
  number: number;
  label: string;
  state: 'complete' | 'active' | 'pending';
  route: string;
}

interface SegmentFlights {
  segmentIndex: number;
  fromText: string;
  toText: string;
  date: string;
  flights: Flight[];
}

@Component({
  selector: 'app-trip-flights',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './trip-flights.component.html',
  styleUrl: './trip-flights.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripFlightsComponent implements OnInit {
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly flightsService = inject(FlightsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripTempService = inject(TripTempService);

  readonly steps: WizardStep[] = [
    { number: 1, label: 'Budget', state: 'complete', route: '/trips/create/budget' },
    { number: 2, label: 'Destination', state: 'complete', route: '/trips/create/destination' },
    { number: 3, label: 'Flights', state: 'active', route: '/trips/create/flights' },
    { number: 4, label: 'Hotels', state: 'pending', route: '/trips/create/hotels' },
    { number: 5, label: 'Activities', state: 'pending', route: '/trips/create/activities' },
    { number: 6, label: 'Overview', state: 'pending', route: '/trips/create/overview' },
  ];

  readonly tripTemp = this.tripTempService.getTripTemp();
  readonly knownAirports: Airport[] = [
    { code: 'DUS', city: 'Dusseldorf', fullName: 'Dusseldorf Airport' },
    { code: 'FRA', city: 'Frankfurt', fullName: 'Frankfurt Airport' },
    { code: 'MXP', city: 'Milan', fullName: 'Milan Malpensa' },
    { code: 'LIN', city: 'Milan', fullName: 'Milan Linate' },
    { code: 'BCN', city: 'Barcelona', fullName: 'Barcelona-El Prat' },
    { code: 'CDG', city: 'Paris', fullName: 'Charles de Gaulle' },
    { code: 'FCO', city: 'Rome', fullName: 'Fiumicino' },
    { code: 'AMS', city: 'Amsterdam', fullName: 'Amsterdam Schiphol' },
    { code: 'LIS', city: 'Lisbon', fullName: 'Humberto Delgado' },
    { code: 'PRG', city: 'Prague', fullName: 'Vaclav Havel Airport' },
    { code: 'VIE', city: 'Vienna', fullName: 'Vienna Intl.' },
  ];

  isLoading = false;
  searchError = '';
  selectedFlightId = this.tripTemp.selectedFlightId.split('|')[0] ?? '';
  selectedReturnFlightId = this.tripTemp.selectedFlightId.split('|')[1] ?? '';
  expandedFlightId = '';
  expandedReturnFlightId = '';
  expandedSegmentFlightId = '';
  flights: Flight[] = [];
  returnFlights: Flight[] = [];
  segmentFlights: SegmentFlights[] = [];
  selectedSegmentFlightIds: Record<number, string> = this.segmentSelectionFromTripTemp();

  ngOnInit(): void {
    this.searchFlights();
  }

  stepQueryParams(): Record<string, string | number> {
    const tripPlanningId = this.route.snapshot.queryParamMap.get('tripPlanningId')
      ?? this.tripTemp.tripPlanningId;

    return tripPlanningId
      ? { ...this.route.snapshot.queryParams, tripPlanningId }
      : this.route.snapshot.queryParams;
  }

  retrySearch(): void {
    this.searchFlights();
  }

  selectFlight(flight: Flight): void {
    this.selectedFlightId = flight.id;
    this.expandedFlightId = this.expandedFlightId === flight.id ? '' : flight.id;

    // Keep the wizard choice available for the following steps.
    this.saveFlightSelection();
  }

  selectReturnFlight(flight: Flight): void {
    this.selectedReturnFlightId = flight.id;
    this.expandedReturnFlightId = this.expandedReturnFlightId === flight.id ? '' : flight.id;

    // Round trips are saved as one combined flight choice for the overview.
    this.saveFlightSelection();
  }

  selectSegmentFlight(segmentIndex: number, flight: Flight): void {
    this.selectedSegmentFlightIds = {
      ...this.selectedSegmentFlightIds,
      [segmentIndex]: flight.id,
    };
    this.expandedSegmentFlightId = this.expandedSegmentFlightId === flight.id ? '' : flight.id;
    this.saveFlightSelection();
  }

  isFlightExpanded(flight: Flight): boolean {
    return this.expandedFlightId === flight.id;
  }

  isReturnFlightExpanded(flight: Flight): boolean {
    return this.expandedReturnFlightId === flight.id;
  }

  isSegmentFlightExpanded(flight: Flight): boolean {
    return this.expandedSegmentFlightId === flight.id;
  }

  baggageSummary(flight: Flight): string {
    const carryOn = flight.carryOnIncluded
      ? `Carry-on ${flight.carryOnWeightKg} kg included`
      : 'Carry-on not included';
    const checkedBag = flight.checkedBagIncluded
      ? `Checked bag ${flight.checkedBagWeightKg ?? 23} kg included`
      : 'Checked bag not included';

    return `${carryOn} · ${checkedBag}`;
  }

  flightStatus(flight: Flight): string {
    return flight.status || 'Scheduled';
  }

  isRoundTrip(): boolean {
    return this.tripType() === 'round-trip';
  }

  isMultiCity(): boolean {
    return this.tripType() === 'multi-city';
  }

  private saveFlightSelection(): void {
    if (this.isMultiCity()) {
      this.saveMultiCityFlightSelection();
      return;
    }

    const outboundFlight = this.selectedOutboundFlight();
    const returnFlight = this.selectedReturnFlight();

    if (!outboundFlight) {
      return;
    }

    this.tripTempService.updateTripTemp({
      selectedFlightId: returnFlight ? `${outboundFlight.id}|${returnFlight.id}` : outboundFlight.id,
      selectedFlightAirline: returnFlight
        ? `${outboundFlight.airline.name} + ${returnFlight.airline.name}`
        : outboundFlight.airline.name,
      selectedFlightNumber: returnFlight
        ? `${outboundFlight.flightNumber || outboundFlight.id} / ${returnFlight.flightNumber || returnFlight.id}`
        : outboundFlight.flightNumber || outboundFlight.id,
      selectedFlightDepartureTime: outboundFlight.departure.time,
      selectedFlightArrivalTime: returnFlight?.arrival.time ?? outboundFlight.arrival.time,
      selectedFlightDuration: returnFlight
        ? `Outbound ${outboundFlight.duration} · Return ${returnFlight.duration}`
        : outboundFlight.duration,
      selectedFlightStops: returnFlight
        ? `${this.stopsLabel(outboundFlight)} outbound · ${this.stopsLabel(returnFlight)} return`
        : this.stopsLabel(outboundFlight),
      selectedFlightTotal: this.totalPrice(outboundFlight) + (returnFlight ? this.totalPrice(returnFlight) : 0),
      selectedFlightSegments: [
        this.toFlightSegmentSnapshot('Outbound', this.tripTemp.origin, this.tripTemp.destination, this.tripTemp.departureDate, outboundFlight),
        ...(returnFlight
          ? [this.toFlightSegmentSnapshot('Return', this.tripTemp.destination, this.tripTemp.origin, this.tripTemp.returnDate, returnFlight)]
          : []),
      ],
    });
  }

  continueToHotels(): void {
    if (this.isMultiCity() && !this.allSegmentsSelected()) {
      this.searchError = 'Choose one flight for each multi-city segment to continue.';
      return;
    }

    if (!this.isMultiCity() && (!this.selectedFlightId || (this.isRoundTrip() && !this.selectedReturnFlightId))) {
      this.searchError = this.isRoundTrip()
        ? 'Choose both an outbound and a return flight to continue.'
        : 'Choose a flight to continue.';
      return;
    }

    void this.router.navigate(['/trips/create/hotels'], {
      queryParams: this.stepQueryParams(),
    });
  }

  routeSummary(): string {
    if (this.isMultiCity()) {
      const segments = this.multiCitySegmentsFromQuery();
      const first = segments[0];
      const last = segments[segments.length - 1];
      const route = first && last
        ? `${this.cityOnly(first.fromText)} → ${this.cityOnly(last.toText)}`
        : 'Multi-city route';

      return `${route} · ${segments.length} segments · ${this.tripTemp.travelers} traveler${this.tripTemp.travelers === 1 ? '' : 's'}`;
    }

    const origin = this.cityOnly(this.tripTemp.origin) || 'Origin';
    const destination = this.cityOnly(this.tripTemp.destination) || 'Destination';
    const date = this.tripTemp.departureDate || 'Date';
    const returnDate = this.isRoundTrip() && this.tripTemp.returnDate ? ` → ${this.tripTemp.returnDate}` : '';
    return `${origin} → ${destination}${returnDate} · ${date} · ${this.tripTemp.travelers} traveler${this.tripTemp.travelers === 1 ? '' : 's'}`;
  }

  totalPrice(flight: Flight): number {
    return flight.price * this.tripTemp.travelers;
  }

  stopsLabel(flight: Flight): string {
    return flight.stops === 0 ? 'Direct' : flight.stopDetails ?? `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`;
  }

  private searchFlights(): void {
    const searchParams = this.buildSearchParams();

    if (searchParams.tripType === 'multi-city' && !searchParams.multiCitySegments?.length) {
      this.searchError = 'Go back and complete each multi-city origin, destination, and date first.';
      return;
    }

    if (
      searchParams.tripType !== 'multi-city' &&
      (!searchParams.departureDate ||
        !searchParams.from.code ||
        !searchParams.to.code ||
        (searchParams.tripType === 'round-trip' && !searchParams.returnDate))
    ) {
      this.searchError = searchParams.tripType === 'round-trip'
        ? 'Go back and complete your origin, destination, departure date, and return date first.'
        : 'Go back and complete your origin, destination, and departure date first.';
      return;
    }

    this.isLoading = true;
    this.searchError = '';

    this.flightsService.search(searchParams)
      .pipe(
        timeout({
          first: 15000,
          with: () => {
            throw new Error('Flight search took too long. Please try again in a moment.');
          },
        }),
        finalize(() => {
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.flights = response.outboundFlights?.length ? response.outboundFlights : response.flights;
          this.returnFlights = this.isRoundTrip() ? response.returnFlights ?? [] : [];
          this.segmentFlights = this.isMultiCity() ? response.segmentFlights ?? [] : [];
          this.searchError = this.hasFlightResults() ? '' : 'No matching flights found for this route.';

          if (!this.isMultiCity() && !this.selectedFlightId && this.flights.length) {
            this.selectedFlightId = this.flights[0].id;
          }

          if (this.isRoundTrip() && !this.selectedReturnFlightId && this.returnFlights.length) {
            this.selectedReturnFlightId = this.returnFlights[0].id;
          }

          if (this.isMultiCity()) {
            const savedSegmentFlightIds = this.segmentSelectionFromTripTemp();
            this.selectedSegmentFlightIds = this.segmentFlights.reduce<Record<number, string>>((selected, segment) => ({
              ...selected,
              [segment.segmentIndex]:
                this.selectedSegmentFlightIds[segment.segmentIndex]
                || savedSegmentFlightIds[segment.segmentIndex]
                || segment.flights[0]?.id
                || '',
            }), {});
          }

          this.saveFlightSelection();
        },
        error: (error) => {
          this.searchError = error?.error?.detail ?? error?.message ?? 'Flight search failed. Please try again.';
          this.flights = [];
          this.returnFlights = [];
          this.segmentFlights = [];
        },
      });
  }

  private buildSearchParams(): SearchParams {
    const tripType = this.tripType();

    return {
      tripType,
      from: this.parseAirportText(this.tripTemp.origin),
      to: this.parseAirportText(this.tripTemp.destination),
      departureDate: this.parseDateInput(this.tripTemp.departureDate),
      returnDate: tripType === 'round-trip' ? this.parseDateInput(this.tripTemp.returnDate) : null,
      multiCitySegments: tripType === 'multi-city' ? this.multiCitySegmentsFromQuery() : undefined,
      includeCityAirports: false,
      travelers: this.tripTemp.travelers,
      adults: this.tripTemp.travelers,
      children: 0,
      cabinClass: 'economy',
    };
  }

  private tripType(): TripType {
    const routeTripType = this.route.snapshot.queryParamMap.get('tripType');

    if (routeTripType === 'round-trip' || routeTripType === 'multi-city') {
      return routeTripType;
    }

    return this.tripTemp.returnDate ? 'round-trip' : 'one-way';
  }

  private selectedOutboundFlight(): Flight | undefined {
    return this.flights.find((flight) => flight.id === this.selectedFlightId);
  }

  private selectedReturnFlight(): Flight | undefined {
    return this.returnFlights.find((flight) => flight.id === this.selectedReturnFlightId);
  }

  private saveMultiCityFlightSelection(): void {
    const selectedFlights = this.selectedSegmentFlights();

    if (!selectedFlights.length) {
      return;
    }

    const firstFlight = selectedFlights[0];
    const lastFlight = selectedFlights[selectedFlights.length - 1];

    this.tripTempService.updateTripTemp({
      selectedFlightId: selectedFlights.map((flight) => flight.id).join('|'),
      selectedFlightAirline: selectedFlights.map((flight) => flight.airline.name).join(' + '),
      selectedFlightNumber: selectedFlights.map((flight) => flight.flightNumber || flight.id).join(' / '),
      selectedFlightDepartureTime: firstFlight.departure.time,
      selectedFlightArrivalTime: lastFlight.arrival.time,
      selectedFlightDuration: selectedFlights
        .map((flight, index) => `Segment ${index + 1} ${flight.duration}`)
        .join(' · '),
      selectedFlightStops: selectedFlights
        .map((flight, index) => `Segment ${index + 1} ${this.stopsLabel(flight)}`)
        .join(' · '),
      selectedFlightTotal: selectedFlights.reduce((total, flight) => total + this.totalPrice(flight), 0),
      selectedFlightSegments: selectedFlights.map((flight, index) => {
        const segment = this.segmentFlights[index];
        return this.toFlightSegmentSnapshot(
          `Segment ${index + 1}`,
          segment?.fromText ?? flight.departure.city,
          segment?.toText ?? flight.arrival.city,
          segment?.date ?? '',
          flight,
        );
      }),
    });
  }

  private selectedSegmentFlights(): Flight[] {
    return this.segmentFlights
      .map((segment) => segment.flights.find((flight) => flight.id === this.selectedSegmentFlightIds[segment.segmentIndex]))
      .filter((flight): flight is Flight => !!flight);
  }

  private segmentSelectionFromTripTemp(): Record<number, string> {
    return this.tripTemp.selectedFlightId
      .split('|')
      .map((flightId) => flightId.trim())
      .filter(Boolean)
      .reduce<Record<number, string>>((selected, flightId, index) => ({
        ...selected,
        [index]: flightId,
      }), {});
  }

  private toFlightSegmentSnapshot(label: string, from: string, to: string, date: string, flight: Flight) {
    return {
      label,
      airline: flight.airline.name,
      flightNumber: flight.flightNumber || flight.id,
      from: from || `${flight.departure.city} (${flight.departure.airport})`,
      to: to || `${flight.arrival.city} (${flight.arrival.airport})`,
      date,
      departureTime: flight.departure.time,
      arrivalTime: flight.arrival.time,
      duration: flight.duration,
      stops: this.stopsLabel(flight),
      price: this.totalPrice(flight),
    };
  }

  allSegmentsSelected(): boolean {
    return this.segmentFlights.length > 0
      && this.segmentFlights.every((segment) => !!this.selectedSegmentFlightIds[segment.segmentIndex]);
  }

  private hasFlightResults(): boolean {
    return this.isMultiCity()
      ? this.segmentFlights.some((segment) => segment.flights.length > 0)
      : this.flights.length > 0;
  }

  private multiCitySegmentsFromQuery(): MultiCitySegment[] {
    const rawSegments = this.route.snapshot.queryParamMap.get('multiCitySegments');

    if (!rawSegments) {
      return [];
    }

    try {
      const segments = JSON.parse(rawSegments) as Array<{ fromText: string; toText: string; date: string }>;

      return segments.map((segment) => ({
        fromText: segment.fromText,
        toText: segment.toText,
        date: this.parseDateInput(segment.date),
      }));
    } catch {
      return [];
    }
  }

  private parseAirportText(value: string): Airport {
    const trimmed = value.trim();
    const code = trimmed.match(/\(([A-Za-z]{3})\)$/)?.[1].toUpperCase() ?? '';
    const city = code ? trimmed.replace(/\s*\([A-Za-z]{3}\)$/, '') : trimmed;
    const knownAirport = this.knownAirports.find((airport) => (
      airport.code.toLowerCase() === trimmed.toLowerCase()
      || airport.city.toLowerCase() === city.toLowerCase()
      || airport.fullName.toLowerCase() === trimmed.toLowerCase()
    ));

    return {
      code: code || knownAirport?.code || '',
      city: knownAirport?.city || city,
      fullName: knownAirport?.fullName || city,
    };
  }

  private parseDateInput(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private cityOnly(value: string): string {
    return value.replace(/\s*\([A-Za-z]{3}\)$/, '').trim();
  }
}
