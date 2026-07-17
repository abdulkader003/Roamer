import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from '../../services/theme.service';
import { SettingsPreferences, SettingsService } from '../../services/settings.service';
import { SettingsComponent } from './settings.component';

const defaultPreferences: SettingsPreferences = {
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

describe('SettingsComponent calendar view preference', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let settingsService: jasmine.SpyObj<SettingsService>;

  beforeEach(async () => {
    settingsService = jasmine.createSpyObj<SettingsService>('SettingsService', [
      'loadPreferences',
      'savePreferences',
      'submitFeedback',
      'setDefaultCalendarViewPreference'
    ]);
    settingsService.loadPreferences.and.resolveTo(defaultPreferences);
    settingsService.savePreferences.and.resolveTo();
    settingsService.submitFeedback.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: SettingsService, useValue: settingsService },
        { provide: ThemeService, useValue: { theme: signal('light'), setTheme: jasmine.createSpy('setTheme') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
  });

  it('saves monthly selection immediately', () => {
    component.selectCalendarView('monthly');

    expect(component.defaultCalendarView).toBe('monthly');
    expect(settingsService.setDefaultCalendarViewPreference).toHaveBeenCalledWith('monthly');
  });

  it('saves weekly selection immediately', () => {
    component.selectCalendarView('weekly');

    expect(component.defaultCalendarView).toBe('weekly');
    expect(settingsService.setDefaultCalendarViewPreference).toHaveBeenCalledWith('weekly');
  });

  it('restores saved selection when settings initializes', async () => {
    settingsService.loadPreferences.and.resolveTo({
      ...defaultPreferences,
      defaultCalendarView: 'weekly'
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const weeklyButton = fixture.nativeElement.querySelector('[data-testid="calendar-view-weekly"]') as HTMLButtonElement;

    expect(component.defaultCalendarView).toBe('weekly');
    expect(weeklyButton.classList).toContain('active');
    expect(weeklyButton.textContent?.trim()).toBe('Weekly');
    expect(settingsService.setDefaultCalendarViewPreference).toHaveBeenCalledWith('weekly');
  });
});
