import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { Airport, Flight, SearchParams, TripType } from '../../../flights/flight.model';
import { FlightsService } from '../../../flights/flights.service';
import { TripTempService } from '../trip-temp.service';

interface WizardStep {
  number: number;
  label: string;
  state: 'complete' | 'active' | 'pending';
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
  private readonly router = inject(Router);
  private readonly tripTempService = inject(TripTempService);

  readonly steps: WizardStep[] = [
    { number: 1, label: 'Budget', state: 'complete' },
    { number: 2, label: 'Destination', state: 'complete' },
    { number: 3, label: 'Flights', state: 'active' },
    { number: 4, label: 'Hotels', state: 'pending' },
    { number: 5, label: 'Activities', state: 'pending' },
    { number: 6, label: 'Overview', state: 'pending' },
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
  selectedFlightId = this.tripTemp.selectedFlightId;
  expandedFlightId = '';
  flights: Flight[] = [];

  ngOnInit(): void {
    this.searchFlights();
  }

  retrySearch(): void {
    this.searchFlights();
  }

  selectFlight(flight: Flight): void {
    this.selectedFlightId = flight.id;
    this.expandedFlightId = this.expandedFlightId === flight.id ? '' : flight.id;

    // Keep the wizard choice available for the following steps.
    this.saveFlightSelection(flight);
  }

  isFlightExpanded(flight: Flight): boolean {
    return this.expandedFlightId === flight.id;
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

  private saveFlightSelection(flight: Flight): void {
    this.tripTempService.updateTripTemp({
      selectedFlightId: flight.id,
      selectedFlightTotal: this.totalPrice(flight),
    });
  }

  continueToHotels(): void {
    if (!this.selectedFlightId) {
      this.searchError = 'Choose a flight to continue.';
      return;
    }

    void this.router.navigate(['/hotels']);
  }

  routeSummary(): string {
    const origin = this.cityOnly(this.tripTemp.origin) || 'Origin';
    const destination = this.cityOnly(this.tripTemp.destination) || 'Destination';
    const date = this.tripTemp.departureDate || 'Date';
    return `${origin} → ${destination} · ${date} · ${this.tripTemp.travelers} traveler${this.tripTemp.travelers === 1 ? '' : 's'}`;
  }

  totalPrice(flight: Flight): number {
    return flight.price * this.tripTemp.travelers;
  }

  stopsLabel(flight: Flight): string {
    return flight.stops === 0 ? 'Direct' : flight.stopDetails ?? `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`;
  }

  private searchFlights(): void {
    const searchParams = this.buildSearchParams();

    if (!searchParams.departureDate || !searchParams.from.code || !searchParams.to.code) {
      this.searchError = 'Go back and complete your origin, destination, and departure date first.';
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
          this.searchError = this.flights.length ? '' : 'No matching flights found for this route.';

          if (!this.selectedFlightId && this.flights.length) {
            this.selectedFlightId = this.flights[0].id;
            this.saveFlightSelection(this.flights[0]);
          }
        },
        error: (error) => {
          this.searchError = error?.error?.detail ?? error?.message ?? 'Flight search failed. Please try again.';
          this.flights = [];
        },
      });
  }

  private buildSearchParams(): SearchParams {
    return {
      tripType: 'one-way' as TripType,
      from: this.parseAirportText(this.tripTemp.origin),
      to: this.parseAirportText(this.tripTemp.destination),
      departureDate: this.parseDateInput(this.tripTemp.departureDate),
      returnDate: null,
      includeCityAirports: false,
      travelers: this.tripTemp.travelers,
      adults: this.tripTemp.travelers,
      children: 0,
      cabinClass: 'economy',
    };
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
