import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TripTempService } from '../trip-temp.service';

interface WizardStep {
  number: number;
  label: string;
  state: 'complete' | 'active' | 'pending';
}

interface Airport {
  code: string;
  city: string;
  fullName: string;
}

type TripType = 'one-way' | 'round-trip' | 'multi-city';

interface MultiCitySegment {
  fromText: string;
  toText: string;
  date: string;
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
}

@Component({
  selector: 'app-trip-destination',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './trip-destination.component.html',
  styleUrl: './trip-destination.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDestinationComponent implements OnInit {
  private readonly tripTempService = inject(TripTempService);
  private readonly router = inject(Router);

  readonly steps: WizardStep[] = [
    { number: 1, label: 'Budget', state: 'complete' },
    { number: 2, label: 'Destination', state: 'active' },
    { number: 3, label: 'Flights', state: 'pending' },
    { number: 4, label: 'Hotels', state: 'pending' },
    { number: 5, label: 'Activities', state: 'pending' },
    { number: 6, label: 'Overview', state: 'pending' },
  ];

  readonly tripTypes: { id: TripType; label: string }[] = [
    { id: 'one-way', label: 'One way' },
    { id: 'round-trip', label: 'Round trip' },
    { id: 'multi-city', label: 'Multi-city' },
  ];

  readonly airports: Airport[] = [
    { code: 'FRA', city: 'Frankfurt', fullName: 'Frankfurt Airport' },
    { code: 'DUS', city: 'Dusseldorf', fullName: 'Dusseldorf Airport' },
    { code: 'MUC', city: 'Munich', fullName: 'Munich Airport' },
    { code: 'BER', city: 'Berlin', fullName: 'Berlin Brandenburg' },
    { code: 'HAM', city: 'Hamburg', fullName: 'Hamburg Airport' },
    { code: 'CGN', city: 'Cologne', fullName: 'Cologne Bonn Airport' },
    { code: 'STR', city: 'Stuttgart', fullName: 'Stuttgart Airport' },
    { code: 'HAJ', city: 'Hannover', fullName: 'Hannover Airport' },
    { code: 'NUE', city: 'Nuremberg', fullName: 'Nuremberg Airport' },
    { code: 'BRE', city: 'Bremen', fullName: 'Bremen Airport' },
    { code: 'DTM', city: 'Dortmund', fullName: 'Dortmund Airport' },
    { code: 'LEJ', city: 'Leipzig', fullName: 'Leipzig/Halle Airport' },
    { code: 'BCN', city: 'Barcelona', fullName: 'Barcelona-El Prat' },
    { code: 'MAD', city: 'Madrid', fullName: 'Adolfo Suarez Madrid-Barajas' },
    { code: 'PMI', city: 'Palma de Mallorca', fullName: 'Palma de Mallorca Airport' },
    { code: 'AGP', city: 'Malaga', fullName: 'Malaga-Costa del Sol' },
    { code: 'CDG', city: 'Paris', fullName: 'Charles de Gaulle' },
    { code: 'ORY', city: 'Paris', fullName: 'Paris Orly' },
    { code: 'NCE', city: 'Nice', fullName: 'Nice Cote d Azur' },
    { code: 'LYS', city: 'Lyon', fullName: 'Lyon-Saint Exupery' },
    { code: 'FCO', city: 'Rome', fullName: 'Fiumicino' },
    { code: 'MXP', city: 'Milan', fullName: 'Milan Malpensa' },
    { code: 'LIN', city: 'Milan', fullName: 'Milan Linate' },
    { code: 'VCE', city: 'Venice', fullName: 'Venice Marco Polo' },
    { code: 'NAP', city: 'Naples', fullName: 'Naples International' },
    { code: 'AMS', city: 'Amsterdam', fullName: 'Amsterdam Schiphol' },
    { code: 'BRU', city: 'Brussels', fullName: 'Brussels Airport' },
    { code: 'ZRH', city: 'Zurich', fullName: 'Zurich Airport' },
    { code: 'GVA', city: 'Geneva', fullName: 'Geneva Airport' },
    { code: 'CPH', city: 'Copenhagen', fullName: 'Copenhagen Airport' },
    { code: 'ARN', city: 'Stockholm', fullName: 'Stockholm Arlanda' },
    { code: 'OSL', city: 'Oslo', fullName: 'Oslo Gardermoen' },
    { code: 'HEL', city: 'Helsinki', fullName: 'Helsinki Airport' },
    { code: 'LIS', city: 'Lisbon', fullName: 'Humberto Delgado' },
    { code: 'OPO', city: 'Porto', fullName: 'Francisco Sa Carneiro' },
    { code: 'PRG', city: 'Prague', fullName: 'Vaclav Havel Airport' },
    { code: 'VIE', city: 'Vienna', fullName: 'Vienna Intl.' },
    { code: 'BUD', city: 'Budapest', fullName: 'Budapest Ferenc Liszt' },
    { code: 'WAW', city: 'Warsaw', fullName: 'Warsaw Chopin' },
    { code: 'KRK', city: 'Krakow', fullName: 'John Paul II Krakow-Balice' },
    { code: 'ATH', city: 'Athens', fullName: 'Athens International' },
    { code: 'IST', city: 'Istanbul', fullName: 'Istanbul Airport' },
    { code: 'LHR', city: 'London', fullName: 'Heathrow' },
    { code: 'LGW', city: 'London', fullName: 'Gatwick' },
    { code: 'STN', city: 'London', fullName: 'Stansted' },
    { code: 'MAN', city: 'Manchester', fullName: 'Manchester Airport' },
    { code: 'EDI', city: 'Edinburgh', fullName: 'Edinburgh Airport' },
    { code: 'DUB', city: 'Dublin', fullName: 'Dublin Airport' },
    { code: 'DXB', city: 'Dubai', fullName: 'Dubai Intl.' },
    { code: 'DOH', city: 'Doha', fullName: 'Hamad International' },
    { code: 'AUH', city: 'Abu Dhabi', fullName: 'Zayed International' },
    { code: 'SIN', city: 'Singapore', fullName: 'Changi Airport' },
    { code: 'BKK', city: 'Bangkok', fullName: 'Suvarnabhumi' },
    { code: 'HND', city: 'Tokyo', fullName: 'Haneda' },
    { code: 'NRT', city: 'Tokyo', fullName: 'Narita' },
    { code: 'ICN', city: 'Seoul', fullName: 'Incheon International' },
    { code: 'JFK', city: 'New York', fullName: 'John F. Kennedy' },
    { code: 'EWR', city: 'New York', fullName: 'Newark Liberty' },
    { code: 'LAX', city: 'Los Angeles', fullName: 'Los Angeles International' },
    { code: 'SFO', city: 'San Francisco', fullName: 'San Francisco International' },
    { code: 'ORD', city: 'Chicago', fullName: 'O Hare International' },
    { code: 'MIA', city: 'Miami', fullName: 'Miami International' },
    { code: 'YYZ', city: 'Toronto', fullName: 'Toronto Pearson' },
  ];

  readonly popularDestinations = ['Barcelona', 'Paris', 'Rome', 'Amsterdam', 'Lisbon', 'Prague', 'Vienna'];

  tripType: TripType = 'round-trip';
  origin = '';
  destination = '';
  departureDate = '';
  returnDate = '';
  travelers = 2;
  formError = '';
  activeDatePicker: 'departure' | 'return' | null = null;
  activeMultiCityDatePicker: number | null = null;
  datePickerMonth = new Date();
  manualDateText = '';
  manualDateError = '';
  activeAirportPicker: 'origin' | 'destination' | null = null;
  activeMultiCityAirportPicker: { index: number; key: 'fromText' | 'toText' } | null = null;
  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  multiCitySegments: MultiCitySegment[] = [
    { fromText: '', toText: '', date: '' },
    { fromText: '', toText: '', date: '' },
  ];

  ngOnInit(): void {
    const tripTemp = this.tripTempService.getTripTemp();
    this.origin = tripTemp.origin;
    this.destination = tripTemp.destination;
    this.departureDate = tripTemp.departureDate;
    this.returnDate = tripTemp.returnDate;
    this.travelers = tripTemp.travelers;
    this.multiCitySegments = [
      { fromText: tripTemp.origin, toText: tripTemp.destination, date: tripTemp.departureDate },
      { fromText: tripTemp.destination, toText: '', date: tripTemp.returnDate },
    ];
  }

  setTripType(tripType: TripType): void {
    this.tripType = tripType;
    this.formError = '';
    this.activeAirportPicker = null;
    this.activeMultiCityAirportPicker = null;
    this.closeDatePicker();
  }

  updateAirportText(kind: 'origin' | 'destination', value: string): void {
    if (kind === 'origin') {
      this.origin = value;
    } else {
      this.destination = value;
    }

    this.activeAirportPicker = kind;
  }

  showAirportSuggestions(kind: 'origin' | 'destination'): void {
    this.activeAirportPicker = kind;
    this.closeDatePicker();
  }

  airportSuggestions(kind: 'origin' | 'destination'): Airport[] {
    const query = (kind === 'origin' ? this.origin : this.destination).trim().toLowerCase();

    if (!query) {
      return [];
    }

    return this.airports.filter((airport) => {
      const searchable = `${airport.code} ${airport.city} ${airport.fullName}`.toLowerCase();
      return searchable.includes(query);
    }).slice(0, 6);
  }

  selectAirport(kind: 'origin' | 'destination', airport: Airport): void {
    const value = `${airport.city} (${airport.code})`;

    if (kind === 'origin') {
      this.origin = value;
    } else {
      this.destination = value;
    }

    this.activeAirportPicker = null;
    this.formError = '';
  }

  swapAirports(): void {
    [this.origin, this.destination] = [this.destination, this.origin];
  }

  selectDestination(destination: string): void {
    this.destination = destination;
    this.formError = '';
  }

  changeTravelers(change: number): void {
    this.travelers = Math.min(10, Math.max(1, this.travelers + change));
  }

  updateMultiCityText(index: number, key: keyof MultiCitySegment, value: string): void {
    this.multiCitySegments = this.multiCitySegments.map((segment, currentIndex) => (
      currentIndex === index ? { ...segment, [key]: value } : segment
    ));
    this.activeAirportPicker = null;
    this.activeMultiCityAirportPicker = key === 'date' ? null : { index, key };
  }

  showMultiCityAirportSuggestions(index: number, key: 'fromText' | 'toText'): void {
    this.activeAirportPicker = null;
    this.closeDatePicker();
    this.activeMultiCityAirportPicker = { index, key };
  }

  multiCityAirportSuggestions(index: number, key: 'fromText' | 'toText'): Airport[] {
    const query = (this.multiCitySegments[index]?.[key] ?? '').trim().toLowerCase();

    if (!query) {
      return [];
    }

    return this.airports.filter((airport) => {
      const searchable = `${airport.code} ${airport.city} ${airport.fullName}`.toLowerCase();
      return searchable.includes(query);
    }).slice(0, 6);
  }

  isMultiCityAirportPickerOpen(index: number, key: 'fromText' | 'toText'): boolean {
    return this.activeMultiCityAirportPicker?.index === index
      && this.activeMultiCityAirportPicker.key === key;
  }

  selectMultiCityAirport(index: number, key: 'fromText' | 'toText', airport: Airport): void {
    const value = `${airport.city} (${airport.code})`;
    this.multiCitySegments = this.multiCitySegments.map((segment, currentIndex) => (
      currentIndex === index ? { ...segment, [key]: value } : segment
    ));
    this.activeMultiCityAirportPicker = null;
  }

  addMultiCitySegment(): void {
    const previous = this.multiCitySegments[this.multiCitySegments.length - 1];
    this.multiCitySegments = [
      ...this.multiCitySegments,
      { fromText: previous?.toText ?? '', toText: '', date: '' },
    ];
  }

  removeMultiCitySegment(index: number): void {
    if (this.multiCitySegments.length <= 2) {
      return;
    }

    this.multiCitySegments = this.multiCitySegments.filter((_, currentIndex) => currentIndex !== index);
  }

  toggleDatePicker(kind: 'departure' | 'return'): void {
    if (kind === 'return' && this.tripType !== 'round-trip') {
      return;
    }

    this.activeAirportPicker = null;
    this.activeMultiCityAirportPicker = null;
    this.activeMultiCityDatePicker = null;
    this.activeDatePicker = this.activeDatePicker === kind ? null : kind;
    this.syncDatePickerState(this.dateStringForPicker(kind));
  }

  toggleMultiCityDatePicker(index: number): void {
    this.activeAirportPicker = null;
    this.activeMultiCityAirportPicker = null;
    this.activeDatePicker = null;
    this.activeMultiCityDatePicker = this.activeMultiCityDatePicker === index ? null : index;
    this.syncDatePickerState(this.multiCitySegments[index]?.date ?? '');
  }

  closeDatePicker(): void {
    this.activeDatePicker = null;
    this.activeMultiCityDatePicker = null;
    this.manualDateError = '';
  }

  clearReturnDate(): void {
    this.returnDate = '';
    this.manualDateText = '';
    this.manualDateError = '';
  }

  moveDatePickerMonth(change: number): void {
    this.datePickerMonth = new Date(
      this.datePickerMonth.getFullYear(),
      this.datePickerMonth.getMonth() + change,
      1,
    );
  }

  selectCalendarDate(date: Date): void {
    const value = this.formatDateInput(date);

    if (this.activeMultiCityDatePicker !== null) {
      this.updateMultiCityDate(this.activeMultiCityDatePicker, value);
      this.manualDateText = value;
      this.manualDateError = '';
      return;
    }

    if (this.activeDatePicker === 'return') {
      const departure = this.parseDateInput(this.departureDate);

      if (departure && this.startOfDay(date) < this.startOfDay(departure)) {
        this.manualDateError = 'Return date cannot be before departure.';
        return;
      }

      this.returnDate = value;
      this.manualDateText = value;
      this.manualDateError = '';
      this.closeDatePicker();
      return;
    }

    const returnDate = this.parseDateInput(this.returnDate);

    if (returnDate && this.startOfDay(date) > this.startOfDay(returnDate)) {
      this.manualDateError = 'Departure date cannot be after return.';
      return;
    }

    this.departureDate = value;
    this.manualDateText = value;
    this.manualDateError = '';

    if (this.tripType === 'round-trip') {
      this.activeDatePicker = 'return';
      this.syncDatePickerState(this.returnDate);
    }
  }

  activeDatePickerTitle(): string {
    if (this.activeMultiCityDatePicker !== null) {
      return `Choose segment ${this.activeMultiCityDatePicker + 1} date`;
    }

    if (this.tripType === 'round-trip') {
      return this.returnDate ? 'Edit trip dates' : 'Choose departure and return';
    }

    return this.activeDatePicker === 'return' ? 'Choose return date' : 'Choose departure date';
  }

  activeDatePickerHint(): string {
    if (this.manualDateError) {
      return this.manualDateError;
    }

    if (this.activeMultiCityDatePicker !== null) {
      return 'Pick the segment date.';
    }

    if (this.tripType === 'round-trip') {
      return this.activeDatePicker === 'return' ? 'Pick the return date.' : 'Pick the departure date.';
    }

    return 'Pick a day or type YYYY-MM-DD.';
  }

  updateActiveDatePickerInput(value: string): void {
    this.manualDateText = value;

    if (!value.trim()) {
      if (this.activeMultiCityDatePicker !== null) {
        this.updateMultiCityDate(this.activeMultiCityDatePicker, '');
        this.manualDateError = '';
        return;
      }

      if (this.activeDatePicker === 'return') {
        this.clearReturnDate();
        return;
      }

      this.manualDateError = 'Enter a departure date.';
      return;
    }

    const parsed = this.parseDateInput(value);

    if (!parsed) {
      this.manualDateError = 'Use a valid date in YYYY-MM-DD format.';
      return;
    }

    this.datePickerMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    this.selectCalendarDate(parsed);
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
    const departure = this.parseDateInput(this.departureDate);
    const returnDate = this.parseDateInput(this.returnDate);
    const multiCityActiveDate = this.activeMultiCityDatePicker !== null
      ? this.parseDateInput(this.multiCitySegments[this.activeMultiCityDatePicker]?.date ?? '')
      : null;
    const shouldShowRange = this.activeMultiCityDatePicker === null && this.tripType === 'round-trip';

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const current = this.startOfDay(date);
      const activeDate = multiCityActiveDate ?? (this.activeDatePicker === 'return' ? returnDate : departure);
      const isRangeStart = !!departure && this.isSameDate(date, departure);
      const isRangeEnd = !!returnDate && this.isSameDate(date, returnDate);

      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === month.getMonth(),
        isSelected: shouldShowRange ? isRangeStart || isRangeEnd : this.isSameDate(date, activeDate),
        isRangeStart: shouldShowRange && isRangeStart,
        isRangeEnd: shouldShowRange && isRangeEnd,
        isInRange: shouldShowRange && !!departure && !!returnDate && current > departure && current < returnDate,
        isToday: this.isSameDate(date, new Date()),
      };
    });
  }

  formatDate(value: string | Date | null): string {
    const date = value instanceof Date ? value : this.parseDateInput(value ?? '');

    if (!date) {
      return 'Choose date';
    }

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  }

  formatYear(value: string | Date | null): string {
    const date = value instanceof Date ? value : this.parseDateInput(value ?? '');
    return date ? String(date.getFullYear()) : 'YYYY-MM-DD';
  }

  continueToFlights(form: NgForm): void {
    this.formError = '';

    if (this.tripType === 'multi-city') {
      const segments = this.multiCitySegments.map((segment) => ({
        fromText: this.normalizeAirportText(segment.fromText),
        toText: this.normalizeAirportText(segment.toText),
        date: segment.date,
      }));

      if (segments.some((segment) => !segment.fromText || !segment.toText || !segment.date)) {
        this.formError = 'Complete each multi-city origin, destination, and date to continue.';
        return;
      }

      this.tripTempService.updateTripTemp({
        origin: segments[0].fromText,
        destination: segments[segments.length - 1].toText,
        departureDate: segments[0].date,
        returnDate: segments[segments.length - 1].date,
        travelers: this.travelers,
      });

      void this.router.navigate(['/trips/create/flights'], {
        queryParams: {
          tripType: this.tripType,
          travelers: this.travelers,
          multiCitySegments: JSON.stringify(segments),
        },
      });
      return;
    }

    if (form.invalid || !this.origin.trim() || !this.destination.trim() || !this.departureDate || (this.tripType === 'round-trip' && !this.returnDate)) {
      this.formError = 'Complete the origin, destination, and travel dates to continue.';
      return;
    }

    const returnDate = this.tripType === 'round-trip' ? this.returnDate : '';
    const origin = this.normalizeAirportText(this.origin);
    const destination = this.normalizeAirportText(this.destination);

    this.tripTempService.updateTripTemp({
      origin,
      destination,
      departureDate: this.departureDate,
      returnDate,
      travelers: this.travelers,
    });

    void this.router.navigate(['/trips/create/flights'], {
      queryParams: {
        from: origin,
        to: destination,
        departureDate: this.departureDate,
        returnDate,
        travelers: this.travelers,
        tripType: this.tripType,
      },
    });
  }

  private syncDatePickerState(value: string): void {
    const parsed = this.parseDateInput(value);
    this.manualDateText = value;
    this.manualDateError = '';
    this.datePickerMonth = parsed
      ? new Date(parsed.getFullYear(), parsed.getMonth(), 1)
      : new Date();
  }

  private dateStringForPicker(kind: 'departure' | 'return'): string {
    return kind === 'return' ? this.returnDate : this.departureDate;
  }

  private updateMultiCityDate(index: number, date: string): void {
    this.multiCitySegments = this.multiCitySegments.map((segment, currentIndex) => (
      currentIndex === index ? { ...segment, date } : segment
    ));
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private parseDateInput(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return null;
    }

    const [year, month, day] = trimmed.split('-').map(Number);
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
    if (!a || !b) {
      return false;
    }

    return (
      a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate()
    );
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private normalizeAirportText(value: string): string {
    const trimmed = value.trim();
    const existingCode = trimmed.match(/\(([A-Za-z]{3})\)$/)?.[1];

    if (existingCode) {
      return trimmed;
    }

    const airport = this.airports.find((candidate) => (
      candidate.code.toLowerCase() === trimmed.toLowerCase()
      || candidate.city.toLowerCase() === trimmed.toLowerCase()
      || candidate.fullName.toLowerCase() === trimmed.toLowerCase()
    ));

    return airport ? `${airport.city} (${airport.code})` : trimmed;
  }
}
