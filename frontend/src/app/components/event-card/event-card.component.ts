
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

  get iconType(): 'flight' | 'hotel' | 'activity' | 'other' {
    const category = (this.event.category ?? '').trim().toLowerCase();

    if (category === 'flight') {
      return 'flight';
    }

    if (category === 'hotel') {
      return 'hotel';
    }

    if (category === 'activity') {
      return 'activity';
    }

    return 'other';
  }

  get isHotel(): boolean {
    return (this.event.category ?? '').trim().toLowerCase() === 'hotel';
  }

  get displayLabel(): string {
    if (this.isHotel) {
      const label = this.getHotelLabel();
      return label || this.event.title;
    }

    if (this.iconType === 'flight') {
      return [this.event.startTime || 'TBD', this.getFlightLabel()].filter(Boolean).join(' ');
    }

    if (this.iconType === 'activity') {
      return [this.event.startTime || 'TBD', this.event.title].filter(Boolean).join(' ');
    }

    return this.event.title;
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

  openDetails(clickEvent: MouseEvent): void {
    clickEvent.stopPropagation();
    this.viewDetails.emit(this.event);
  }

  private getFlightLabel(): string {
    const title = this.event.title.replace(/^Flight:\s*/i, '').trim();
    const airlineMatch =
      title.match(/^(.*?)\s+(?:[A-Z]{1,3}\d{1,4}|\d{2,4})\b/i) ??
      title.match(/^(.*?)\s+(?:to|from)\b/i);

    if (airlineMatch?.[1]) {
      return airlineMatch[1].trim();
    }

    return title;
  }

  private getHotelLabel(): string {
    const normalized = this.event.title.replace(/^Hotel:\s*/i, '').trim();
    const date = this.occurrenceDate || this.event.date;

    if (!this.event.endDate || this.event.endDate === this.event.date) {
      return normalized;
    }

    if (date === this.event.date) {
      return `Check-in · ${normalized}`;
    }

    if (date === this.event.endDate) {
      return `Check-out · ${normalized}`;
    }

    return `Stay · ${normalized}`;
  }
}
