import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TripDraftService } from '../trip-draft.service';

interface WizardStep {
  number: number;
  label: string;
  state: 'complete' | 'active' | 'pending';
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

interface Airport {
  code: string;
  city: string;
  fullName: string;
}

interface MultiCitySegment {
  fromText: string;
  toText: string;
  date: string;
}

type DestinationTripType = 'one-way' | 'round-trip' | 'multi-city';

@Component({
  selector: 'app-trip-destination',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './trip-destination.component.html',
  styleUrl: './trip-destination.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDestinationComponent implements OnInit {
  private readonly tripDraftService = inject(TripDraftService);
  private readonly router = inject(Router);

  readonly steps: WizardStep[] = [
    { number: 1, label: 'Budget', state: 'complete' },
    { number: 2, label: 'Destination', state: 'active' },
    { number: 3, label: 'Flights', state: 'pending' },
    { number: 4, label: 'Hotels', state: 'pending' },
    { number: 5, label: 'Activities', state: 'pending' },
    { number: 6, label: 'Overview', state: 'pending' },
  ];

  readonly popularDestinations = [
    'Barcelona',
    'Paris',
    'Rome',
    'Amsterdam',
    'Lisbon',
    'Prague',
    'Vienna',
    'Dubrovnik',
  ];

  readonly tripTypes: { id: DestinationTripType; label: string }[] = [
    { id: 'one-way', label: 'One way' },
    { id: 'round-trip', label: 'Round trip' },
    { id: 'multi-city', label: 'Multi-city' },
  ];

  readonly airports: Airport[] = [
    { code: 'DUS', city: 'Düsseldorf', fullName: 'Düsseldorf Intl.' },
    { code: 'CGN', city: 'Cologne', fullName: 'Cologne Bonn Airport' },
    { code: 'HAM', city: 'Hamburg', fullName: 'Hamburg Airport' },
    { code: 'STR', city: 'Stuttgart', fullName: 'Stuttgart Airport' },
    { code: 'BER', city: 'Berlin', fullName: 'Berlin Brandenburg' },
    { code: 'FRA', city: 'Frankfurt', fullName: 'Frankfurt Airport' },
    { code: 'MUC', city: 'Munich', fullName: 'Munich Airport' },
    { code: 'CDG', city: 'Paris', fullName: 'Charles de Gaulle' },
    { code: 'ORY', city: 'Paris', fullName: 'Paris Orly' },
    { code: 'LHR', city: 'London', fullName: 'Heathrow' },
    { code: 'LGW', city: 'London', fullName: 'Gatwick' },
    { code: 'BCN', city: 'Barcelona', fullName: 'Barcelona-El Prat' },
    { code: 'MAD', city: 'Madrid', fullName: 'Adolfo Suarez Madrid-Barajas' },
    { code: 'FCO', city: 'Rome', fullName: 'Fiumicino' },
    { code: 'CIA', city: 'Rome', fullName: 'Ciampino' },
    { code: 'VIE', city: 'Vienna', fullName: 'Vienna Intl.' },
    { code: 'PRG', city: 'Prague', fullName: 'Vaclav Havel Airport' },
    { code: 'AMS', city: 'Amsterdam', fullName: 'Amsterdam Schiphol' },
    { code: 'LIS', city: 'Lisbon', fullName: 'Humberto Delgado' },
    { code: 'DBV', city: 'Dubrovnik', fullName: 'Dubrovnik Airport' },
    { code: 'ZAG', city: 'Zagreb', fullName: 'Franjo Tudman Airport' },
    { code: 'CPH', city: 'Copenhagen', fullName: 'Copenhagen Airport' },
    { code: 'ARN', city: 'Stockholm', fullName: 'Stockholm Arlanda' },
    { code: 'ATH', city: 'Athens', fullName: 'Athens Intl.' },
    { code: 'IST', city: 'Istanbul', fullName: 'Istanbul Airport' },
    { code: 'BEY', city: 'Beirut', fullName: 'Beirut-Rafic Hariri Intl.' },
    { code: 'AMM', city: 'Amman', fullName: 'Queen Alia Intl.' },
    { code: 'DXB', city: 'Dubai', fullName: 'Dubai Intl.' },
    { code: 'DOH', city: 'Doha', fullName: 'Hamad Intl.' },
    { code: 'JFK', city: 'New York', fullName: 'John F. Kennedy' },
    { code: 'EWR', city: 'New York', fullName: 'Newark Liberty' },
    { code: 'ORD', city: 'Chicago', fullName: 'O Hare Intl.' },
    { code: 'LAX', city: 'Los Angeles', fullName: 'Los Angeles Intl.' },
    { code: 'SFO', city: 'San Francisco', fullName: 'San Francisco Intl.' },
    { code: 'YYZ', city: 'Toronto', fullName: 'Toronto Pearson' },
    { code: 'HND', city: 'Tokyo', fullName: 'Haneda' },
    { code: 'NRT', city: 'Tokyo', fullName: 'Narita Intl.' },
    { code: 'SIN', city: 'Singapore', fullName: 'Changi' },
    { code: 'SYD', city: 'Sydney', fullName: 'Sydney Kingsford Smith' },
  ];

  origin = '';
  destination = '';
  departureDate = '';
  returnDate = '';
  travelers = 2;
  formError = '';
  tripType: DestinationTripType = 'round-trip';
  activeAirportPicker: 'origin' | 'destination' | null = null;
  activeMultiCityAirportPicker: { index: number; key: 'fromText' | 'toText' } | null = null;
  activeDatePicker: 'departure' | 'return' | null = null;
  activeMultiCityDatePicker: number | null = null;
  datePickerMonth = new Date();
  manualDateText = '';
  manualDateError = '';
  multiCitySegments: MultiCitySegment[] = [
    { fromText: '', toText: '', date: '' },
    { fromText: '', toText: '', date: '' },
  ];
  readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  ngOnInit(): void {
    const draft = this.tripDraftService.getDraft();
    this.origin = draft.origin;
    this.destination = draft.destination;
    this.departureDate = draft.departureDate;
    this.returnDate = draft.returnDate;
    this.travelers = draft.travelers;
    this.multiCitySegments = [
      { fromText: draft.origin, toText: draft.destination, date: draft.departureDate },
      { fromText: draft.destination, toText: '', date: draft.returnDate },
    ];
  }

  selectDestination(destination: string): void {
    this.destination = destination;
    this.activeAirportPicker = null;
    this.formError = '';
  }

  setTripType(tripType: DestinationTripType): void {
    this.tripType = tripType;
    this.formError = '';
    this.activeAirportPicker = null;
    this.activeMultiCityAirportPicker = null;

    if (tripType !== 'round-trip') {
      this.activeDatePicker = this.activeDatePicker === 'return' ? null : this.activeDatePicker;
    }
  }

  swapAirports(): void {
    [this.origin, this.destination] = [this.destination, this.origin];
    this.activeAirportPicker = null;
    this.formError = '';
  }

  updateMultiCityText(index: number, key: 'fromText' | 'toText', value: string): void {
    this.multiCitySegments = this.multiCitySegments.map((segment, currentIndex) => (
      currentIndex === index ? { ...segment, [key]: value } : segment
    ));
    this.activeAirportPicker = null;
    this.activeMultiCityAirportPicker = { index, key };
    this.closeDatePicker();
  }

  showMultiCityAirportSuggestions(index: number, key: 'fromText' | 'toText'): void {
    this.activeAirportPicker = null;
    this.activeMultiCityAirportPicker = { index, key };
    this.closeDatePicker();
  }

  multiCityAirportSuggestions(index: number, key: 'fromText' | 'toText'): Airport[] {
    const segment = this.multiCitySegments[index];
    const query = (segment?.[key] ?? '').trim().toLowerCase();

    if (!query) {
      return [];
    }

    const otherText = key === 'fromText' ? segment.toText : segment.fromText;
    const selectedCode = this.parseAirportText(otherText)?.code ?? '';
    const matches = this.airports.filter((airport) => {
      const haystack = `${airport.code} ${airport.city} ${airport.fullName}`.toLowerCase();
      return airport.code !== selectedCode && haystack.includes(query);
    });

    return matches.slice(0, 6);
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
    this.formError = '';
  }

  addMultiCitySegment(): void {
    const previous = this.multiCitySegments[this.multiCitySegments.length - 1];
    this.multiCitySegments = [
      ...this.multiCitySegments,
      {
        fromText: previous?.toText ?? '',
        toText: '',
        date: this.nextSegmentDate(previous?.date || this.departureDate),
      },
    ];
  }

  removeMultiCitySegment(index: number): void {
    if (this.multiCitySegments.length <= 2) {
      return;
    }

    this.multiCitySegments = this.multiCitySegments.filter((_, currentIndex) => currentIndex !== index);
    if (this.activeMultiCityDatePicker === index) {
      this.closeDatePicker();
    }
  }

  updateAirportText(kind: 'origin' | 'destination', value: string): void {
    if (kind === 'origin') {
      this.origin = value;
    } else {
      this.destination = value;
    }

    this.activeAirportPicker = kind;
    this.closeDatePicker();
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

    const otherText = kind === 'origin' ? this.destination : this.origin;
    const selectedCode = this.parseAirportText(otherText)?.code ?? '';
    const matches = this.airports.filter((airport) => {
      const haystack = `${airport.code} ${airport.city} ${airport.fullName}`.toLowerCase();
      return airport.code !== selectedCode && haystack.includes(query);
    });

    return matches.slice(0, 6);
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

  changeTravelers(change: number): void {
    this.travelers = Math.min(10, Math.max(1, this.travelers + change));
  }

  toggleDatePicker(kind: 'departure' | 'return'): void {
    if (this.activeDatePicker === kind) {
      this.closeDatePicker();
      return;
    }

    const selectedDate = this.parseDateInput(kind === 'departure' ? this.departureDate : this.returnDate);
    const fallbackDate = this.parseDateInput(this.departureDate) ?? new Date();

    this.activeDatePicker = kind;
    this.activeAirportPicker = null;
    this.activeMultiCityAirportPicker = null;
    this.activeMultiCityDatePicker = null;
    this.datePickerMonth = this.firstDayOfMonth(selectedDate ?? fallbackDate);
    this.manualDateText = this.formatDateInput(selectedDate);
    this.manualDateError = '';
  }

  toggleMultiCityDatePicker(index: number): void {
    if (this.activeMultiCityDatePicker === index) {
      this.closeDatePicker();
      return;
    }

    const selectedDate = this.parseDateInput(this.multiCitySegments[index]?.date ?? '');
    const fallbackDate = selectedDate ?? this.parseDateInput(this.departureDate) ?? new Date();

    this.activeDatePicker = null;
    this.activeAirportPicker = null;
    this.activeMultiCityAirportPicker = null;
    this.activeMultiCityDatePicker = index;
    this.datePickerMonth = this.firstDayOfMonth(fallbackDate);
    this.manualDateText = this.formatDateInput(selectedDate);
    this.manualDateError = '';
  }

  closeDatePicker(): void {
    this.activeDatePicker = null;
    this.activeMultiCityDatePicker = null;
    this.manualDateError = '';
  }

  moveDatePickerMonth(offset: number): void {
    this.datePickerMonth = new Date(
      this.datePickerMonth.getFullYear(),
      this.datePickerMonth.getMonth() + offset,
      1,
    );
  }

  selectCalendarDate(date: Date): void {
    const selected = this.startOfDay(date);
    const selectedValue = this.formatDateInput(selected);

    if (this.activeMultiCityDatePicker !== null) {
      this.multiCitySegments = this.multiCitySegments.map((segment, index) => (
        index === this.activeMultiCityDatePicker ? { ...segment, date: selectedValue } : segment
      ));
      this.closeDatePicker();
      return;
    }

    if (this.activeDatePicker === 'return') {
      const departure = this.parseDateInput(this.departureDate);

      if (departure && selected <= departure) {
        this.manualDateError = 'Return date must be after departure.';
        return;
      }

      this.returnDate = selectedValue;
      this.closeDatePicker();
      return;
    }

    this.departureDate = selectedValue;

    // Keep the trip range valid when a new departure is picked after the current return.
    const returnDate = this.parseDateInput(this.returnDate);
    if (returnDate && selected >= returnDate) {
      this.returnDate = '';
    }

    this.activeDatePicker = 'return';
    this.datePickerMonth = this.firstDayOfMonth(selected);
    this.manualDateText = this.returnDate;
    this.manualDateError = '';
  }

  updateActiveDatePickerInput(value: string): void {
    this.manualDateText = value;

    if (!value.trim()) {
      this.manualDateError = this.activeDatePicker === 'return'
        ? 'Enter a return date.'
        : 'Enter a departure date.';
      return;
    }

    const parsed = this.parseDateInput(value);
    if (!parsed) {
      this.manualDateError = 'Use a valid date in YYYY-MM-DD format.';
      return;
    }

    this.datePickerMonth = this.firstDayOfMonth(parsed);

    if (this.activeMultiCityDatePicker !== null) {
      this.multiCitySegments = this.multiCitySegments.map((segment, index) => (
        index === this.activeMultiCityDatePicker ? { ...segment, date: this.formatDateInput(parsed) } : segment
      ));
      this.manualDateError = '';
      return;
    }

    if (this.activeDatePicker === 'return') {
      const departure = this.parseDateInput(this.departureDate);
      if (departure && parsed <= departure) {
        this.manualDateError = 'Return date must be after departure.';
        return;
      }

      this.returnDate = this.formatDateInput(parsed);
      this.manualDateError = '';
      return;
    }

    const returnDate = this.parseDateInput(this.returnDate);
    if (returnDate && parsed >= returnDate) {
      this.manualDateError = 'Departure date must be before return.';
      return;
    }

    this.departureDate = this.formatDateInput(parsed);
    this.manualDateError = '';
  }

  activeDatePickerTitle(): string {
    if (this.activeMultiCityDatePicker !== null) {
      return `Choose segment ${this.activeMultiCityDatePicker + 1} date`;
    }

    return this.activeDatePicker === 'return'
      ? 'Choose return date'
      : 'Choose departure date';
  }

  activeDatePickerHint(): string {
    if (this.manualDateError) {
      return this.manualDateError;
    }

    if (this.activeMultiCityDatePicker !== null) {
      return 'Pick the segment date.';
    }

    return this.activeDatePicker === 'return'
      ? 'Pick the return date.'
      : 'Pick the departure date.';
  }

  datePickerMonthLabel(): string {
    return this.datePickerMonth.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }

  calendarDays(): CalendarDay[] {
    const firstDay = new Date(this.datePickerMonth.getFullYear(), this.datePickerMonth.getMonth(), 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - mondayOffset);

    const departure = this.parseDateInput(this.departureDate);
    const returnDate = this.parseDateInput(this.returnDate);
    const multiCityDate = this.activeMultiCityDatePicker !== null
      ? this.parseDateInput(this.multiCitySegments[this.activeMultiCityDatePicker]?.date ?? '')
      : null;
    const activeDate = multiCityDate ?? (this.activeDatePicker === 'return' ? returnDate : departure);
    const shouldShowRange = this.activeMultiCityDatePicker === null;

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const current = this.startOfDay(date);
      const isRangeStart = this.isSameDate(current, departure);
      const isRangeEnd = this.isSameDate(current, returnDate);

      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === this.datePickerMonth.getMonth(),
        isSelected: shouldShowRange ? isRangeStart || isRangeEnd : this.isSameDate(current, activeDate),
        isRangeStart: shouldShowRange && isRangeStart,
        isRangeEnd: shouldShowRange && isRangeEnd,
        isInRange: shouldShowRange && !!departure && !!returnDate && current > departure && current < returnDate,
        isToday: this.isSameDate(current, new Date()),
      };
    });
  }

