// flights/flights.component.ts

import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Airport,
  CabinClass,
  DepartureWindow,
  Flight,
  FlightFilters,
  SearchParams,
  SortMode,
  TripType,
} from './flight.model';

// If your ThemeService lives elsewhere, adjust the path.
// import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-flights',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './flights.component.html',
  styleUrls: ['./flights.component.scss'],
})
export class FlightsComponent {
  // Optional: read theme from your service (for any theme-aware logic)
  // private readonly themeService = inject(ThemeService);
  // readonly theme = this.themeService.theme; // signal<'light' | 'dark'>

  // ---------------- Search state ----------------
  readonly tripType = signal<TripType>('one-way');

  readonly from = signal<Airport>({
    code: 'DUS',
    city: 'Düsseldorf',
    fullName: 'Düsseldorf Intl.',
  });
  readonly fromText = signal('Düsseldorf (DUS)');

  readonly to = signal<Airport>({
    code: 'CDG',
    city: 'Paris',
    fullName: 'Charles de Gaulle',
  });
  readonly toText = signal('Paris (CDG)');

  readonly departureDate = signal<Date | null>(new Date(2026, 5, 15));
  readonly returnDate = signal<Date | null>(null);
  readonly travelers = signal<number>(1);
  readonly cabinClass = signal<CabinClass>('economy');

  readonly tripTypes: { id: TripType; label: string }[] = [
    { id: 'one-way', label: 'One way' },
    { id: 'round-trip', label: 'Round trip' },
    { id: 'multi-city', label: 'Multi-city' },
  ];

  // ---------------- Filters ----------------
  readonly filters = signal<FlightFilters>({
    priceMin: 80,
    priceMax: 420,
    stops: { direct: true, oneStop: true, twoPlus: false },
    airlines: { LH: true, AF: true, KL: true, EW: true, SN: false },
    departureWindows: { early: true, morning: true, afternoon: true, evening: false },
    carryOnIncluded: true,
    checkedBagIncluded: false,
  });

  readonly departureWindowChips: { id: DepartureWindow; label: string; range: string }[] = [
    { id: 'early',     label: 'Early',     range: '00 – 06' },
    { id: 'morning',   label: 'Morning',   range: '06 – 12' },
    { id: 'afternoon', label: 'Afternoon', range: '12 – 18' },
    { id: 'evening',   label: 'Evening',   range: '18 – 24' },
  ];

  readonly airlineCheckboxes: { code: string; name: string; minPrice: number }[] = [
    { code: 'LH', name: 'Lufthansa',        minPrice: 189 },
    { code: 'AF', name: 'Air France',       minPrice: 145 },
    { code: 'KL', name: 'KLM',              minPrice: 132 },
    { code: 'EW', name: 'Eurowings',        minPrice: 98  },
    { code: 'SN', name: 'Brussels Airl.',   minPrice: 119 },
  ];

  // ---------------- Sort & results ----------------
  readonly sortMode = signal<SortMode>('best');

  readonly sortTabs: { id: SortMode; label: string; meta: string }[] = [
    { id: 'best',     label: 'Best',     meta: '€132 · 3h 25m' },
    { id: 'cheapest', label: 'Cheapest', meta: '€98 · 1h 40m'  },
    { id: 'fastest',  label: 'Fastest',  meta: '€215 · 1h 35m' },
  ];

  // Mock results — replace with API data via a FlightsService.
  readonly flights = signal<Flight[]>([
    {
      id: 'fl-1',
      airline: { code: 'KL', name: 'KLM', colorClass: 'kl' },
      departure: { time: '14:20', airport: 'DUS', city: 'Düsseldorf' },
      arrival:   { time: '17:45', airport: 'CDG', city: 'Paris' },
      duration: '3h 25m',
      stops: 1,
      stopDetails: '1 stop · AMS · 1h 10m layover',
      price: 132,
      currency: 'EUR',
      badge: { type: 'recommended', label: '★ Best value' },
    },
    {
      id: 'fl-2',
      airline: { code: 'EW', name: 'Eurowings', colorClass: 'ew' },
      departure: { time: '06:45', airport: 'DUS', city: 'Düsseldorf' },
      arrival:   { time: '08:25', airport: 'CDG', city: 'Paris' },
      duration: '1h 40m',
      stops: 0,
      price: 98,
      currency: 'EUR',
      badge: { type: 'cheapest', label: '↓ Cheapest' },
    },
    {
      id: 'fl-3',
      airline: { code: 'LH', name: 'Lufthansa', colorClass: 'lh' },
      departure: { time: '07:25', airport: 'DUS', city: 'Düsseldorf' },
      arrival:   { time: '09:00', airport: 'CDG', city: 'Paris' },
      duration: '1h 35m',
      stops: 0,
      price: 189,
      currency: 'EUR',
      badge: { type: 'fastest', label: '⚡ Fastest morning' },
    },
    {
      id: 'fl-4',
      airline: { code: 'AF', name: 'Air France', colorClass: 'af' },
      departure: { time: '10:40', airport: 'DUS', city: 'Düsseldorf' },
      arrival:   { time: '13:55', airport: 'CDG', city: 'Paris' },
      duration: '3h 15m',
      stops: 1,
      stopDetails: '1 stop · AMS · 1h 05m layover',
      price: 145,
      currency: 'EUR',
    },
    {
      id: 'fl-5',
      airline: { code: 'SN', name: 'Brussels', colorClass: 'sn' },
      departure: { time: '13:10', airport: 'DUS', city: 'Düsseldorf' },
      arrival:   { time: '16:30', airport: 'CDG', city: 'Paris' },
      duration: '3h 20m',
      stops: 1,
      stopDetails: '1 stop · BRU · 1h 30m layover',
      price: 119,
      currency: 'EUR',
    },
    {
      id: 'fl-6',
      airline: { code: 'LH', name: 'Lufthansa', colorClass: 'lh' },
      departure: { time: '18:15', airport: 'DUS', city: 'Düsseldorf' },
      arrival:   { time: '19:50', airport: 'CDG', city: 'Paris' },
      duration: '1h 35m',
      stops: 0,
      price: 215,
      currency: 'EUR',
    },
  ]);

