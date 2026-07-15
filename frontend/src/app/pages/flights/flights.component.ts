// flights/flights.component.ts

import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { FlightResponse, FlightsService } from './flights.service';
import { CalendarEvent } from '../hotels/models/hotel.model';
import { CalendarService } from '../hotels/services/calendar.service';
import { SharedDatePickerComponent } from '../../shared/date-picker/shared-date-picker.component';

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
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  isToday: boolean;
  isPast: boolean;
}

// If your ThemeService lives elsewhere, adjust the path.
// import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-flights',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SharedDatePickerComponent],
  templateUrl: './flights.component.html',
  styleUrls: ['./flights.component.scss'],
})
export class FlightsComponent implements OnDestroy {
  private readonly flightsService = inject(FlightsService);
  private readonly calendarService = inject(CalendarService);
  private readonly route = inject(ActivatedRoute);
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private deepLinkedFlightId = '';
  private deepLinkedSearchId: number | null = null;

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
  readonly includeCityAirports = signal(false);
  readonly activeDatePicker = signal<'departure' | 'return' | null>(null);
  readonly activeMultiCityDatePicker = signal<number | null>(null);
  readonly datePickerMonth = signal<Date>(new Date());
  readonly manualDateText = signal('');
  readonly manualDateError = signal('');
  readonly searchError = signal('');
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error' | 'info'>('success');
  readonly isSearching = signal(false);
  readonly hasSearched = signal(false);
  readonly selectedFlight = signal<Flight | null>(null);
  readonly flightCalendarMessage = signal('');
  readonly isAddingFlightToCalendar = signal(false);
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
  readonly activeMultiCityAirportPicker = signal<{ index: number; key: 'fromText' | 'toText' } | null>(null);

