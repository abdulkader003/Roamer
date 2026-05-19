import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import {
  CalendarEvent,
  EventCardComponent
} from '../../components/event-card/event-card.component';

type EventCategory =
  | 'Flight'
  | 'Hotel'
  | 'Event'
  | 'Activity'
  | 'Attraction'
  | 'Beach'
  | 'Party';

type EventDraft = {
  title: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  category: EventCategory;
  budget: string | number;
  notes: string;
};

type BackendCalendarEvent = {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  category?: string | null;
  budgetCost?: number | null;
  notes?: string | null;
};

@Component({
  selector: 'app-calendar-month',
  imports: [CommonModule, FormsModule, EventCardComponent],
  templateUrl: './calendar-month.html',
  styleUrl: './calendar-month.css'
})
export class CalendarMonth {
  private readonly calendarApiBaseUrl = 'http://localhost:8080/api/calendar-events';
  private readonly requestTimeoutMs = 5000;
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  viewMode: 'month' | 'week' = 'month';
  selectedDay: number | null = null;

  today = new Date();
  currentDate: Date = new Date();

  currentMonth = '';
  days: number[] = [];
  prevMonthDays: number[] = [];
  nextMonthDays: number[] = [];
  weekDays: Date[] = [];

  isEventDrawerOpen = false;
  selectedEvent: CalendarEvent | null = null;
  deleteConfirmationEvent: CalendarEvent | null = null;
  editingEventId: number | null = null;
  formError = '';
  hasAttemptedSave = false;
  isSaving = false;
  isDeleting = false;
  toastMessage = '';

  events: CalendarEvent[] = [];

