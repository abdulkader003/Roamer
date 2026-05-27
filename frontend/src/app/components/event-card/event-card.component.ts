
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';

export interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  location?: string;
  date: string;
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
  @Output() viewDetails = new EventEmitter<CalendarEvent>();

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
}
