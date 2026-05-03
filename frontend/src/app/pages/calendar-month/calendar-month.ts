import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  currentDate: Date = new Date(2026, 3, 1); // April 2026

  currentMonth = '';
  days: number[] = [];
  prevMonthDays: number[] = [];
  nextMonthDays: number[] = [];
  weekDays: Date[] = [];
  isEventDrawerOpen = false;
  selectedEvent: CalendarEvent | null = null;
  events: CalendarEvent[] = [
    {
      title: 'Sunset Catamaran Cruise',
      description: 'Evening sail around the caldera with dinner on board.',
      location: 'Ammoudi Bay',
      date: '2026-04-01',
      startTime: '17:30',
      endTime: '21:00',
      category: 'Activity',
      cost: 120,
      notes: 'Bring a light jacket and arrive 20 minutes early.'
    },
    {
      title: 'Boutique Hotel Check-in',
      description: 'Check in and confirm airport transfer for departure day.',
      location: 'Oia',
      date: '2026-04-01',
      startTime: '14:00',
      category: 'Hotel',
      cost: 340,
      notes: 'Reservation under Morgan.'
    },
    {
      title: 'Museum and Old Town Walk',
      description: 'Self-guided walk through the old town and archaeology museum.',
      location: 'Fira',
      date: '2026-04-12',
      startTime: '10:00',
      endTime: '13:00',
      category: 'Attraction',
      cost: 18,
      notes: 'Buy museum tickets online if the morning queue is long.'
    }
  ];
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

  saveEvent() {
    const eventPayload: CalendarEvent = {
      title: this.eventDraft.title,
      description: this.eventDraft.description,
      location: this.eventDraft.location,
      date: this.eventDraft.date,
      startTime: this.eventDraft.startTime,
      endTime: this.eventDraft.endTime,
      category: this.eventDraft.category,
      cost: this.eventDraft.budget ? Number(this.eventDraft.budget) : undefined,
      notes: this.eventDraft.notes
    };

    this.events = [...this.events, eventPayload];
    this.eventDraft = this.createEmptyEventDraft();
    this.closeEventDrawer();
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
}