  readonly airports: Airport[] = [
    { code: 'DUS', city: 'Düsseldorf', fullName: 'Düsseldorf Intl.' },
    { code: 'CGN', city: 'Cologne', fullName: 'Cologne Bonn Airport' },
    { code: 'HAM', city: 'Hamburg', fullName: 'Hamburg Airport' },
    { code: 'STR', city: 'Stuttgart', fullName: 'Stuttgart Airport' },
    { code: 'NUE', city: 'Nuremberg', fullName: 'Nuremberg Airport' },
    { code: 'HAJ', city: 'Hanover', fullName: 'Hannover Airport' },
    { code: 'LEJ', city: 'Leipzig', fullName: 'Leipzig/Halle Airport' },
    { code: 'DRS', city: 'Dresden', fullName: 'Dresden Airport' },
    { code: 'BRE', city: 'Bremen', fullName: 'Bremen Airport' },
    { code: 'DTM', city: 'Dortmund', fullName: 'Dortmund Airport' },
    { code: 'CDG', city: 'Paris', fullName: 'Charles de Gaulle' },
    { code: 'ORY', city: 'Paris', fullName: 'Paris Orly' },
    { code: 'NCE', city: 'Nice', fullName: 'Nice Côte d’Azur' },
    { code: 'LYS', city: 'Lyon', fullName: 'Lyon-Saint Exupéry' },
    { code: 'MRS', city: 'Marseille', fullName: 'Marseille Provence' },
    { code: 'TLS', city: 'Toulouse', fullName: 'Toulouse-Blagnac' },
    { code: 'LHR', city: 'London', fullName: 'Heathrow' },
    { code: 'LGW', city: 'London', fullName: 'Gatwick' },
    { code: 'STN', city: 'London', fullName: 'Stansted' },
    { code: 'MAN', city: 'Manchester', fullName: 'Manchester Airport' },
    { code: 'EDI', city: 'Edinburgh', fullName: 'Edinburgh Airport' },
    { code: 'DUB', city: 'Dublin', fullName: 'Dublin Airport' },
    { code: 'BER', city: 'Berlin', fullName: 'Berlin Brandenburg' },
    { code: 'BCN', city: 'Barcelona', fullName: 'Barcelona-El Prat' },
    { code: 'MAD', city: 'Madrid', fullName: 'Adolfo Suárez Madrid-Barajas' },
    { code: 'PMI', city: 'Palma de Mallorca', fullName: 'Palma de Mallorca Airport' },
    { code: 'AGP', city: 'Málaga', fullName: 'Málaga-Costa del Sol' },
    { code: 'ALC', city: 'Alicante', fullName: 'Alicante-Elche' },
    { code: 'VLC', city: 'Valencia', fullName: 'Valencia Airport' },
    { code: 'SVQ', city: 'Seville', fullName: 'Seville Airport' },
    { code: 'BIO', city: 'Bilbao', fullName: 'Bilbao Airport' },
    { code: 'FCO', city: 'Rome', fullName: 'Fiumicino' },
    { code: 'CIA', city: 'Rome', fullName: 'Ciampino' },
    { code: 'MXP', city: 'Milan', fullName: 'Malpensa' },
    { code: 'LIN', city: 'Milan', fullName: 'Linate' },
    { code: 'BGY', city: 'Milan', fullName: 'Bergamo Orio al Serio' },
    { code: 'VCE', city: 'Venice', fullName: 'Marco Polo' },
    { code: 'NAP', city: 'Naples', fullName: 'Naples Intl.' },
    { code: 'BLQ', city: 'Bologna', fullName: 'Bologna Guglielmo Marconi' },
    { code: 'CTA', city: 'Catania', fullName: 'Catania-Fontanarossa' },
    { code: 'PMO', city: 'Palermo', fullName: 'Palermo Airport' },
    { code: 'VIE', city: 'Vienna', fullName: 'Vienna Intl.' },
    { code: 'SZG', city: 'Salzburg', fullName: 'Salzburg Airport' },
    { code: 'INN', city: 'Innsbruck', fullName: 'Innsbruck Airport' },
    { code: 'BUD', city: 'Budapest', fullName: 'Budapest Ferenc Liszt' },
    { code: 'PRG', city: 'Prague', fullName: 'Václav Havel Airport' },
    { code: 'WAW', city: 'Warsaw', fullName: 'Warsaw Chopin' },
    { code: 'KRK', city: 'Kraków', fullName: 'John Paul II Kraków-Balice' },
    { code: 'GDN', city: 'Gdańsk', fullName: 'Gdańsk Lech Wałęsa' },
    { code: 'AMS', city: 'Amsterdam', fullName: 'Amsterdam Schiphol' },
    { code: 'EIN', city: 'Eindhoven', fullName: 'Eindhoven Airport' },
    { code: 'BRU', city: 'Brussels', fullName: 'Brussels Airport' },
    { code: 'CRL', city: 'Brussels', fullName: 'Charleroi' },
    { code: 'FRA', city: 'Frankfurt', fullName: 'Frankfurt Airport' },
    { code: 'MUC', city: 'Munich', fullName: 'Munich Airport' },
    { code: 'LIS', city: 'Lisbon', fullName: 'Humberto Delgado' },
    { code: 'OPO', city: 'Porto', fullName: 'Francisco Sá Carneiro' },
    { code: 'FAO', city: 'Faro', fullName: 'Faro Airport' },
    { code: 'ZRH', city: 'Zurich', fullName: 'Zurich Airport' },
    { code: 'GVA', city: 'Geneva', fullName: 'Geneva Airport' },
    { code: 'BSL', city: 'Basel', fullName: 'EuroAirport Basel-Mulhouse-Freiburg' },
    { code: 'CPH', city: 'Copenhagen', fullName: 'Copenhagen Airport' },
    { code: 'ARN', city: 'Stockholm', fullName: 'Stockholm Arlanda' },
    { code: 'OSL', city: 'Oslo', fullName: 'Oslo Gardermoen' },
    { code: 'HEL', city: 'Helsinki', fullName: 'Helsinki Airport' },
    { code: 'KEF', city: 'Reykjavík', fullName: 'Keflavík Intl.' },
    { code: 'ATH', city: 'Athens', fullName: 'Athens Intl.' },
    { code: 'SKG', city: 'Thessaloniki', fullName: 'Thessaloniki Airport' },
    { code: 'HER', city: 'Heraklion', fullName: 'Heraklion Intl.' },
    { code: 'JTR', city: 'Santorini', fullName: 'Santorini Airport' },
    { code: 'IST', city: 'Istanbul', fullName: 'Istanbul Airport' },
    { code: 'SAW', city: 'Istanbul', fullName: 'Sabiha Gökçen' },
    { code: 'AYT', city: 'Antalya', fullName: 'Antalya Airport' },
    { code: 'BEY', city: 'Beirut', fullName: 'Beirut-Rafic Hariri Intl.' },
    { code: 'DAM', city: 'Damascus', fullName: 'Damascus Intl.' },
    { code: 'AMM', city: 'Amman', fullName: 'Queen Alia Intl.' },
    { code: 'AQJ', city: 'Aqaba', fullName: 'King Hussein Intl.' },
    { code: 'LCA', city: 'Larnaca', fullName: 'Larnaca Intl.' },
    { code: 'PFO', city: 'Paphos', fullName: 'Paphos Intl.' },
    { code: 'TLV', city: 'Tel Aviv', fullName: 'Ben Gurion Intl.' },
    { code: 'BGW', city: 'Baghdad', fullName: 'Baghdad Intl.' },
    { code: 'EBL', city: 'Erbil', fullName: 'Erbil Intl.' },
    { code: 'KWI', city: 'Kuwait City', fullName: 'Kuwait Intl.' },
    { code: 'BAH', city: 'Manama', fullName: 'Bahrain Intl.' },
    { code: 'MCT', city: 'Muscat', fullName: 'Muscat Intl.' },
    { code: 'RUH', city: 'Riyadh', fullName: 'King Khalid Intl.' },
    { code: 'JED', city: 'Jeddah', fullName: 'King Abdulaziz Intl.' },
    { code: 'MED', city: 'Medina', fullName: 'Prince Mohammad bin Abdulaziz Intl.' },
    { code: 'IKA', city: 'Tehran', fullName: 'Imam Khomeini Intl.' },
    { code: 'TBS', city: 'Tbilisi', fullName: 'Tbilisi Intl.' },
    { code: 'EVN', city: 'Yerevan', fullName: 'Zvartnots Intl.' },
    { code: 'JFK', city: 'New York', fullName: 'John F. Kennedy' },
    { code: 'EWR', city: 'New York', fullName: 'Newark Liberty' },
    { code: 'LGA', city: 'New York', fullName: 'LaGuardia' },
    { code: 'BOS', city: 'Boston', fullName: 'Logan Intl.' },
    { code: 'IAD', city: 'Washington', fullName: 'Dulles Intl.' },
    { code: 'ORD', city: 'Chicago', fullName: 'O’Hare Intl.' },
    { code: 'MIA', city: 'Miami', fullName: 'Miami Intl.' },
    { code: 'LAX', city: 'Los Angeles', fullName: 'Los Angeles Intl.' },
    { code: 'SFO', city: 'San Francisco', fullName: 'San Francisco Intl.' },
    { code: 'SEA', city: 'Seattle', fullName: 'Seattle-Tacoma' },
    { code: 'YYZ', city: 'Toronto', fullName: 'Toronto Pearson' },
    { code: 'YUL', city: 'Montréal', fullName: 'Montréal-Trudeau' },
    { code: 'DXB', city: 'Dubai', fullName: 'Dubai Intl.' },
    { code: 'AUH', city: 'Abu Dhabi', fullName: 'Zayed Intl.' },
    { code: 'DOH', city: 'Doha', fullName: 'Hamad Intl.' },
    { code: 'CAI', city: 'Cairo', fullName: 'Cairo Intl.' },
    { code: 'HRG', city: 'Hurghada', fullName: 'Hurghada Intl.' },
    { code: 'SSH', city: 'Sharm El Sheikh', fullName: 'Sharm El Sheikh Intl.' },
    { code: 'CMN', city: 'Casablanca', fullName: 'Mohammed V Intl.' },
    { code: 'RAK', city: 'Marrakesh', fullName: 'Marrakesh Menara' },
    { code: 'TUN', city: 'Tunis', fullName: 'Tunis-Carthage' },
    { code: 'JNB', city: 'Johannesburg', fullName: 'O. R. Tambo Intl.' },
    { code: 'CPT', city: 'Cape Town', fullName: 'Cape Town Intl.' },
    { code: 'HND', city: 'Tokyo', fullName: 'Haneda' },
    { code: 'NRT', city: 'Tokyo', fullName: 'Narita Intl.' },
    { code: 'ICN', city: 'Seoul', fullName: 'Incheon Intl.' },
    { code: 'PEK', city: 'Beijing', fullName: 'Beijing Capital' },
    { code: 'PVG', city: 'Shanghai', fullName: 'Shanghai Pudong' },
    { code: 'HKG', city: 'Hong Kong', fullName: 'Hong Kong Intl.' },
    { code: 'SIN', city: 'Singapore', fullName: 'Changi' },
    { code: 'BKK', city: 'Bangkok', fullName: 'Suvarnabhumi' },
    { code: 'KUL', city: 'Kuala Lumpur', fullName: 'Kuala Lumpur Intl.' },
    { code: 'DEL', city: 'Delhi', fullName: 'Indira Gandhi Intl.' },
    { code: 'BOM', city: 'Mumbai', fullName: 'Chhatrapati Shivaji Maharaj Intl.' },
    { code: 'SYD', city: 'Sydney', fullName: 'Sydney Kingsford Smith' },
    { code: 'MEL', city: 'Melbourne', fullName: 'Melbourne Airport' },
  ];