  formatDate(value: string): string {
    const date = this.parseDateInput(value);

    if (!date) {
      return 'Choose date';
    }

    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }

  formatYear(value: string): string {
    const date = this.parseDateInput(value);
    return date ? String(date.getFullYear()) : 'Trip date';
  }

  continueToFlights(form: NgForm): void {
    this.formError = '';

    if (this.tripType === 'multi-city') {
      const normalizedSegments = this.multiCitySegments.map((segment) => ({
        fromText: segment.fromText.trim(),
        toText: segment.toText.trim(),
        date: segment.date,
      }));

      if (normalizedSegments.length < 2 || normalizedSegments.some((segment) => !segment.fromText || !segment.toText || !segment.date)) {
        this.formError = 'Complete each multi-city origin, destination, and date to continue.';
        return;
      }

      this.tripDraftService.updateDraft({
        origin: normalizedSegments[0].fromText,
        destination: normalizedSegments[normalizedSegments.length - 1].toText,
        departureDate: normalizedSegments[0].date,
        returnDate: normalizedSegments[normalizedSegments.length - 1].date,
        travelers: this.travelers,
      });

      void this.router.navigate(['/flights'], {
        queryParams: {
          tripType: this.tripType,
          travelers: this.travelers,
          multiCitySegments: JSON.stringify(normalizedSegments),
        },
      });
      return;
    }

    if (
      form.invalid
      || !this.origin.trim()
      || !this.destination.trim()
      || !this.departureDate
      || (this.tripType === 'round-trip' && !this.returnDate)
    ) {
      this.formError = this.tripType === 'round-trip'
        ? 'Complete the origin, destination, and travel dates to continue.'
        : 'Complete the origin, destination, and departure date to continue.';
      return;
    }

    if (this.tripType === 'round-trip' && this.returnDate <= this.departureDate) {
      this.formError = 'Return date must be after the departure date.';
      return;
    }

    const returnDate = this.tripType === 'round-trip' ? this.returnDate : '';

    this.tripDraftService.updateDraft({
      origin: this.origin.trim(),
      destination: this.destination.trim(),
      departureDate: this.departureDate,
      returnDate,
      travelers: this.travelers,
    });

    void this.router.navigate(['/flights'], {
      queryParams: {
        from: this.origin.trim(),
        to: this.destination.trim(),
        departureDate: this.departureDate,
        returnDate,
        travelers: this.travelers,
        tripType: this.tripType,
      },
    });
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

    return this.startOfDay(date);
  }