  searchTerm: string = '';
  searchResults: CalendarEvent[] = [];

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value.trim().toLowerCase();
    this.updateSearchResults();
  }

  openEventDetails(event: CalendarEvent) {
    this.selectedEvent = event;
    this.searchResults = [];
    this.searchTerm = '';
  }

  eventCategories: EventCategory[] = [
    'Flight',
    'Hotel',
    'Event',
    'Activity',
    'Attraction',
    'Beach',
    'Party'
  ];

  eventDraft: EventDraft = this.createEmptyEventDraft();

  ngOnInit() {
    this.generateCalendar();
    this.loadCalendarEvents();
  }

  get isEditingEvent(): boolean {
    return this.editingEventId !== null;
  }

  get eventDrawerTitle(): string {
    return this.isEditingEvent ? 'Edit Event' : 'Add Event';
  }

  get saveButtonLabel(): string {
    if (this.isSaving) {
      return this.isEditingEvent ? 'Saving Changes...' : 'Adding Event...';
    }

    return this.isEditingEvent ? 'Save Changes' : 'Add Event';
  }

  get visibleFormMessage(): string {
    if (this.formError) {
      return this.formError;
    }

    if (!this.hasAttemptedSave) {
      return '';
    }

    return this.getDraftValidationError();
  }

  get isSaveDisabled(): boolean {
    return this.isSaving || this.isDeleting;
  }

  generateCalendar() {
    this.buildCalendar();
    this.generateWeekDays();
  }

  buildCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    this.currentMonth = this.currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    this.days = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

    const firstDay = new Date(year, month, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1;

    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    this.prevMonthDays = Array.from(
      { length: startDay },
      (_, i) => daysInPreviousMonth - startDay + i + 1
    );

    const usedCells = startDay + daysInCurrentMonth;
    const nextDaysCount = (7 - (usedCells % 7)) % 7;
    this.nextMonthDays = Array.from({ length: nextDaysCount }, (_, i) => i + 1);
  }

  generateWeekDays() {
    const baseDate = new Date(this.currentDate);

    const dayOfWeek = baseDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + mondayOffset);

    this.weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date;
    });
  }

  async loadCalendarEvents() {
    try {
      const response = await this.fetchCalendarApi('');

      if (!response.ok) {
        throw new Error(`Failed to load events: ${response.status}`);
      }

      const backendEvents: BackendCalendarEvent[] = await response.json();

      this.events = backendEvents.map((event) => this.mapBackendEvent(event));
      this.updateSearchResults();
      this.refreshSelectedEvent();
      this.cdr.detectChanges();
    } catch (error) {
      this.showToast(this.getRequestErrorMessage(error, 'load'));
    }
  }

  setViewMode(mode: 'month' | 'week') {
    this.viewMode = mode;
    this.generateCalendar();
  }

  selectDay(day: number) {
    this.selectedDay = this.selectedDay === day ? null : day;
  }

  goToPreviousMonth() {
    if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() - 7);
    } else {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    }

    this.generateCalendar();
  }

  goToNextMonth() {
    if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
    } else {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    }

    this.generateCalendar();
  }

  goToToday() {
    this.currentDate = new Date();
    this.selectedDay = this.today.getDate();
    this.generateCalendar();
  }

  openAddEventDrawer() {
    this.editingEventId = null;
    this.formError = '';
    this.hasAttemptedSave = false;
    this.eventDraft = this.createEmptyEventDraft();
    this.selectedEvent = null;
    this.isEventDrawerOpen = true;
  }

  closeEventDrawer() {
    this.isEventDrawerOpen = false;
    this.editingEventId = null;
    this.formError = '';
    this.hasAttemptedSave = false;
  }

  cancelEventForm() {
    this.eventDraft = this.createEmptyEventDraft();
    this.closeEventDrawer();
  }

  startEditingSelectedEvent() {
    if (!this.selectedEvent) {
      return;
    }

    this.editEvent(this.selectedEvent);
  }

  editEvent(event: CalendarEvent) {
    if (event.id === undefined) {
      this.formError = 'This event is missing its database id and cannot be edited.';
      return;
    }

    this.editingEventId = event.id;
    this.formError = '';
    this.hasAttemptedSave = false;
    this.eventDraft = this.createDraftFromEvent(event);
    this.selectedEvent = null;
    this.isEventDrawerOpen = true;
  }

  async saveEvent() {
    if (this.isEditingEvent) {
      await this.updateEvent();
      return;
    }

    await this.addEvent();
  }

  async addEvent() {
    this.hasAttemptedSave = true;
    const validationError = this.getDraftValidationError();

    if (validationError) {
      this.formError = '';
      return;
    }

    this.isSaving = true;
    this.formError = '';

    const backendPayload = this.buildBackendPayload();
    const optimisticEvent = this.buildOptimisticEvent();
    this.upsertEvent(optimisticEvent);
    this.focusCalendarOnEvent(optimisticEvent);
    this.eventDraft = this.createEmptyEventDraft();
    this.closeEventDrawer();

    try {
      const response = await this.fetchCalendarApi('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload)
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const savedBackendEvent = await this.readBackendCalendarEvent(response);

      if (savedBackendEvent) {
        const savedEvent = this.mapBackendEvent(savedBackendEvent);
        this.replaceEvent(optimisticEvent.id!, savedEvent);
      } else {
        await this.loadCalendarEvents();
      }

      this.showToast('Event added successfully.');
    } catch (error) {
      this.removeEvent(optimisticEvent.id!);
      this.formError = this.getRequestErrorMessage(error, 'save');
      this.showToast(this.formError);
    } finally {
      this.isSaving = false;
    }
  }

  async updateEvent() {
    if (this.editingEventId === null) {
      return;
    }

    const eventId = this.editingEventId;
    this.hasAttemptedSave = true;
    const validationError = this.getDraftValidationError();

    if (validationError) {
      this.formError = '';
      return;
    }

    this.isSaving = true;
    this.formError = '';

    const existingEvent = this.events.find((event) => event.id === eventId);

    if (!existingEvent) {
      this.isSaving = false;
      this.formError = 'This event could not be found.';
      return;
    }

    const backendPayload = this.buildBackendPayload();
    const optimisticEvent = this.buildOptimisticEvent(eventId);
    this.upsertEvent(optimisticEvent);
    this.focusCalendarOnEvent(optimisticEvent);
    this.eventDraft = this.createEmptyEventDraft();
    this.closeEventDrawer();

    try {
      const response = await this.fetchCalendarApi(`/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload)
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const savedBackendEvent = await this.readBackendCalendarEvent(response);

      if (savedBackendEvent) {
        const savedEvent = this.mapBackendEvent(savedBackendEvent);
        this.replaceEvent(optimisticEvent.id!, savedEvent);
      } else {
        await this.loadCalendarEvents();
      }

      this.showToast('Event updated successfully.');
    } catch (error) {
      this.upsertEvent(existingEvent);
      this.focusCalendarOnEvent(existingEvent);
      this.formError = this.getRequestErrorMessage(error, 'save');
      this.showToast(this.formError);
    } finally {
      this.isSaving = false;
    }
  }

  requestDeleteSelectedEvent() {
    if (this.selectedEvent?.id === undefined || this.isDeleting) {
      return;
    }

    this.deleteConfirmationEvent = this.selectedEvent;
  }

  closeDeleteConfirmation() {
    this.deleteConfirmationEvent = null;
  }

  async confirmDeleteEvent() {
    if (this.deleteConfirmationEvent?.id === undefined || this.isDeleting) {
      return;
    }

    const eventToDelete = this.deleteConfirmationEvent;
    const eventId = eventToDelete.id!;
    const deletedEventIndex = this.events.findIndex((event) => event.id === eventId);
    this.isDeleting = true;
    this.removeEvent(eventId);
    this.selectedEvent = null;
    this.closeDeleteConfirmation();

    try {
      const response = await this.fetchCalendarApi(`/${eventId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      this.showToast('Event deleted successfully.');
    } catch (error) {
      this.restoreEvent(eventToDelete, deletedEventIndex);
      this.showToast(this.getRequestErrorMessage(error, 'delete'));
    } finally {
      this.isDeleting = false;
    }
  }

  getEventsForDate(date: string): CalendarEvent[] {
    return this.events.filter((event) => event.date === date);
  }

  isToday(day: number): boolean {
    return (
      day === this.today.getDate() &&
      this.currentDate.getMonth() === this.today.getMonth() &&
      this.currentDate.getFullYear() === this.today.getFullYear()
    );
  }

  isTodayDate(date: Date): boolean {
    return (
      date.getDate() === this.today.getDate() &&
      date.getMonth() === this.today.getMonth() &&
      date.getFullYear() === this.today.getFullYear()
    );
  }

  private createEmptyEventDraft(): EventDraft {
    return {
      title: '',
      description: '',
      location: '',
      date: this.formatDateForInput(this.currentDate),
      startTime: '',
      endTime: '',
      category: 'Event',
      budget: '',
      notes: ''
    };
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDateForDay(day: number): string {
    return this.formatDateForInput(
      new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day)
    );
  }

  getDateForDate(date: Date): string {
    return this.formatDateForInput(date);
  }

  private mapBackendCategory(category: string | null): EventCategory {
    if (!category) {
      return 'Event';
    }

    const normalized =
      category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

    return this.eventCategories.includes(normalized as EventCategory)
      ? (normalized as EventCategory)
      : 'Event';
  }

  private updateSearchResults(): void {
    if (!this.searchTerm) {
      this.searchResults = [];
      return;
    }

    this.searchResults = this.events.filter((event) =>
      event.title?.toLowerCase().includes(this.searchTerm)
    );
  }

  private refreshSelectedEvent(): void {
    if (!this.selectedEvent?.id) {
      return;
    }

    this.selectedEvent =
      this.events.find((event) => event.id === this.selectedEvent?.id) ?? null;
  }

  private mapBackendEvent(event: BackendCalendarEvent): CalendarEvent {
    return {
      id: event.id,
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      date: event.startDateTime?.split('T')[0] ?? '',
      startTime: event.startDateTime?.split('T')[1]?.slice(0, 5) ?? '',
      endTime: event.endDateTime?.split('T')[1]?.slice(0, 5) ?? '',
      category: this.mapBackendCategory(event.category ?? null),
      cost: event.budgetCost ?? undefined,
      notes: event.notes ?? ''
    };
  }

  private createDraftFromEvent(event: CalendarEvent): EventDraft {
    return {
      title: event.title ?? '',
      description: event.description ?? '',
      location: event.location ?? '',
      date: event.date || this.formatDateForInput(this.currentDate),
      startTime: event.startTime ?? '',
      endTime: event.endTime ?? '',
      category: this.mapBackendCategory(event.category ?? null),
      budget: event.cost !== undefined ? String(event.cost) : '',
      notes: event.notes ?? ''
    };
  }

  private getDraftValidationError(): string {
    if (!this.eventDraft.title.trim()) {
      return 'Event title is required.';
    }

    if (!this.eventDraft.date) {
      return 'Event date is required.';
    }

    if ((this.eventDraft.startTime && !this.eventDraft.endTime) || (!this.eventDraft.startTime && this.eventDraft.endTime)) {
      return 'Provide both start and end times, or leave both empty for an all-day event.';
    }

    if (
      this.eventDraft.startTime &&
      this.eventDraft.endTime &&
      this.eventDraft.startTime > this.eventDraft.endTime
    ) {
      return 'End time must be after start time.';
    }

    const budgetValue = this.getBudgetValue();

    if (budgetValue !== '') {
      const budget = Number(budgetValue);

      if (Number.isNaN(budget) || budget < 0) {
        return 'Budget must be a valid positive number.';
      }
    }

    return '';
  }

  private buildBackendPayload() {
    const budgetValue = this.getBudgetValue();

    return {
      title: this.eventDraft.title.trim(),
      description: this.eventDraft.description.trim(),
      location: this.eventDraft.location.trim(),
      startDateTime: `${this.eventDraft.date}T${this.eventDraft.startTime || '00:00'}:00`,
      endDateTime: `${this.eventDraft.date}T${this.eventDraft.endTime || '23:59'}:00`,
      category: this.eventDraft.category,
      budgetCost: budgetValue !== '' ? Number(budgetValue) : null,
      notes: this.eventDraft.notes.trim()
    };
  }

  private getBudgetValue(): string {
    const { budget } = this.eventDraft;

    if (budget === null || budget === undefined) {
      return '';
    }

    return String(budget).trim();
  }

  private buildOptimisticEvent(id?: number): CalendarEvent {
    return {
      id: id ?? -Date.now(),
      title: this.eventDraft.title.trim(),
      description: this.eventDraft.description.trim(),
      location: this.eventDraft.location.trim(),
      date: this.eventDraft.date,
      startTime: this.eventDraft.startTime || '',
      endTime: this.eventDraft.endTime || '',
      category: this.eventDraft.category,
      cost: this.getBudgetValue() !== '' ? Number(this.getBudgetValue()) : undefined,
      notes: this.eventDraft.notes.trim()
    };
  }

  private getCalendarApiCandidates(path: string): string[] {
    const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
    return [`${this.calendarApiBaseUrl}${normalizedPath}`];
  }

  private async fetchCalendarApi(
    path: string,
    init?: RequestInit
  ): Promise<Response> {
    const candidates = this.getCalendarApiCandidates(path);
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        return await this.fetchWithTimeout(candidate, init);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  private async fetchWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async readBackendCalendarEvent(
    response: Response
  ): Promise<BackendCalendarEvent | null> {
    const rawResponse = await response.text();

    if (!rawResponse.trim()) {
      return null;
    }

    try {
      return JSON.parse(rawResponse) as BackendCalendarEvent;
    } catch {
      return null;
    }
  }

  private getRequestErrorMessage(error: unknown, action: 'save' | 'delete' | 'load'): string {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return `The ${action} request timed out. Check that the backend is running and try again.`;
    }

    if (error instanceof TypeError) {
      return `Unable to reach the backend to ${action} the event. Check that the frontend can access the API and try again.`;
    }

    return `Unable to ${action} the event. Check that the backend is running and try again.`;
  }

  private focusCalendarOnEvent(event: CalendarEvent): void {
    if (!event.date) {
      return;
    }

    const eventDate = new Date(`${event.date}T12:00:00`);

    if (Number.isNaN(eventDate.getTime())) {
      return;
    }

    this.currentDate = eventDate;
    this.selectedDay = eventDate.getDate();
    this.generateCalendar();
  }

  private focusCalendarOnDraftDate(): void {
    if (!this.eventDraft.date) {
      return;
    }

    const eventDate = new Date(`${this.eventDraft.date}T12:00:00`);

    if (Number.isNaN(eventDate.getTime())) {
      return;
    }

    this.currentDate = eventDate;
    this.selectedDay = eventDate.getDate();
    this.generateCalendar();
  }

  private upsertEvent(event: CalendarEvent): void {
    const existingIndex = this.events.findIndex((item) => item.id === event.id);

    if (existingIndex >= 0) {
      this.events = this.events.map((item, index) => (index === existingIndex ? event : item));
    } else {
      this.events = [...this.events, event];
    }

    this.updateSearchResults();
    this.cdr.detectChanges();
  }

  private removeEvent(eventId: number): void {
    this.events = this.events.filter((event) => event.id !== eventId);
    this.updateSearchResults();
    this.cdr.detectChanges();
  }

  private replaceEvent(currentEventId: number, replacementEvent: CalendarEvent): void {
    this.events = this.events.map((event) =>
      event.id === currentEventId ? replacementEvent : event
    );
    this.updateSearchResults();
    this.cdr.detectChanges();
  }

  private restoreEvent(event: CalendarEvent, index: number): void {
    if (index < 0) {
      this.upsertEvent(event);
      return;
    }

    const nextEvents = [...this.events];
    nextEvents.splice(index, 0, event);
    this.events = nextEvents;
    this.updateSearchResults();
    this.cdr.detectChanges();
  }

  private showToast(message: string): void {
    this.toastMessage = message;

    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }

    this.toastTimeoutId = setTimeout(() => {
      this.toastMessage = '';
      this.toastTimeoutId = null;
      this.cdr.detectChanges();
    }, 2600);
  }

constructor(private cdr: ChangeDetectorRef) {}

}
