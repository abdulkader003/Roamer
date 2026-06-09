
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';

export interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  location?: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  category?: string;
  cost?: number;
  notes?: string;
}

@Component({
  selector: 'app-event-card',
  imports: [NgClass],
  templateUrl: './event-card.component.html',
  styleUrl: './event-card.component.css'
})
export class EventCardComponent {
  @Input({ required: true }) event!: CalendarEvent;
  @Input() occurrenceDate = '';
  @Output() viewDetails = new EventEmitter<CalendarEvent>();

  get isHotel(): boolean {
    return (this.event.category ?? '').trim().toLowerCase() === 'hotel';
  }

  get isMultiDay(): boolean {
    return !!this.event.endDate && this.event.endDate !== this.event.date;
  }

  get metaLabel(): string {
    if (this.isHotel) {
      const stayLabel = this.stayLabel;
      const location = this.event.location?.trim();

      return [stayLabel, location].filter(Boolean).join(' · ');
    }

    return [this.event.startTime, this.event.location].filter(Boolean).join(' · ');
  }

  get categoryLabel(): string {
    if (this.isHotel && this.isMultiDay) {
      return 'Hotel stay';
    }

    return this.event.category ?? '';
  }

  get stayLabel(): string {
    if (!this.isHotel || !this.isMultiDay) {
      return this.event.startTime || '';
    }

    if (this.occurrenceDate === this.event.date) {
      return 'Check-in';
    }

    if (this.occurrenceDate === this.event.endDate) {
      return 'Check-out';
    }

    return `${this.getStayNights()}-night stay`;
  }

  get toneClass(): string {
    const category = (this.event.category ?? '').trim().toLowerCase();

    if (category === 'flight') {
      return 'event-card--flight';
    }

    if (category === 'hotel') {
      return 'event-card--hotel';
    }

    if (category === 'activity') {
      return 'event-card--activity';
    }

    return 'event-card--custom';
  }

  get durationClass(): string {
    if (!this.isMultiDay) {
      return '';
    }

    if (this.occurrenceDate === this.event.date) {
      return 'event-card--range-start';
    }

    if (this.occurrenceDate === this.event.endDate) {
      return 'event-card--range-end';
    }

    return 'event-card--range-middle';
  }

  openDetails(clickEvent: MouseEvent): void {
    clickEvent.stopPropagation();
    this.viewDetails.emit(this.event);
  }

  private getStayNights(): number {
    const start = this.parseDate(this.event.date);
    const end = this.parseDate(this.event.endDate ?? '');

    if (!start || !end) {
      return 1;
    }

    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  }

  private parseDate(value: string): Date | null {
    const [year, month, day] = value.split('-').map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }
}
