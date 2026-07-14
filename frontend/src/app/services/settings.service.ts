import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth';

export type CalendarViewPreference = 'monthly' | 'weekly';
export type CalendarView = 'month' | 'week';

export interface SettingsPreferences {
  notifications: {
    tripReminders: boolean;
    budgetAlerts: boolean;
    bookingUpdates: boolean;
  };
  defaultCalendarView: CalendarViewPreference;
  privacy: {
    shareTripData: boolean;
    allowAnalytics: boolean;
  };
}

export interface FeedbackPayload {
  rating: number;
  emoji: string;
  message: string;
  submittedAt: string;
}

const SETTINGS_STORAGE_KEY = 'roamer-settings';
const FEEDBACK_STORAGE_KEY = 'roamer-feedback-drafts';
const DEFAULT_SETTINGS_PREFERENCES: SettingsPreferences = {
  notifications: {
    tripReminders: true,
    budgetAlerts: true,
    bookingUpdates: false
  },
  defaultCalendarView: 'monthly',
  privacy: {
    shareTripData: false,
    allowAnalytics: true
  }
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly settingsApiUrl = '/api/settings';
  private readonly feedbackApiUrl = '/api/feedback';

  async loadPreferences(defaults: SettingsPreferences): Promise<SettingsPreferences> {
    try {
      const preferences = await firstValueFrom(
        this.http.get<SettingsPreferences>(this.settingsApiUrl, {
          headers: this.authService.authHeader()
        })
      );
      return this.mergePreferences(defaults, preferences);
    } catch (error) {
      console.error('Settings API GET /api/settings failed; using localStorage fallback.', error);
      return this.loadPreferencesLocally(defaults);
    }
  }

  async savePreferences(preferences: SettingsPreferences): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put<SettingsPreferences>(this.settingsApiUrl, preferences, {
          headers: this.authService.authHeader()
        })
      );
    } catch (error) {
      console.error('Settings API PUT /api/settings failed; saved settings to localStorage fallback only.', error);
      this.savePreferencesLocally(preferences);
      throw error;
    }
  }

  async submitFeedback(payload: FeedbackPayload): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(this.feedbackApiUrl, payload, {
          headers: this.authService.authHeader()
        })
      );
    } catch (error) {
      console.error('Settings API POST /api/feedback failed; saved feedback to localStorage fallback only.', error);
      this.saveFeedbackLocally(payload);
      throw error;
    }
  }

  getDefaultCalendarView(): CalendarView {
    return this.toCalendarView(this.loadPreferencesLocally(DEFAULT_SETTINGS_PREFERENCES).defaultCalendarView);
  }

  setDefaultCalendarViewPreference(view: CalendarViewPreference): void {
    const preferences = this.loadPreferencesLocally(DEFAULT_SETTINGS_PREFERENCES);
    this.savePreferencesLocally({
      ...preferences,
      defaultCalendarView: view
    });
  }

  private toCalendarView(view: CalendarViewPreference): CalendarView {
    return view === 'weekly' ? 'week' : 'month';
  }

  private loadPreferencesLocally(defaults: SettingsPreferences): SettingsPreferences {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) return defaults;

    try {
      const data = JSON.parse(saved) as Partial<SettingsPreferences>;
      return this.mergePreferences(defaults, data);
    } catch {
      return defaults;
    }
  }

  private savePreferencesLocally(preferences: SettingsPreferences): void {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(preferences));
  }

  private saveFeedbackLocally(payload: FeedbackPayload): void {
    const saved = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    const previous = this.parseFeedback(saved);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([...previous, payload]));
  }

  private mergePreferences(defaults: SettingsPreferences, data: Partial<SettingsPreferences>): SettingsPreferences {
    return {
      notifications: { ...defaults.notifications, ...data.notifications },
      defaultCalendarView: this.isCalendarView(data.defaultCalendarView)
        ? data.defaultCalendarView
        : defaults.defaultCalendarView,
      privacy: { ...defaults.privacy, ...data.privacy }
    };
  }

  private isCalendarView(value: unknown): value is CalendarViewPreference {
    return value === 'monthly' || value === 'weekly';
  }

  private parseFeedback(saved: string | null): FeedbackPayload[] {
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
