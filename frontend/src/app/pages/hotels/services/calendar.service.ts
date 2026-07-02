import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CalendarEvent } from '../models/hotel.model';
import { AuthService } from '../../../services/auth';

type BackendCalendarEvent = {
  id: number;
  tripId?: number | null;
  title: string;
  description?: string | null;
  location?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  category?: string | null;
  budgetCost?: number | null;
  notes?: string | null;
};

type PendingCalendarEventState = {
  event: CalendarEvent;
  returnUrl: string;
};

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private readonly requestTimeoutMs = 10000;
  private readonly pendingCalendarEventKey = 'sep.calendar.pending-event';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  async addEvent(event: CalendarEvent): Promise<BackendCalendarEvent> {
    const response = await this.fetchCalendarApi('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.mapCalendarEventToBackendPayload(event))
    });

    if (!response.ok) {
      throw new Error(`Failed to add event: ${response.status}`);
    }

    return response.json() as Promise<BackendCalendarEvent>;
  }

  async deleteEventsForTrip(tripId: number): Promise<void> {
    const response = await this.fetchCalendarApi(`/trip/${tripId}`, {
      method: 'DELETE'
    });

    if (response.status === 404) {
      await this.deleteEventsForTripIndividually(tripId);
      return;
    }

    if (!response.ok) {
      throw new Error(`Failed to delete trip calendar events: ${response.status}`);
    }
  }

  private async deleteEventsForTripIndividually(tripId: number): Promise<void> {
    const response = await this.fetchCalendarApi('');

    if (!response.ok) {
      throw new Error(`Failed to load trip calendar events: ${response.status}`);
    }

    const events = await response.json() as BackendCalendarEvent[];
    const tripEvents = events.filter((event) => event.tripId === tripId);

    for (const event of tripEvents) {
      const deleteResponse = await this.fetchCalendarApi(`/${event.id}`, {
        method: 'DELETE'
      });

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        throw new Error(`Failed to delete calendar event ${event.id}: ${deleteResponse.status}`);
      }
    }
  }

  async addEventOrRedirectToLogin(event: CalendarEvent, returnUrl?: string): Promise<'added'> {
    const targetReturnUrl = this.buildCalendarReturnUrl(event, returnUrl);

    await this.addEvent(event);
    void this.router.navigateByUrl(targetReturnUrl);

    return 'added';
  }

  async completePendingEventAfterAuth(): Promise<boolean> {
    const pendingState = this.getPendingCalendarEvent();

    if (!pendingState) {
      return false;
    }

    await this.addEvent(pendingState.event);
    this.clearPendingCalendarEvent();
    return true;
  }

  clearPendingCalendarEvent(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.removeItem(this.pendingCalendarEventKey);
  }

  private setPendingCalendarEvent(state: PendingCalendarEventState): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(this.pendingCalendarEventKey, JSON.stringify(state));
  }

  private getPendingCalendarEvent(): PendingCalendarEventState | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.sessionStorage.getItem(this.pendingCalendarEventKey);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PendingCalendarEventState>;

      if (!parsed.event || !parsed.returnUrl) {
        return null;
      }

      return {
        event: parsed.event as CalendarEvent,
        returnUrl: parsed.returnUrl
      };
    } catch {
      return null;
    }
  }

  private buildCalendarReturnUrl(event: CalendarEvent, returnUrl?: string): string {
    if (returnUrl && returnUrl.trim()) {
      return returnUrl;
    }

    if (event.startDate && event.startDate.trim()) {
      return `/calendar?date=${encodeURIComponent(event.startDate.trim())}`;
    }

    return '/calendar';
  }

  private mapCalendarEventToBackendPayload(event: CalendarEvent) {
    const normalizedStartTime = event.startTime?.trim() || this.defaultStartTime(event.category);
    const normalizedEndTime = event.endTime?.trim() || this.defaultEndTime(event.category);

    return {
      title: event.title.trim(),
      description: event.description?.trim() ?? '',
      location: event.location?.trim() ?? '',
      startDateTime: `${event.startDate}T${normalizedStartTime}:00`,
      endDateTime: `${event.endDate}T${normalizedEndTime}:00`,
      category: event.category?.trim() || 'Event',
      budgetCost: event.price,
      notes: event.notes?.trim() ?? '',
      tripId: event.tripId ?? null
    };
  }

  private defaultStartTime(category?: string): string {
    return category === 'Hotel' ? '15:00' : '00:00';
  }

  private defaultEndTime(category?: string): string {
    return category === 'Hotel' ? '11:00' : '23:59';
  }

  private getCalendarApiCandidates(path: string): string[] {
    const trimmedPath = path.trim();
    const normalizedPath = trimmedPath
      ? trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
      : '';
    const candidates = [`/api/calendar-events${normalizedPath}`];
    const hostname =
      typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const isLocalHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0';

    if (isLocalHost) {
      candidates.push(`http://${hostname}:8080/api/calendar-events${normalizedPath}`);
    }

    return [...new Set(candidates)];
  }

  private async fetchCalendarApi(
    path: string,
    init?: RequestInit
  ): Promise<Response> {
    const candidates = this.getCalendarApiCandidates(path);
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        const response = await this.fetchWithTimeout(candidate, init);

        if (response.status === 401) {
          this.authService.logout();
          void this.router.navigate(['/login'], {
            queryParams: { returnUrl: '/calendar' }
          });
          throw new Error('AUTH_REQUIRED');
        }

        if (this.shouldTryNextCandidate(response, candidate, candidates)) {
          lastError = new Error(`Calendar API candidate returned ${response.status}: ${candidate}`);
          continue;
        }

        return response;
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
        headers: {
          ...this.authService.authHeader(),
          ...(init?.headers ?? {})
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private shouldTryNextCandidate(
    response: Response,
    candidate: string,
    candidates: string[]
  ): boolean {
    if (response.ok || candidates.length < 2 || response.status !== 404) {
      return false;
    }

    if (typeof window === 'undefined') {
      return false;
    }

    const candidateUrl = new URL(candidate, window.location.origin);
    return candidateUrl.origin === window.location.origin;
  }
}
