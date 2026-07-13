import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemePreference, ThemeService } from '../../services/theme.service';
import {
  CalendarViewPreference,
  FeedbackPayload,
  SettingsPreferences,
  SettingsService
} from '../../services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly settingsService = inject(SettingsService);
  private readonly cdr = inject(ChangeDetectorRef);

  // ── Section 1: Notifications ──
  notifications: SettingsPreferences['notifications'] = {
    tripReminders: true,
    budgetAlerts: true,
    bookingUpdates: false
  };

  // ── Section 2: App Preferences ──
  readonly theme = this.themeService.theme;
  defaultCalendarView: CalendarViewPreference = 'monthly';

  // ── Section 3: Privacy ──
  privacy: SettingsPreferences['privacy'] = {
    shareTripData: false,
    allowAnalytics: true
  };

  // ── Section 4: FAQ ──
  faqs = [
    {
      question: 'How do I create a new trip?',
      answer: 'Go to the Trips section and click "New Trip". You can add a destination, dates, budget, flights, hotels, and activities.',
      open: false
    },
    {
      question: 'How does the Budget Tracker work?',
      answer: 'The Budget Tracker aggregates all your trip budgets and expenses. You can add manual expenses and see your spending broken down by category.',
      open: false
    },
    {
      question: 'Can I edit or delete a calendar event?',
      answer: 'Yes! Open any event on the Calendar page and use the pencil icon to edit or the trash icon to delete it.',
      open: false
    },
    {
      question: 'How do I switch between light and dark mode?',
      answer: 'Go to Settings → App Preferences and choose Light, Dark, or System. System follows your operating system theme.',
      open: false
    },
    {
      question: 'Is my data private?',
      answer: 'Yes. Your trips, expenses, and personal details are only visible to you unless you explicitly enable data sharing in Privacy Settings.',
      open: false
    }
  ];

  // ── Section 4: Feedback ──
  isFeedbackOpen = false;
  feedbackRating = 0;
  feedbackEmoji = '';
  feedbackText = '';
  feedbackSubmitted = false;
  feedbackSubmitting = false;
  feedbackError = '';

  isTermsOpen = false;
  isLoadingSettings = false;
  isSavingSettings = false;
  settingsError = '';
  private hasUserEditedSettings = false;

  readonly emojis = [
    { emoji: '😞', label: 'Terrible' },
    { emoji: '😐', label: 'Okay' },
    { emoji: '😊', label: 'Good' },
    { emoji: '😍', label: 'Amazing' }
  ];

  ngOnInit(): void {
    void this.loadSettings();
  }

  // ── Load / Save ──
  private async loadSettings(): Promise<void> {
    this.isLoadingSettings = true;
    try {
      const settings = await this.settingsService.loadPreferences(this.currentPreferences());
      if (this.hasUserEditedSettings) {
        return;
      }

      this.notifications = { ...settings.notifications };
      this.defaultCalendarView = settings.defaultCalendarView;
      this.privacy = { ...settings.privacy };
    } finally {
      this.isLoadingSettings = false;
      this.cdr.detectChanges();
    }
  }

  async saveSettings(): Promise<void> {
    if (this.isSavingSettings) {
      return;
    }

    this.isSavingSettings = true;
    this.settingsError = '';
    try {
      await this.settingsService.savePreferences(this.currentPreferences());
      this.hasUserEditedSettings = false;
      this.showSaveToast();
    } catch (error) {
      console.error('Settings could not be saved to the backend.', error);
      this.settingsError = 'Settings could not be saved. Please try again.';
    } finally {
      this.isSavingSettings = false;
      this.cdr.detectChanges();
    }
  }

  isSaveToastVisible = false;

  private showSaveToast(): void {
    this.isSaveToastVisible = true;
    setTimeout(() => { this.isSaveToastVisible = false; }, 2500);
  }

  private currentPreferences(): SettingsPreferences {
    return {
      notifications: { ...this.notifications },
      defaultCalendarView: this.defaultCalendarView,
      privacy: { ...this.privacy }
    };
  }

  toggleNotification(setting: keyof SettingsPreferences['notifications']): void {
    this.markSettingsEdited();
    this.notifications = {
      ...this.notifications,
      [setting]: !this.notifications[setting]
    };
  }

  togglePrivacy(setting: keyof SettingsPreferences['privacy']): void {
    this.markSettingsEdited();
    this.privacy = {
      ...this.privacy,
      [setting]: !this.privacy[setting]
    };
  }

  selectCalendarView(view: CalendarViewPreference): void {
    this.markSettingsEdited();
    this.defaultCalendarView = view;
  }

  private markSettingsEdited(): void {
    this.hasUserEditedSettings = true;
    this.settingsError = '';
  }

  // ── Theme ──
  selectTheme(theme: ThemePreference): void {
    this.themeService.setTheme(theme);
  }

  // ── FAQ ──
  toggleFaq(index: number): void {
    this.faqs = this.faqs.map((faq, i) => ({
      ...faq,
      open: i === index ? !faq.open : false
    }));
  }

  // ── Feedback ──
  openFeedback(): void {
    this.feedbackRating = 0;
    this.feedbackEmoji = '';
    this.feedbackText = '';
    this.feedbackSubmitted = false;
    this.feedbackSubmitting = false;
    this.feedbackError = '';
    this.isFeedbackOpen = true;
  }

  closeFeedback(): void {
    this.isFeedbackOpen = false;
  }

  @HostListener('document:keydown.escape')
  closeFeedbackFromEscape(): void {
    if (this.isFeedbackOpen) {
      this.closeFeedback();
    }
    if (this.isTermsOpen) {
      this.closeTerms();
    }
  }

  setRating(rating: number): void {
    this.feedbackRating = rating;
  }

  setEmoji(emoji: string): void {
    this.feedbackEmoji = emoji;
  }

  async submitFeedback(): Promise<void> {
    this.feedbackError = '';

    if (!this.feedbackRating) {
      this.feedbackError = 'Please choose a star rating before submitting.';
      return;
    }

    this.feedbackSubmitting = true;
    const payload: FeedbackPayload = {
      rating: this.feedbackRating,
      emoji: this.feedbackEmoji,
      message: this.feedbackText.trim(),
      submittedAt: new Date().toISOString()
    };

    try {
      await this.settingsService.submitFeedback(payload);
      this.feedbackSubmitted = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.isFeedbackOpen = false;
        this.feedbackSubmitting = false;
        this.cdr.detectChanges();
      }, 2000);
    } catch {
      this.feedbackSubmitting = false;
      this.feedbackError = 'Feedback could not be saved. Please try again.';
      this.cdr.detectChanges();
    }
  }

  openTerms(): void {
    this.isTermsOpen = true;
  }

  closeTerms(): void {
    this.isTermsOpen = false;
  }
}
