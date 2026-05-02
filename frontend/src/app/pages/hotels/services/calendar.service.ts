import { Injectable } from '@angular/core';
import { CalendarEvent } from '../models/hotel.model';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {

  private events: CalendarEvent[] = [];

  addEvent(event: CalendarEvent) {
    this.events.push(event);
    console.log('Event added:', event);
  }

  getEvents() {
    return this.events;
  }
}
