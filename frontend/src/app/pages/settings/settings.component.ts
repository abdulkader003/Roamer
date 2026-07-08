import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemePreference, ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  private readonly themeService = inject(ThemeService);

  // ── Section 1: Notifications ──
  notifications = {
    tripReminders: true,
    budgetAlerts: true,
    bookingUpdates: false
  };

  // ── Section 2: App Preferences ──
  readonly theme = this.themeService.theme;
  defaultCalendarView: 'monthly' | 'weekly' = 'monthly';

  // ── Section 3: Privacy ──
  privacy = {
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
      answer: 'Go to Settings → App Preferences and choose Light, Dark, or System (follows your device setting).',
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

  readonly emojis = [
    { emoji: '😞', label: 'Terrible' },
    { emoji: '😐', label: 'Okay' },
    { emoji: '😊', label: 'Good' },
    { emoji: '😍', label: 'Amazing' }
  ];

  ngOnInit(): void {
    this.loadSettings();
  }

  // ── Load / Save ──
  private loadSettings(): void {
    const saved = localStorage.getItem('roamer-settings');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (data.notifications) this.notifications = data.notifications;
      if (data.defaultCalendarView) this.defaultCalendarView = data.defaultCalendarView;
      if (data.privacy) this.privacy = data.privacy;
    } catch {}
  }

  saveSettings(): void {
    localStorage.setItem('roamer-settings', JSON.stringify({
      notifications: this.notifications,
      defaultCalendarView: this.defaultCalendarView,
      privacy: this.privacy
    }));
    this.showSaveToast();
  }

  isSaveToastVisible = false;

  private showSaveToast(): void {
    this.isSaveToastVisible = true;
    setTimeout(() => { this.isSaveToastVisible = false; }, 2500);
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
  }

  setRating(rating: number): void {
    this.feedbackRating = rating;
  }

  setEmoji(emoji: string): void {
    this.feedbackEmoji = emoji;
  }

  submitFeedback(): void {
    if (!this.feedbackRating) return;
    this.feedbackSubmitted = true;
    setTimeout(() => {
      this.isFeedbackOpen = false;
    }, 2000);
  }
}
