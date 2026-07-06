import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../services/auth';

import { CalendarService } from './calendar.service';

describe('Calendar', () => {
  let service: CalendarService;
  let fetchSpy: jasmine.Spy<typeof fetch>;

  beforeEach(() => {
    fetchSpy = spyOn(window, 'fetch');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            authHeader: () => ({ Authorization: 'Bearer test-token' }),
            logout: jasmine.createSpy('logout'),
          },
        },
      ],
    });
    service = TestBed.inject(CalendarService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deletes trip events through the bulk trip endpoint when available', async () => {
    fetchSpy.and.resolveTo(new Response(null, { status: 204 }));

    await service.deleteEventsForTrip(42);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/calendar-events/trip/42',
      jasmine.objectContaining({
        method: 'DELETE',
        headers: jasmine.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to deleting only matching trip events when the bulk endpoint is unavailable', async () => {
    fetchSpy.and.callFake((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/trip/42')) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }

      if (url.endsWith('/api/calendar-events')) {
        return Promise.resolve(new Response(JSON.stringify([
          { id: 1, tripId: 42, title: 'Old Hotel' },
          { id: 2, tripId: 99, title: 'Unrelated User Event' },
          { id: 3, tripId: 42, title: 'Old Flight' },
        ]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.endsWith('/1') || url.endsWith('/3')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.resolve(new Response(null, { status: 500 }));
    });

    await service.deleteEventsForTrip(42);

    const requestedUrls = fetchSpy.calls.allArgs().map(([input]) => String(input));
    expect(requestedUrls).toContain('/api/calendar-events/trip/42');
    expect(requestedUrls).toContain('/api/calendar-events');
    expect(requestedUrls).toContain('/api/calendar-events/1');
    expect(requestedUrls).toContain('/api/calendar-events/3');
    expect(requestedUrls).not.toContain('/api/calendar-events/2');
  });
});
