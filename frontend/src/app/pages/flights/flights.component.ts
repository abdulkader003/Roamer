// flights/flights.component.ts

import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Airport,
  CabinClass,
  DepartureWindow,
  Flight,
  FlightFilters,
  MultiCitySegment,
  SearchParams,
  SortMode,
  TripType,
} from './flight.model';
import { FlightsService } from './flights.service';

interface SegmentFlights {
  segmentIndex: number;
  fromText: string;
  toText: string;
  date: string;
  flights: Flight[];
}

interface CalendarDay {
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}

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
  private readonly flightsService = inject(FlightsService);

  // Optional: read theme from your service (for any theme-aware logic)
  // private readonly themeService = inject(ThemeService);
  // readonly theme = this.themeService.theme; // signal<'light' | 'dark'>

  // ---------------- Search state ----------------
  readonly tripType = signal<TripType>('one-way');

  readonly from = signal<Airport>({
    code: '',
    city: '',
    fullName: '',
  });
  readonly fromText = signal('');

  readonly to = signal<Airport>({
    code: '',
    city: '',
    fullName: '',
  });
  readonly toText = signal('');

  readonly departureDate = signal<Date | null>(null);
  readonly returnDate = signal<Date | null>(null);
  readonly activeDatePicker = signal<'departure' | 'return' | null>(null);
  readonly datePickerMonth = signal<Date>(new Date());
  readonly manualDateText = signal('');
  readonly manualDateError = signal('');
  readonly searchError = signal('');
  readonly isSearching = signal(false);
  readonly hasSearched = signal(false);
  readonly appliedTripType = signal<TripType>('one-way');
  readonly appliedDepartureDate = signal<Date | null>(null);
  readonly appliedReturnDate = signal<Date | null>(null);
  readonly appliedMultiCitySegments = signal<MultiCitySegment[]>([]);
  readonly multiCitySegments = signal<MultiCitySegment[]>([
    { fromText: '', toText: '', date: null },
    { fromText: '', toText: '', date: null },
  ]);
  readonly adults = signal<number>(1);
  readonly children = signal<number>(0);
  readonly travelers = computed(() => this.adults() + this.children());
  readonly travelersPickerOpen = signal(false);
  readonly expandedFlightId = signal<string | null>(null);
  readonly cabinClass = signal<CabinClass>('economy');
  readonly activeAirportPicker = signal<'from' | 'to' | null>(null);

  readonly airports: Airport[] = [
    { code: 'DUS', city: 'Düsseldorf', fullName: 'Düsseldorf Intl.' },
    { code: 'CDG', city: 'Paris', fullName: 'Charles de Gaulle' },
    { code: 'LHR', city: 'London', fullName: 'Heathrow' },
    { code: 'BER', city: 'Berlin', fullName: 'Berlin Brandenburg' },
    { code: 'BCN', city: 'Barcelona', fullName: 'Barcelona-El Prat' },
    { code: 'MAD', city: 'Madrid', fullName: 'Adolfo Suárez Madrid-Barajas' },
    { code: 'FCO', city: 'Rome', fullName: 'Fiumicino' },
    { code: 'MXP', city: 'Milan', fullName: 'Malpensa' },
    { code: 'VIE', city: 'Vienna', fullName: 'Vienna Intl.' },
    { code: 'BUD', city: 'Budapest', fullName: 'Budapest Ferenc Liszt' },
    { code: 'AMS', city: 'Amsterdam', fullName: 'Amsterdam Schiphol' },
    { code: 'BRU', city: 'Brussels', fullName: 'Brussels Airport' },
    { code: 'FRA', city: 'Frankfurt', fullName: 'Frankfurt Airport' },
    { code: 'MUC', city: 'Munich', fullName: 'Munich Airport' },
    { code: 'LIS', city: 'Lisbon', fullName: 'Humberto Delgado' },
    { code: 'ZRH', city: 'Zurich', fullName: 'Zurich Airport' },
    { code: 'IST', city: 'Istanbul', fullName: 'Istanbul Airport' },
    { code: 'JFK', city: 'New York', fullName: 'John F. Kennedy' },
    { code: 'DXB', city: 'Dubai', fullName: 'Dubai Intl.' },
    { code: 'DOH', city: 'Doha', fullName: 'Hamad Intl.' },
    { code: 'CAI', city: 'Cairo', fullName: 'Cairo Intl.' },
    { code: 'HND', city: 'Tokyo', fullName: 'Haneda' },
  ];

  readonly tripTypes: { id: TripType; label: string }[] = [
    { id: 'one-way', label: 'One way' },
    { id: 'round-trip', label: 'Round trip' },
    { id: 'multi-city', label: 'Multi-city' },
  ];

  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

  readonly flights = signal<Flight[]>([]);
  readonly returnFlights = signal<Flight[]>([]);
  readonly segmentFlights = signal<SegmentFlights[]>([]);

  readonly filteredFlights = computed(() => this.filterAndSortFlights(this.flights()));

  readonly filteredReturnFlights = computed(() => this.filterAndSortFlights(this.returnFlights()));

  readonly resultCount = computed(() => (
    this.filteredFlights().length
    + this.filteredReturnFlights().length
    + this.segmentFlights().reduce((total, segment) => total + this.filterAndSortFlights(segment.flights).length, 0)
  ));

  private filterAndSortFlights(flights: Flight[]): Flight[] {
    const filters = this.filters();
    const matchingFlights = flights.filter(flight => {
      if (flight.price < filters.priceMin || flight.price > filters.priceMax) return false;
      if (!filters.airlines[flight.airline.code]) return false;
      if (!filters.departureWindows[this.getDepartureWindow(flight.departure.time)]) return false;
      if (filters.carryOnIncluded && !flight.carryOnIncluded) return false;
      if (filters.checkedBagIncluded && !flight.checkedBagIncluded) return false;

      if (flight.stops === 0 && !filters.stops.direct) return false;
      if (flight.stops === 1 && !filters.stops.oneStop) return false;
      if (flight.stops >= 2 && !filters.stops.twoPlus) return false;

      return true;
    });

    return this.sortFlights(matchingFlights, this.sortMode());
  }

  // ---------------- Mobile filter drawer ----------------
  readonly filtersDrawerOpen = signal(false);

  // ---------------- Methods ----------------
  setTripType(t: TripType): void {
    this.tripType.set(t);
    this.searchError.set('');

    if (t !== 'round-trip') {
      this.activeDatePicker.set(null);
    }
  }
  setSortMode(s: SortMode): void { this.sortMode.set(s); }

  closeDatePicker(): void { this.activeDatePicker.set(null); }

  closeTravelersPicker(): void { this.travelersPickerOpen.set(false); }

  toggleTravelersPicker(): void {
    this.activeDatePicker.set(null);
    this.travelersPickerOpen.update(open => !open);
  }

  updateAdults(delta: number): void {
    this.adults.update(value => Math.max(1, value + delta));
  }

  updateChildren(delta: number): void {
    this.children.update(value => Math.max(0, value + delta));
  }

  updateMultiCityText(index: number, key: 'fromText' | 'toText', value: string): void {
    this.multiCitySegments.update(segments => segments.map((segment, i) => (
      i === index ? { ...segment, [key]: value } : segment
    )));
  }

  updateMultiCityDate(index: number, value: string): void {
    const date = this.parseDateInput(value);
    this.multiCitySegments.update(segments => segments.map((segment, i) => (
      i === index ? { ...segment, date } : segment
    )));
  }

  addMultiCitySegment(): void {
    this.multiCitySegments.update(segments => {
      const previous = segments[segments.length - 1];
      return [
        ...segments,
        {
          fromText: previous?.toText ?? '',
          toText: '',
          date: this.nextSegmentDate(previous?.date ?? this.departureDate()),
        },
      ];
    });
  }

  removeMultiCitySegment(index: number): void {
    this.multiCitySegments.update(segments => (
      segments.length <= 2 ? segments : segments.filter((_, i) => i !== index)
    ));
  }

  toggleDatePicker(kind: 'departure' | 'return'): void {
    this.travelersPickerOpen.set(false);
    this.activeDatePicker.update(active => {
      if (active === kind) return null;

      const selectedDate = kind === 'departure' ? this.departureDate() : this.returnDate();
      const baseDate = selectedDate ?? this.departureDate() ?? new Date();
      this.datePickerMonth.set(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
      this.manualDateText.set(this.formatDateInput(selectedDate));
      this.manualDateError.set('');

      return kind;
    });
  }

  updateDepartureDate(value: string): void {
    const date = this.parseDateInput(value);
    this.departureDate.set(date);

    if (date) {
      this.datePickerMonth.set(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  updateReturnDate(value: string): void {
    const date = this.parseDateInput(value);
    this.returnDate.set(date);

    if (date) {
      this.datePickerMonth.set(new Date(date.getFullYear(), date.getMonth(), 1));
      this.tripType.set('round-trip');
    }
  }

  clearReturnDate(): void {
    this.returnDate.set(null);
    this.manualDateText.set('');
    this.manualDateError.set('');
    this.activeDatePicker.set(null);
  }

  moveDatePickerMonth(offset: number): void {
    const month = this.datePickerMonth();
    this.datePickerMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  selectCalendarDate(date: Date): void {
    const selected = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (this.activeDatePicker() === 'departure') {
      this.departureDate.set(selected);
    } else {
      this.returnDate.set(selected);
      this.tripType.set('round-trip');
    }

    this.manualDateText.set(this.formatDateInput(selected));
    this.manualDateError.set('');
  }

  updateOriginText(value: string): void {
    this.fromText.set(value);
    this.from.set(this.parseAirportText(value, this.from()));
    this.activeAirportPicker.set('from');
  }

  updateDestinationText(value: string): void {
    this.toText.set(value);
    this.to.set(this.parseAirportText(value, this.to()));
    this.activeAirportPicker.set('to');
  }

  showAirportSuggestions(kind: 'from' | 'to'): void {
    this.activeAirportPicker.set(kind);
    this.activeDatePicker.set(null);
    this.travelersPickerOpen.set(false);
  }

  airportSuggestions(kind: 'from' | 'to'): Airport[] {
    const query = (kind === 'from' ? this.fromText() : this.toText()).trim().toLowerCase();
    if (!query) {
      return [];
    }

    const selectedCode = kind === 'from' ? this.to().code : this.from().code;
    const matches = this.airports.filter(airport => {
      const haystack = `${airport.code} ${airport.city} ${airport.fullName}`.toLowerCase();
      return airport.code !== selectedCode && haystack.includes(query);
    });

    return matches.slice(0, 6);
  }

  selectAirport(kind: 'from' | 'to', airport: Airport): void {
    const text = `${airport.city} (${airport.code})`;

    if (kind === 'from') {
      this.from.set(airport);
      this.fromText.set(text);
    } else {
      this.to.set(airport);
      this.toText.set(text);
    }

    this.activeAirportPicker.set(null);
    this.searchError.set('');
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

  updatePriceMin(value: string): void {
    const priceMin = Number(value);
    this.filters.update(f => ({
      ...f,
      priceMin: Math.min(priceMin, f.priceMax),
    }));
  }

  updatePriceMax(value: string): void {
    const priceMax = Number(value);
    this.filters.update(f => ({
      ...f,
      priceMax: Math.max(priceMax, f.priceMin),
    }));
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

  onSearch(): void {
    const validationError = this.validateSearchDates();
    if (validationError) {
      this.searchError.set(validationError);
      return;
    }

    this.searchError.set('');
    this.hasSearched.set(true);
    this.appliedTripType.set(this.tripType());
    this.appliedDepartureDate.set(this.departureDate());
    this.appliedReturnDate.set(this.tripType() === 'round-trip' ? this.returnDate() : null);
    this.appliedMultiCitySegments.set(
      this.tripType() === 'multi-city'
        ? this.multiCitySegments().map(segment => ({ ...segment }))
        : []
    );

    const params: SearchParams = {
      tripType: this.tripType(),
      from: this.from(),
      to: this.to(),
      departureDate: this.departureDate(),
      returnDate: this.returnDate(),
      multiCitySegments: this.tripType() === 'multi-city'
        ? this.multiCitySegments().map(segment => ({ ...segment }))
        : undefined,
      travelers: this.travelers(),
      adults: this.adults(),
      children: this.children(),
      cabinClass: this.cabinClass(),
    };
    console.log('[FlightsComponent] search', params);
    this.isSearching.set(true);
    this.flightsService.search(params).subscribe({
      next: response => {
        if (this.tripType() === 'multi-city') {
          this.flights.set([]);
          this.returnFlights.set([]);
          this.segmentFlights.set(response.segmentFlights ?? []);
        } else {
          this.flights.set(response.outboundFlights?.length ? response.outboundFlights : response.flights);
          this.returnFlights.set(this.tripType() === 'round-trip' ? (response.returnFlights ?? []) : []);
          this.segmentFlights.set([]);
        }
        this.expandedFlightId.set(null);
        this.isSearching.set(false);
      },
      error: error => {
        console.error('[FlightsComponent] search failed', error);
        this.searchError.set(error?.error?.detail ?? 'Flight search failed. Please try again.');
        this.isSearching.set(false);
      },
    });
  }

  onSelectFlight(flight: Flight): void {
    console.log('[FlightsComponent] select', flight);
    // this.bookingService.addFlight(flight);
    // this.router.navigate(['/bookings/new'], { state: { flight } });
  }

  toggleFlightDetails(flight: Flight): void {
    this.expandedFlightId.update(id => id === flight.id ? null : flight.id);
  }

  filteredSegmentFlights(segment: SegmentFlights): Flight[] {
    return this.filterAndSortFlights(segment.flights);
  }

  // Helpers used by template
  formatDate(d: Date | null): string {
    if (!d) return '';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  }
  formatYear(d: Date | null): string {
    return d ? String(d.getFullYear()) : '';
  }

  formatTravelers(): string {
    const adultLabel = `${this.adults()} ${this.adults() === 1 ? 'Adult' : 'Adults'}`;
    const childrenCount = this.children();

    if (!childrenCount) return adultLabel;

    return `${adultLabel}, ${childrenCount} ${childrenCount === 1 ? 'Child' : 'Children'}`;
  }

  formatAppliedSearch(): string {
    const tripLabel = this.tripTypes.find(tab => tab.id === this.appliedTripType())?.label ?? 'Trip';
    const departure = this.formatDate(this.appliedDepartureDate());

    if (this.appliedTripType() === 'multi-city') {
      return `${tripLabel} · ${this.appliedMultiCitySegments().length} cities · ${this.formatMultiCitySummary(this.appliedMultiCitySegments())}`;
    }

    if (this.appliedTripType() === 'round-trip') {
      return `${tripLabel} · ${departure} - ${this.formatDate(this.appliedReturnDate())}`;
    }

    return `${tripLabel} · ${departure}`;
  }

  stopCount(type: 'direct' | 'oneStop' | 'twoPlus'): number {
    return this.flights().filter(flight => {
      if (type === 'direct') return flight.stops === 0;
      if (type === 'oneStop') return flight.stops === 1;
      return flight.stops >= 2;
    }).length;
  }

  airlineCount(code: string): number {
    return this.flights().filter(flight => flight.airline.code === code).length;
  }

  isFlightExpanded(flight: Flight): boolean {
    return this.expandedFlightId() === flight.id;
  }

  baggageSummary(flight: Flight): string {
    const carryOn = flight.carryOnIncluded
      ? `Carry-on ${flight.carryOnWeightKg} kg`
      : 'No carry-on included';
    const checkedBag = flight.checkedBagIncluded
      ? `Checked bag ${flight.checkedBagWeightKg ?? 23} kg`
      : 'No checked bag included';

    return `${carryOn} · ${checkedBag}`;
  }

  formatMultiCityDate(index: number): string {
    return this.formatDateInput(this.multiCitySegments()[index]?.date ?? null);
  }

  formatMultiCitySummary(segments: MultiCitySegment[] = this.multiCitySegments()): string {
    if (!segments.length) return '';

    const first = segments[0];
    const last = segments[segments.length - 1];
    return `${first.fromText || 'From'} to ${last.toText || 'To'}`;
  }

  formatDateInput(d: Date | null): string {
    if (!d) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  activeDatePickerTitle(): string {
    return this.activeDatePicker() === 'return' ? 'Choose return date' : 'Choose departure date';
  }

  activeDatePickerInputValue(): string {
    return this.manualDateText();
  }

  updateActiveDatePickerInput(value: string): void {
    this.manualDateText.set(value);

    if (!value.trim()) {
      if (this.activeDatePicker() === 'return') {
        this.returnDate.set(null);
        this.manualDateError.set('');
        return;
      }

      this.manualDateError.set('Enter a departure date.');
      return;
    }

    const parsed = this.parseDateInput(value);
    if (!parsed) {
      this.manualDateError.set('Use a valid date in YYYY-MM-DD format.');
      return;
    }

    if (this.activeDatePicker() === 'return') {
      const departure = this.departureDate();
      if (departure && parsed < this.startOfDay(departure)) {
        this.manualDateError.set('Return date cannot be before departure.');
        return;
      }

      this.returnDate.set(parsed);
      this.tripType.set('round-trip');
      this.datePickerMonth.set(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      this.manualDateError.set('');
      return;
    }

    const returnDate = this.returnDate();
    if (returnDate && parsed > this.startOfDay(returnDate)) {
      this.manualDateError.set('Departure date cannot be after return.');
      return;
    }

    this.departureDate.set(parsed);
    this.datePickerMonth.set(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    this.manualDateError.set('');
  }

  datePickerMonthLabel(): string {
    return this.datePickerMonth().toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }

  calendarDays(): CalendarDay[] {
    const month = this.datePickerMonth();
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      const activeDate = this.activeDatePicker() === 'return' ? this.returnDate() : this.departureDate();

      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === month.getMonth(),
        isSelected: this.isSameDate(date, activeDate),
        isToday: this.isSameDate(date, new Date()),
      };
    });
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
    const typedCodeMatch = trimmed.match(/^[A-Za-z]{3}$/);
    const city = codeMatch ? trimmed.slice(0, codeMatch.index).trim() : trimmed;
    const knownAirport = this.knownAirport(city || trimmed);
    const code = codeMatch?.[1].toUpperCase() ?? typedCodeMatch?.[0].toUpperCase() ?? knownAirport?.code ?? '';

    return {
      code,
      city: knownAirport?.city ?? city,
      fullName: knownAirport?.fullName ?? (code && code === current.code ? current.fullName : city),
    };
  }

  private knownAirport(value: string): Airport | null {
    const key = value.trim().toLowerCase();
    return this.airports.find(airport => (
      airport.code.toLowerCase() === key
      || airport.city.toLowerCase() === key
      || airport.fullName.toLowerCase() === key
    )) ?? null;
  }

  private validateSearchDates(): string {
    if (this.tripType() === 'multi-city') {
      return this.validateMultiCitySegments();
    }

    const departure = this.departureDate();
    const returnDate = this.returnDate();

    if (!this.from().code) return 'Please enter a valid origin airport code, for example Düsseldorf (DUS).';
    if (!this.to().code) return 'Please enter a valid destination airport code, for example Paris (CDG).';
    if (!departure) return 'Please choose a valid departure date.';

    if (this.tripType() === 'round-trip') {
      if (!returnDate) return 'Please choose a valid return date for a round trip.';
      if (this.startOfDay(returnDate) < this.startOfDay(departure)) {
        return 'Return date cannot be before departure date.';
      }
    }

    return '';
  }

  private validateMultiCitySegments(): string {
    const segments = this.multiCitySegments();

    if (segments.length < 2) return 'Add at least two city segments.';

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (!segment.fromText.trim() || !segment.toText.trim()) {
        return `Please enter origin and destination for segment ${i + 1}.`;
      }
      if (!segment.date) return `Please choose a valid date for segment ${i + 1}.`;

      const previous = segments[i - 1];
      if (previous?.date && this.startOfDay(segment.date) < this.startOfDay(previous.date)) {
        return `Segment ${i + 1} date cannot be before segment ${i}.`;
      }
    }

    return '';
  }

  private nextSegmentDate(date: Date | null): Date | null {
    if (!date) return null;

    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return next;
  }

  private getDepartureWindow(time: string): DepartureWindow {
    const hour = Number(time.split(':')[0]);

    if (hour < 6) return 'early';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  private sortFlights(flights: Flight[], sortMode: SortMode): Flight[] {
    return [...flights].sort((a, b) => {
      if (sortMode === 'cheapest') return a.price - b.price;
      if (sortMode === 'fastest') return this.durationMinutes(a.duration) - this.durationMinutes(b.duration);

      const badgeScore = (flight: Flight): number => {
        if (flight.badge?.type === 'recommended') return 0;
        if (flight.badge?.type === 'cheapest') return 1;
        if (flight.badge?.type === 'fastest') return 2;
        return 3;
      };

      return badgeScore(a) - badgeScore(b) || a.price - b.price;
    });
  }

  private durationMinutes(duration: string): number {
    const hours = duration.match(/(\d+)h/)?.[1] ?? '0';
    const minutes = duration.match(/(\d+)m/)?.[1] ?? '0';

    return Number(hours) * 60 + Number(minutes);
  }

  private parseDateInput(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

    const [year, month, day] = trimmed.split('-').map(Number);
    if (!year || !month || !day) return null;

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year
      || date.getMonth() !== month - 1
      || date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  private isSameDate(a: Date | null, b: Date | null): boolean {
    if (!a || !b) return false;

    return (
      a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate()
    );
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