  readonly resultCount = computed(() => this.flights().length);

  // ---------------- Mobile filter drawer ----------------
  readonly filtersDrawerOpen = signal(false);

  // ---------------- Methods ----------------
  setTripType(t: TripType): void { this.tripType.set(t); }
  setSortMode(s: SortMode): void { this.sortMode.set(s); }

  updateOriginText(value: string): void {
    this.fromText.set(value);
    this.from.set(this.parseAirportText(value, this.from()));
  }

  updateDestinationText(value: string): void {
    this.toText.set(value);
    this.to.set(this.parseAirportText(value, this.to()));
  }

  swapAirports(): void {
    const f = this.from();
    const fromText = this.fromText();

    this.from.set(this.to());
    this.to.set(f);
    this.fromText.set(this.toText());
    this.toText.set(fromText);
  }

  toggleStop(key: 'direct' | 'oneStop' | 'twoPlus'): void {
    this.filters.update(f => ({ ...f, stops: { ...f.stops, [key]: !f.stops[key] } }));
  }

  toggleAirline(code: string): void {
    this.filters.update(f => ({
      ...f,
      airlines: { ...f.airlines, [code]: !f.airlines[code] },
    }));
  }

  toggleWindow(w: DepartureWindow): void {
    this.filters.update(f => ({
      ...f,
      departureWindows: { ...f.departureWindows, [w]: !f.departureWindows[w] },
    }));
  }

  toggleBaggage(key: 'carryOnIncluded' | 'checkedBagIncluded'): void {
    this.filters.update(f => ({ ...f, [key]: !f[key] }));
  }

  resetFilters(): void {
    this.filters.set({
      priceMin: 80,
      priceMax: 420,
      stops: { direct: true, oneStop: true, twoPlus: true },
      airlines: { LH: true, AF: true, KL: true, EW: true, SN: true },
      departureWindows: { early: true, morning: true, afternoon: true, evening: true },
      carryOnIncluded: false,
      checkedBagIncluded: false,
    });
  }

  toggleFiltersDrawer(): void { this.filtersDrawerOpen.update(v => !v); }
  closeFiltersDrawer(): void { this.filtersDrawerOpen.set(false); }

  // Hook these to your services / router as needed.
  onSearch(): void {
    const params: SearchParams = {
      tripType: this.tripType(),
      from: this.from(),
      to: this.to(),
      departureDate: this.departureDate(),
      returnDate: this.returnDate(),
      travelers: this.travelers(),
      cabinClass: this.cabinClass(),
    };
    console.log('[FlightsComponent] search', params);
    // this.flightsService.search(params).subscribe(r => this.flights.set(r));
  }

  onSelectFlight(flight: Flight): void {
    console.log('[FlightsComponent] select', flight);
    // this.bookingService.addFlight(flight);
    // this.router.navigate(['/bookings/new'], { state: { flight } });
  }

  // Helpers used by template
  formatDate(d: Date | null): string {
    if (!d) return '';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  }
  formatYear(d: Date | null): string {
    return d ? String(d.getFullYear()) : '';
  }

  // Range slider visualisation (percentage of full 0–500 range)
  get priceMinPct(): number { return (this.filters().priceMin / 500) * 100; }
  get priceMaxPct(): number { return (this.filters().priceMax / 500) * 100; }
  get priceFillStyle(): { [k: string]: string } {
    return { left: this.priceMinPct + '%', right: (100 - this.priceMaxPct) + '%' };
  }

  private parseAirportText(value: string, current: Airport): Airport {
    const trimmed = value.trim();
    const codeMatch = trimmed.match(/\(([A-Za-z]{3})\)\s*$/);
    const code = codeMatch?.[1].toUpperCase() ?? '';
    const city = codeMatch ? trimmed.slice(0, codeMatch.index).trim() : trimmed;

    return {
      code,
      city,
      fullName: code && code === current.code ? current.fullName : city,
    };
  }
}
