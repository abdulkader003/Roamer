import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { SettingsService } from './settings.service';

const SETTINGS_STORAGE_KEY = 'roamer-settings';

describe('SettingsService', () => {
  let service: SettingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        SettingsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { authHeader: () => ({ Authorization: 'Bearer test-token' }) },
        },
      ],
    });

    service = TestBed.inject(SettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('defaults the calendar view to month', () => {
    expect(service.getDefaultCalendarView()).toBe('month');
  });

  it('reads a valid saved weekly calendar view', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ defaultCalendarView: 'weekly' }));

    expect(service.getDefaultCalendarView()).toBe('week');
  });

  it('ignores invalid saved calendar view values', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ defaultCalendarView: 'yearly' }));

    expect(service.getDefaultCalendarView()).toBe('month');
  });

  it('persists calendar view updates in existing settings storage', () => {
    service.setDefaultCalendarViewPreference('weekly');

    expect(service.getDefaultCalendarView()).toBe('week');
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}').defaultCalendarView).toBe('weekly');
  });

  it('loads monthly calendar preference from the backend', async () => {
    const preference = service.loadDefaultCalendarViewPreference();

    httpMock.expectOne('/api/settings').flush(settingsResponse('monthly'));

    await expectAsync(preference).toBeResolvedTo('month');
    expect(service.defaultCalendarView()).toBe('month');
  });

  it('loads weekly calendar preference from the backend', async () => {
    const preference = service.loadDefaultCalendarViewPreference();

    httpMock.expectOne('/api/settings').flush(settingsResponse('weekly'));

    await expectAsync(preference).toBeResolvedTo('week');
    expect(service.defaultCalendarView()).toBe('week');
  });

  it('lets the backend override stale localStorage calendar preference', async () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ defaultCalendarView: 'monthly' }));

    const preference = service.loadDefaultCalendarViewPreference();

    httpMock.expectOne('/api/settings').flush(settingsResponse('weekly'));

    await expectAsync(preference).toBeResolvedTo('week');
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}').defaultCalendarView).toBe('weekly');
    expect(service.defaultCalendarView()).toBe('week');
  });

  it('uses the backend preference with empty localStorage', async () => {
    const preference = service.loadDefaultCalendarViewPreference();

    httpMock.expectOne('/api/settings').flush(settingsResponse('weekly'));

    await expectAsync(preference).toBeResolvedTo('week');
    expect(service.getDefaultCalendarView()).toBe('week');
  });

  it('falls back to localStorage when backend loading fails', async () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ defaultCalendarView: 'weekly' }));

    const preference = service.loadDefaultCalendarViewPreference();

    httpMock.expectOne('/api/settings').flush({}, { status: 503, statusText: 'Unavailable' });

    await expectAsync(preference).toBeResolvedTo('week');
    expect(service.defaultCalendarView()).toBe('week');
  });

  function settingsResponse(defaultCalendarView: 'monthly' | 'weekly') {
    return {
      notifications: {
        tripReminders: true,
        budgetAlerts: true,
        bookingUpdates: false
      },
      defaultCalendarView,
      privacy: {
        shareTripData: false,
        allowAnalytics: true
      }
    };
  }
});