  readonly tripTypes: { id: TripType; label: string }[] = [
    { id: 'one-way', label: 'One way' },
    { id: 'round-trip', label: 'Round trip' },
    { id: 'multi-city', label: 'Multi-city' },
  ];

  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  constructor() {
    this.applyDestinationQueryParams();
  }

  ngOnDestroy(): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }
  }

  // ---------------- Filters ----------------
  readonly filters = signal<FlightFilters>({
    priceMin: 80,
    priceMax: 420,
    stops: { direct: true, oneStop: true, twoPlus: true },
    airlines: {
      LH: true,
      AF: true,
      KL: true,
      EW: true,
      SN: true,
      IB: true,
      BA: true,
      VY: true,
      AZ: true,
      TP: true,
      LX: true,
      TK: true,
    },
    departureWindows: { early: true, morning: true, afternoon: true, evening: true },
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
    { code: 'IB', name: 'Iberia',           minPrice: 126 },
    { code: 'BA', name: 'British Airways',  minPrice: 158 },
    { code: 'VY', name: 'Vueling',          minPrice: 92  },
    { code: 'AZ', name: 'ITA Airways',      minPrice: 137 },
    { code: 'TP', name: 'TAP Air Portugal', minPrice: 149 },
    { code: 'LX', name: 'SWISS',            minPrice: 176 },
    { code: 'TK', name: 'Turkish Airlines', minPrice: 169 },
  ];

  // ---------------- Sort & results ----------------
  readonly sortMode = signal<SortMode>('best');

  readonly flights = signal<Flight[]>([]);
  readonly returnFlights = signal<Flight[]>([]);
  readonly segmentFlights = signal<SegmentFlights[]>([]);

  readonly sortTabs = computed<{ id: SortMode; label: string; meta: string }[]>(() => {
    const flights = this.matchingFlightsForSortMeta();

    return [
      { id: 'best', label: 'Best', meta: this.sortMetaFor('best', flights) },
      { id: 'cheapest', label: 'Cheapest', meta: this.sortMetaFor('cheapest', flights) },
      { id: 'fastest', label: 'Fastest', meta: this.sortMetaFor('fastest', flights) },
    ];
  });

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
      if (filters.airlines[flight.airline.code] === false) return false;
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
    this.activeAirportPicker.set(null);
    this.activeMultiCityAirportPicker.set(null);
    this.activeMultiCityDatePicker.set(null);

    if (t !== 'round-trip') {
      this.activeDatePicker.set(null);
    }
  }
  setSortMode(s: SortMode): void { this.sortMode.set(s); }

  closeDatePicker(): void {
    this.activeDatePicker.set(null);
    this.activeMultiCityDatePicker.set(null);
  }

  closeTravelersPicker(): void { this.travelersPickerOpen.set(false); }

  toggleTravelersPicker(): void {
    this.activeDatePicker.set(null);
    this.activeMultiCityDatePicker.set(null);
    this.travelersPickerOpen.update(open => !open);
  }

  updateAdults(delta: number): void {
    this.adults.update(value => Math.max(1, value + delta));
  }

  updateChildren(delta: number): void {
    this.children.update(value => Math.max(0, value + delta));
  }

  trackBySegmentIndex(index: number): number {
    return index;
  }

  updateMultiCityText(index: number, key: 'fromText' | 'toText', value: string): void {
    this.multiCitySegments.update(segments => segments.map((segment, i) => (
      i === index ? { ...segment, [key]: value } : segment
    )));
    this.activeAirportPicker.set(null);
    this.activeMultiCityAirportPicker.set({ index, key });
  }

  updateMultiCityDate(index: number, value: string): void {
    const date = this.parseDateInput(value);
    this.multiCitySegments.update(segments => segments.map((segment, i) => (
      i === index ? { ...segment, date } : segment
    )));
  }

  toggleMultiCityDatePicker(index: number): void {
    const selectedDate = this.multiCitySegments()[index]?.date ?? null;
    const baseDate = selectedDate ?? new Date();

    this.activeDatePicker.set(null);
    this.activeMultiCityDatePicker.update(active => active === index ? null : index);
    this.datePickerMonth.set(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
    this.manualDateText.set(this.formatDateInput(selectedDate));
    this.manualDateError.set('');
    this.travelersPickerOpen.set(false);
    this.activeAirportPicker.set(null);
    this.activeMultiCityAirportPicker.set(null);
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
    this.activeMultiCityDatePicker.set(null);
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
    if (this.isPastDate(selected)) {
      const message = 'Choose today or a future flight date.';
      this.manualDateError.set(message);
      this.showToast(message, 'error');
      return;
    }

    if (this.activeMultiCityDatePicker() !== null) {
      this.updateMultiCityDate(this.activeMultiCityDatePicker()!, this.formatDateInput(selected));
      this.manualDateText.set(this.formatDateInput(selected));
      this.manualDateError.set('');
      this.closeDatePicker();
      return;
    }

    if (this.tripType() === 'round-trip') {
      if (this.activeDatePicker() === 'return') {
        const departure = this.departureDate();
        if (!departure || selected < this.startOfDay(departure)) {
          this.departureDate.set(selected);
          this.returnDate.set(null);
          this.activeDatePicker.set('return');
        } else {
          this.returnDate.set(selected);
          this.closeDatePicker();
        }
      } else {
        const returnDate = this.returnDate();
        this.departureDate.set(selected);
        if (returnDate && selected > this.startOfDay(returnDate)) {
          this.returnDate.set(null);
        }
        this.activeDatePicker.set('return');
      }

      this.manualDateText.set(this.formatDateInput(this.activeDatePicker() === 'return' ? this.returnDate() : selected));
      this.manualDateError.set('');
      return;
    }

    if (this.activeDatePicker() === 'departure') {
      this.departureDate.set(selected);
      if (this.tripType() === 'one-way') {
        this.closeDatePicker();
      }
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
    this.activeMultiCityAirportPicker.set(null);
  }

  updateDestinationText(value: string): void {
    this.toText.set(value);
    this.to.set(this.parseAirportText(value, this.to()));
    this.activeAirportPicker.set('to');
    this.activeMultiCityAirportPicker.set(null);
  }

  showAirportSuggestions(kind: 'from' | 'to'): void {
    this.activeAirportPicker.set(kind);
    this.activeMultiCityAirportPicker.set(null);
    this.activeDatePicker.set(null);
    this.activeMultiCityDatePicker.set(null);
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

  showMultiCityAirportSuggestions(index: number, key: 'fromText' | 'toText'): void {
    this.activeAirportPicker.set(null);
    this.activeMultiCityAirportPicker.set({ index, key });
    this.activeDatePicker.set(null);
    this.activeMultiCityDatePicker.set(null);
    this.travelersPickerOpen.set(false);
  }

  multiCityAirportSuggestions(index: number, key: 'fromText' | 'toText'): Airport[] {
    const segment = this.multiCitySegments()[index];
    const query = (segment?.[key] ?? '').trim().toLowerCase();
    if (!query) {
      return [];
    }

    const otherText = key === 'fromText' ? segment?.toText : segment?.fromText;
    const selectedCode = this.parseAirportText(otherText ?? '', { code: '', city: '', fullName: '' }).code;

    const matches = this.airports.filter(airport => {
      const haystack = `${airport.code} ${airport.city} ${airport.fullName}`.toLowerCase();
      return airport.code !== selectedCode && haystack.includes(query);
    });

    return matches.slice(0, 6);
  }

  isMultiCityAirportPickerOpen(index: number, key: 'fromText' | 'toText'): boolean {
    const active = this.activeMultiCityAirportPicker();
    return active?.index === index && active.key === key;
  }

  selectMultiCityAirport(index: number, key: 'fromText' | 'toText', airport: Airport): void {
    const text = `${airport.city} (${airport.code})`;
    this.multiCitySegments.update(segments => segments.map((segment, i) => (
      i === index ? { ...segment, [key]: text } : segment
    )));
    this.activeMultiCityAirportPicker.set(null);
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
      airlines: {
        LH: true,
        AF: true,
        KL: true,
        EW: true,
        SN: true,
        IB: true,
        BA: true,
        VY: true,
        AZ: true,
        TP: true,
        LX: true,
        TK: true,
      },
      departureWindows: { early: true, morning: true, afternoon: true, evening: true },
      carryOnIncluded: false,
      checkedBagIncluded: false,
    });
  }

  toggleFiltersDrawer(): void { this.filtersDrawerOpen.update(v => !v); }
  closeFiltersDrawer(): void { this.filtersDrawerOpen.set(false); }

  toggleCityAirportSearch(): void {
    this.includeCityAirports.update(value => !value);
  }

  private applyDestinationQueryParams(): void {
    const query = this.route.snapshot.queryParamMap;
    const tripType = this.readTripType(query.get('tripType'));
    const travelers = Number(query.get('travelers'));
    const searchId = Number(query.get('searchId'));
    this.deepLinkedFlightId = query.get('flightId')?.trim() ?? '';

    if (Number.isFinite(searchId) && searchId > 0) {
      this.deepLinkedSearchId = Math.floor(searchId);
    }

    if (tripType) {
      this.tripType.set(tripType);
    }

    if (Number.isFinite(travelers) && travelers > 0) {
      // Destination only collects total travelers, so Flights treats them as adults.
      this.adults.set(Math.min(9, Math.max(1, Math.floor(travelers))));
      this.children.set(0);
    }

    if (tripType === 'multi-city') {
      this.applyMultiCityQuery(query.get('multiCitySegments'));
      return;
    }

    const fromText = query.get('from') ?? '';
    const toText = query.get('to') ?? '';
    const departure = this.parseDateInput(query.get('departureDate') ?? '');
    const returnDate = this.parseDateInput(query.get('returnDate') ?? '');

    if (fromText.trim()) {
      const airport = this.parseAirportText(fromText, this.from());
      this.from.set(airport);
      this.fromText.set(airport.code ? this.normalizeAirportText(fromText) : fromText.trim());
    }

    if (toText.trim()) {
      const airport = this.parseAirportText(toText, this.to());
      this.to.set(airport);
      this.toText.set(airport.code ? this.normalizeAirportText(toText) : toText.trim());
    }

    if (departure) {
      this.departureDate.set(departure);
      this.datePickerMonth.set(new Date(departure.getFullYear(), departure.getMonth(), 1));
    }

    if (tripType === 'round-trip' && returnDate) {
      this.returnDate.set(returnDate);
    }

    if (this.deepLinkedSearchId !== null) {
      setTimeout(() => this.loadDeepLinkedCachedSearch(this.deepLinkedSearchId!));
      return;
    }

    if (query.get('autoSearch') === 'true') {
      setTimeout(() => this.onSearch());
    }
  }

  private applyMultiCityQuery(rawSegments: string | null): void {
    if (!rawSegments) {
      return;
    }

    try {
      const parsed = JSON.parse(rawSegments) as unknown;

      if (!Array.isArray(parsed)) {
        return;
      }

      const segments = parsed
        .map((segment): MultiCitySegment | null => {
          if (!segment || typeof segment !== 'object') {
            return null;
          }

          const value = segment as Record<string, unknown>;
          const fromText = typeof value['fromText'] === 'string' ? value['fromText'] : '';
          const toText = typeof value['toText'] === 'string' ? value['toText'] : '';
          const dateText = typeof value['date'] === 'string' ? value['date'] : '';

          return {
            fromText: fromText.trim() ? this.normalizeAirportText(fromText) : '',
            toText: toText.trim() ? this.normalizeAirportText(toText) : '',
            date: this.parseDateInput(dateText),
          };
        })
        .filter((segment): segment is MultiCitySegment => segment !== null);

      if (segments.length >= 2) {
        this.multiCitySegments.set(segments);
        this.departureDate.set(segments[0].date);

        const firstAirport = this.parseAirportText(segments[0].fromText, this.from());
        const lastAirport = this.parseAirportText(segments[segments.length - 1].toText, this.to());

        this.from.set(firstAirport);
        this.fromText.set(segments[0].fromText);
        this.to.set(lastAirport);
        this.toText.set(segments[segments.length - 1].toText);

        if (segments[0].date) {
          this.datePickerMonth.set(new Date(segments[0].date.getFullYear(), segments[0].date.getMonth(), 1));
        }
      }
    } catch {
      this.searchError.set('Could not read the multi-city route from the trip destination step.');
    }
  }

  private readTripType(value: string | null): TripType | null {
    return value === 'one-way' || value === 'round-trip' || value === 'multi-city'
      ? value
      : null;
  }

  onSearch(): void {
    const validationError = this.validateSearchDates();
    if (validationError) {
      this.searchError.set(validationError);
      this.showToast(validationError, 'error');
      return;
    }

    const normalizedMultiCitySegments = this.tripType() === 'multi-city'
      ? this.multiCitySegments().map(segment => this.normalizeMultiCitySegment(segment))
      : [];

    this.searchError.set('');
    this.hasSearched.set(true);
    this.appliedTripType.set(this.tripType());
    this.appliedDepartureDate.set(this.departureDate());
    this.appliedReturnDate.set(this.tripType() === 'round-trip' ? this.returnDate() : null);
    this.appliedMultiCitySegments.set(normalizedMultiCitySegments);

    const params: SearchParams = {
      tripType: this.tripType(),
      from: this.from(),
      to: this.to(),
      departureDate: this.departureDate(),
      returnDate: this.returnDate(),
      multiCitySegments: this.tripType() === 'multi-city'
        ? normalizedMultiCitySegments
        : undefined,
      includeCityAirports: this.tripType() !== 'multi-city' && this.includeCityAirports(),
      travelers: this.travelers(),
      adults: this.adults(),
      children: this.children(),
      cabinClass: this.cabinClass(),
    };
    console.log('[FlightsComponent] search', params);
    this.isSearching.set(true);
    this.flightsService.search(params).subscribe({
      next: response => {
        this.applyFlightResponse(response);
        this.isSearching.set(false);
        const resultCount = this.resultCount();
        this.showToast(
          resultCount > 0
            ? `${resultCount} flight option${resultCount === 1 ? '' : 's'} found.`
            : 'No matching flights found.',
          resultCount > 0 ? 'success' : 'error'
        );
      },
      error: error => {
        console.error('[FlightsComponent] search failed', error);
        const message = error?.error?.detail ?? 'Flight search failed. Please try again.';
        this.searchError.set(message);
        this.isSearching.set(false);
        this.showToast(message, 'error');
      },
    });
  }

  private loadDeepLinkedCachedSearch(searchId: number): void {
    this.isSearching.set(true);
    this.searchError.set('');

    this.flightsService.getCachedSearch(searchId).subscribe({
      next: response => {
        this.applyFlightResponse(response);
        this.isSearching.set(false);
        this.showToast('Opened the exact saved flight deal.', 'success');
      },
      error: error => {
        console.error('[FlightsComponent] cached search failed', error);
        this.isSearching.set(false);
        this.showToast('Could not open the exact saved deal. Searching the route instead.', 'error');
        this.onSearch();
      },
    });
  }

  private applyFlightResponse(response: FlightResponse): void {
    this.appliedTripType.set(response.tripType);
    this.appliedDepartureDate.set(this.parseDateInput(response.departureDate));
    this.appliedReturnDate.set(this.parseDateInput(response.returnDate ?? ''));
    this.appliedMultiCitySegments.set((response.multiCitySegments ?? []).map(segment => ({
      fromText: segment.fromText,
      toText: segment.toText,
      date: this.parseDateInput(segment.date ?? ''),
    })));

    if (response.tripType === 'multi-city') {
      this.flights.set([]);
      this.returnFlights.set([]);
      this.segmentFlights.set(response.segmentFlights ?? []);
    } else {
      this.flights.set(response.outboundFlights?.length ? response.outboundFlights : response.flights);
      this.returnFlights.set(response.tripType === 'round-trip' ? (response.returnFlights ?? []) : []);
      this.segmentFlights.set([]);
    }

    this.expandedFlightId.set(null);
    this.openDeepLinkedFlight();
  }

  onSelectFlight(flight: Flight): void {
    this.selectedFlight.set(flight);
    this.flightCalendarMessage.set('');
    this.activeAirportPicker.set(null);
    this.activeMultiCityAirportPicker.set(null);
    this.activeDatePicker.set(null);
    this.travelersPickerOpen.set(false);
  }

  private openDeepLinkedFlight(): void {
    if (!this.deepLinkedFlightId) {
      return;
    }

    const matchingFlight = [
      ...this.flights(),
      ...this.returnFlights(),
      ...this.segmentFlights().flatMap(segment => segment.flights),
    ].find(flight => flight.id === this.deepLinkedFlightId || flight.flightNumber === this.deepLinkedFlightId);

    if (!matchingFlight) {
      return;
    }

    this.onSelectFlight(matchingFlight);
    this.expandedFlightId.set(matchingFlight.id);
    this.deepLinkedFlightId = '';
  }

  closeSelectedFlightModal(): void {
    if (this.isAddingFlightToCalendar()) {
      return;
    }

    this.selectedFlight.set(null);
    this.flightCalendarMessage.set('');
  }

  async addSelectedFlightToCalendar(): Promise<void> {
    const flight = this.selectedFlight();
    if (!flight) {
      return;
    }

    const flightDate = this.selectedFlightDate(flight);
    if (!flightDate) {
      this.flightCalendarMessage.set('Choose a flight date before adding it to the calendar.');
      this.showToast('Choose a flight date before adding it to the calendar.', 'error');
      return;
    }

    this.isAddingFlightToCalendar.set(true);
    this.flightCalendarMessage.set('');

    try {
      const startDateTime = this.toCalendarDateTime(flightDate, flight.departure.time);
      const endDateTime = this.toCalendarDateTime(flightDate, flight.arrival.time, startDateTime);
      const event: CalendarEvent = {
        title: `${flight.airline.name} ${flight.flightNumber || flight.id} ${flight.departure.airport} to ${flight.arrival.airport}`,
        startDate: this.toDateInputValue(startDateTime),
        endDate: this.toDateInputValue(endDateTime),
        startTime: this.toTimeInputValue(startDateTime),
        endTime: this.toTimeInputValue(endDateTime),
        category: 'Flight',
        location: `${flight.departure.airport} to ${flight.arrival.airport}`,
        price: flight.price * this.travelers(),
        description: [
          `Flight ${flight.flightNumber || flight.id}.`,
          flight.status ? `Status: ${flight.status}.` : '',
          `${flight.airline.name} flight from ${flight.departure.city} (${flight.departure.airport}) to ${flight.arrival.city} (${flight.arrival.airport}).`,
          flight.departure.terminal ? `Departure terminal: ${flight.departure.terminal}.` : '',
          flight.arrival.terminal ? `Arrival terminal: ${flight.arrival.terminal}.` : '',
          `Departure ${flight.departure.time}, arrival ${flight.arrival.time}, duration ${flight.duration}.`,
          flight.stops === 0 ? 'Direct flight.' : `${flight.stopDetails || flight.stops + ' stop(s)'}.`,
          this.baggageSummary(flight),
        ].filter(Boolean).join(' '),
        notes: `Cabin: ${this.cabinClassLabel()}. Travelers: ${this.travelers()}. Price: ${flight.price} ${flight.currency} per traveler.`,
      };
      const result = await this.calendarService.addEventOrRedirectToLogin(event);
      this.flightCalendarMessage.set(
        result === 'added'
          ? 'Added to calendar'
          : 'Continue with login to save this flight to your calendar.'
      );
      this.showToast(
        result === 'added'
          ? 'Flight added to calendar.'
          : 'Continue with login to save this flight to your calendar.',
        result === 'added' ? 'success' : 'info'
      );
    } catch (error) {
      console.error('[FlightsComponent] add flight to calendar failed', error);
      this.flightCalendarMessage.set('Unable to add this flight to the calendar right now.');
      this.showToast('Unable to add this flight to the calendar right now.', 'error');
    } finally {
      this.isAddingFlightToCalendar.set(false);
    }
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

  selectedFlightDate(flight: Flight | null = this.selectedFlight()): Date | null {
    if (!flight) {
      return null;
    }

    if (this.appliedTripType() === 'round-trip' && this.returnFlights().some(returnFlight => returnFlight.id === flight.id)) {
      return this.appliedReturnDate();
    }

    if (this.appliedTripType() === 'multi-city') {
      const segment = this.segmentFlights().find(segmentFlights =>
        segmentFlights.flights.some(segmentFlight => segmentFlight.id === flight.id)
      );
      return segment ? this.parseDateInput(segment.date) : null;
    }

    return this.appliedDepartureDate();
  }

  selectedFlightLegLabel(flight: Flight | null = this.selectedFlight()): string {
    if (!flight) {
      return '';
    }

    if (this.appliedTripType() === 'round-trip' && this.returnFlights().some(returnFlight => returnFlight.id === flight.id)) {
      return 'Return flight';
    }

    if (this.appliedTripType() === 'multi-city') {
      const segment = this.segmentFlights().find(segmentFlights =>
        segmentFlights.flights.some(segmentFlight => segmentFlight.id === flight.id)
      );
      return segment ? `Segment ${segment.segmentIndex}` : 'Multi-city flight';
    }

    return 'Outbound flight';
  }

  selectedFlightTotalPrice(flight: Flight | null = this.selectedFlight()): number {
    return flight ? flight.price * this.travelers() : 0;
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

  cabinClassLabel(): string {
    const labels: Record<CabinClass, string> = {
      economy: 'Economy',
      premium: 'Premium economy',
      business: 'Business',
      first: 'First',
    };

    return labels[this.cabinClass()];
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
    if (this.activeMultiCityDatePicker() !== null) {
      return `Choose segment ${this.activeMultiCityDatePicker()! + 1} date`;
    }

    if (this.tripType() === 'round-trip') {
      return this.returnDate() ? 'Edit trip dates' : 'Choose departure and return';
    }

    return this.activeDatePicker() === 'return' ? 'Choose return date' : 'Choose departure date';
  }

  activeDatePickerHint(): string {
    if (this.manualDateError()) {
      return this.manualDateError();
    }

    if (this.activeMultiCityDatePicker() !== null) {
      return 'Pick the segment date.';
    }

    if (this.tripType() === 'round-trip') {
      return this.activeDatePicker() === 'return'
        ? 'Pick the return date.'
        : 'Pick the departure date.';
    }

    return 'Pick a day or type YYYY-MM-DD.';
  }

  activeDatePickerInputValue(): string {
    return this.manualDateText();
  }

  updateActiveDatePickerInput(value: string): void {
    this.manualDateText.set(value);

    if (!value.trim()) {
      if (this.activeMultiCityDatePicker() !== null) {
        this.updateMultiCityDate(this.activeMultiCityDatePicker()!, '');
        this.manualDateError.set('');
        return;
      }

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

    if (this.isPastDate(parsed)) {
      this.manualDateError.set('Choose today or a future flight date.');
      return;
    }

    if (this.activeMultiCityDatePicker() !== null) {
      this.updateMultiCityDate(this.activeMultiCityDatePicker()!, this.formatDateInput(parsed));
      this.datePickerMonth.set(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      this.manualDateError.set('');
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
    if (this.tripType() === 'round-trip') {
      this.activeDatePicker.set('return');
    }
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
    const departure = this.departureDate() ? this.startOfDay(this.departureDate()!) : null;
    const returnDate = this.returnDate() ? this.startOfDay(this.returnDate()!) : null;
    const multiCityActiveDate = this.activeMultiCityDatePicker() !== null
      ? this.multiCitySegments()[this.activeMultiCityDatePicker()!]?.date ?? null
      : null;

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const current = this.startOfDay(date);

      const activeDate = multiCityActiveDate ?? (this.activeDatePicker() === 'return' ? this.returnDate() : this.departureDate());
      const isRangeStart = !!departure && this.isSameDate(date, departure);
      const isRangeEnd = !!returnDate && this.isSameDate(date, returnDate);
      const shouldShowRange = this.activeMultiCityDatePicker() === null && this.tripType() === 'round-trip';
      const isInRange = shouldShowRange && !!departure && !!returnDate && current > departure && current < returnDate;

      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === month.getMonth(),
        isSelected: shouldShowRange
          ? isRangeStart || isRangeEnd
          : this.isSameDate(date, activeDate),
        isRangeStart: shouldShowRange && isRangeStart,
        isRangeEnd: shouldShowRange && isRangeEnd,
        isInRange,
        isToday: this.isSameDate(date, new Date()),
        isPast: current < this.todayStart(),
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
    const trailingCodeMatch = !codeMatch && !typedCodeMatch
      ? trimmed.match(/(?:^|[\s,\-–—])([A-Za-z]{3})\s*$/)
      : null;
    const typedCode = codeMatch?.[1] ?? typedCodeMatch?.[0] ?? trailingCodeMatch?.[1] ?? '';
    const city = codeMatch
      ? trimmed.slice(0, codeMatch.index).trim()
      : trailingCodeMatch
        ? trimmed.slice(0, trailingCodeMatch.index).trim()
        : trimmed;
    const knownAirport = this.knownAirport(typedCode || city || trimmed);
    const code = typedCode.toUpperCase() || knownAirport?.code || '';

    return {
      code,
      city: knownAirport?.city ?? (city || code),
      fullName: knownAirport?.fullName ?? (code && code === current.code ? current.fullName : (city || code)),
    };
  }

  private normalizeMultiCitySegment(segment: MultiCitySegment): MultiCitySegment {
    return {
      ...segment,
      fromText: this.normalizeAirportText(segment.fromText),
      toText: this.normalizeAirportText(segment.toText),
    };
  }

  private normalizeAirportText(value: string): string {
    const airport = this.parseAirportText(value, { code: '', city: '', fullName: '' });
    return airport.code ? `${airport.city || airport.code} (${airport.code})` : value.trim();
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
    if (this.isPastDate(departure)) return 'Departure date must be today or in the future.';

    if (this.tripType() === 'round-trip') {
      if (!returnDate) return 'Please choose a valid return date for a round trip.';
      if (this.isPastDate(returnDate)) return 'Return date must be today or in the future.';
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
      if (!this.parseAirportText(segment.fromText, { code: '', city: '', fullName: '' }).code
          || !this.parseAirportText(segment.toText, { code: '', city: '', fullName: '' }).code) {
        return `Segment ${i + 1} needs airport codes, for example DUS or Düsseldorf DUS.`;
      }
      if (!segment.date) return `Please choose a valid date for segment ${i + 1}.`;
      if (this.isPastDate(segment.date)) {
        return `Segment ${i + 1} date must be today or in the future.`;
      }

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

  private matchingFlightsForSortMeta(): Flight[] {
    return [
      ...this.matchingFlights(this.flights()),
      ...this.matchingFlights(this.returnFlights()),
      ...this.segmentFlights().flatMap(segment => this.matchingFlights(segment.flights)),
    ];
  }

  private matchingFlights(flights: Flight[]): Flight[] {
    const filters = this.filters();

    return flights.filter(flight => {
      if (flight.price < filters.priceMin || flight.price > filters.priceMax) return false;
      if (filters.airlines[flight.airline.code] === false) return false;
      if (!filters.departureWindows[this.getDepartureWindow(flight.departure.time)]) return false;
      if (filters.carryOnIncluded && !flight.carryOnIncluded) return false;
      if (filters.checkedBagIncluded && !flight.checkedBagIncluded) return false;
      if (flight.stops === 0 && !filters.stops.direct) return false;
      if (flight.stops === 1 && !filters.stops.oneStop) return false;
      if (flight.stops >= 2 && !filters.stops.twoPlus) return false;

      return true;
    });
  }

  private sortMetaFor(sortMode: SortMode, flights: Flight[]): string {
    if (!flights.length) {
      return 'No matches';
    }

    const selectedFlight = this.sortFlights(flights, sortMode)[0];
    return `€${selectedFlight.price} · ${selectedFlight.duration}`;
  }

  private durationMinutes(duration: string): number {
    const hours = duration.match(/(\d+)h/)?.[1] ?? '0';
    const minutes = duration.match(/(\d+)m/)?.[1] ?? '0';

    return Number(hours) * 60 + Number(minutes);
  }

  private toCalendarDateTime(date: Date, time: string, startDateTime?: string): string {
    const [hours = '00', minutes = '00'] = time.split(':');
    const calendarDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(hours), Number(minutes));

    if (startDateTime && calendarDate <= new Date(startDateTime)) {
      calendarDate.setDate(calendarDate.getDate() + 1);
    }

    const year = calendarDate.getFullYear();
    const month = String(calendarDate.getMonth() + 1).padStart(2, '0');
    const day = String(calendarDate.getDate()).padStart(2, '0');
    const hour = String(calendarDate.getHours()).padStart(2, '0');
    const minute = String(calendarDate.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  }

  private toDateInputValue(dateTime: string): string {
    return dateTime.slice(0, 10);
  }

  private toTimeInputValue(dateTime: string): string {
    return dateTime.slice(11, 16);
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

  private todayStart(): Date {
    return this.startOfDay(new Date());
  }

  private isPastDate(date: Date): boolean {
    return this.startOfDay(date) < this.todayStart();
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);

    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }

    this.toastTimeoutId = setTimeout(() => {
      this.toastMessage.set('');
      this.toastTimeoutId = null;
    }, 2600);
  }
}
