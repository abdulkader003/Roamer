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
  budget: string;
  notes: string;
};

@Component({
  selector: 'app-calendar-month',
  imports: [CommonModule, FormsModule, EventCardComponent],
  templateUrl: './calendar-month.html',
  styleUrl: './calendar-month.css'
})
export class CalendarMonth {
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

  events: CalendarEvent[] = [];

  searchTerm: string = '';
  searchResults: CalendarEvent[] = [];

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value.trim().toLowerCase();

    if (!this.searchTerm) {
      this.searchResults = [];
      return;
    }

    this.searchResults = this.events.filter((event) =>
      event.title?.toLowerCase().includes(this.searchTerm)
    );
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
      const response = await fetch('/api/calendar-events');

      if (!response.ok) {
        throw new Error(`Failed to load events: ${response.status}`);
      }

      const backendEvents = await response.json();

      this.events = backendEvents.map((event: any) => ({
        title: event.title,
        description: event.description ?? '',
        location: event.location ?? '',
        date: event.startDateTime?.split('T')[0] ?? '',
        startTime: event.startDateTime?.split('T')[1]?.slice(0, 5) ?? '',
        endTime: event.endDateTime?.split('T')[1]?.slice(0, 5) ?? '',
        category: this.mapBackendCategory(event.category),
        cost: event.budgetCost ?? undefined,
        notes: event.notes ?? ''
      }));
    this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading calendar events:', error);
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

  addEvent() {
    this.isEventDrawerOpen = true;
  }

  closeEventDrawer() {
    this.isEventDrawerOpen = false;
  }

  cancelEventForm() {
    this.eventDraft = this.createEmptyEventDraft();
    this.closeEventDrawer();
  }

 async saveEvent() {
   alert('saveEvent started');

   const backendPayload = {
     title: this.eventDraft.title,
     description: this.eventDraft.description,
     location: this.eventDraft.location,
     startDateTime: `${this.eventDraft.date}T${this.eventDraft.startTime || '00:00'}:00`,
     endDateTime: `${this.eventDraft.date}T${this.eventDraft.endTime || '23:59'}:00`,
     category: this.eventDraft.category,
     budgetCost: this.eventDraft.budget ? Number(this.eventDraft.budget) : null,
     notes: this.eventDraft.notes
   };

   try {
     const response = await fetch('/api/calendar-events', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(backendPayload)
     });

     if (!response.ok) {
       alert('Backend error: ' + response.status);
       return;
     }

     alert('Event saved successfully');

     await this.loadCalendarEvents();

     this.eventDraft = this.createEmptyEventDraft();
     this.closeEventDrawer();
   } catch (error) {
     alert('Network error. Backend may not be running.');
     console.error(error);
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

constructor(private cdr: ChangeDetectorRef) {}

}
