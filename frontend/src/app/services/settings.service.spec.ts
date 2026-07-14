import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { SettingsService } from './settings.service';

const SETTINGS_STORAGE_KEY = 'roamer-settings';

describe('SettingsService', () => {
  let service: SettingsService;

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
  });

  afterEach(() => {
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
});
