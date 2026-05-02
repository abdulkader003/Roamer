import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface CalendarEvent {
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
  imports: [CommonModule],
  templateUrl: './event-card.component.html',
  styleUrl: './event-card.component.css'
})
export class EventCardComponent {
  @Input({ required: true }) event!: CalendarEvent;
  @Output() viewDetails = new EventEmitter<CalendarEvent>();

  openDetails(clickEvent: MouseEvent): void {
    clickEvent.stopPropagation();
    this.viewDetails.emit(this.event);
  }
}