  private formatDateInput(date: Date | null): string {
    if (!date) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private firstDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
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

  private nextSegmentDate(value: string): string {
    const date = this.parseDateInput(value);

    if (!date) {
      return '';
    }

    const next = new Date(date);
    next.setDate(date.getDate() + 1);

    return this.formatDateInput(next);
  }

  private parseAirportText(value: string): Airport | null {
    const trimmed = value.trim();
    const codeMatch = trimmed.match(/\(([A-Za-z]{3})\)\s*$/);
    const typedCodeMatch = trimmed.match(/^[A-Za-z]{3}$/);
    const trailingCodeMatch = !codeMatch && !typedCodeMatch
      ? trimmed.match(/(?:^|[\s,\-–—])([A-Za-z]{3})\s*$/)
      : null;
    const typedCode = (codeMatch?.[1] ?? typedCodeMatch?.[0] ?? trailingCodeMatch?.[1] ?? '').toUpperCase();
    const city = codeMatch
      ? trimmed.slice(0, codeMatch.index).trim()
      : trailingCodeMatch
        ? trimmed.slice(0, trailingCodeMatch.index).trim()
        : trimmed;

    return this.airports.find((airport) => (
      airport.code === typedCode
      || airport.city.toLowerCase() === city.toLowerCase()
      || airport.fullName.toLowerCase() === trimmed.toLowerCase()
    )) ?? null;
  }
}
