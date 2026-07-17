import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../services/auth';
import { CalendarView, SettingsService } from '../../services/settings.service';
import { CalendarMonth } from './calendar-month';

describe('CalendarMonth default view preference', () => {
  let fixture: ComponentFixture<CalendarMonth>;
  let component: CalendarMonth;
  let settingsService: jasmine.SpyObj<SettingsService>;
  let defaultCalendarView: ReturnType<typeof signal<CalendarView>>;

  beforeEach(async () => {
    defaultCalendarView = signal<CalendarView>('month');
    settingsService = jasmine.createSpyObj<SettingsService>(
      'SettingsService',
      ['getDefaultCalendarView', 'loadDefaultCalendarViewPreference'],
      { defaultCalendarView }
    );
    settingsService.getDefaultCalendarView.and.returnValue('month');
    settingsService.loadDefaultCalendarViewPreference.and.resolveTo('month');
    spyOn(window, 'fetch').and.resolveTo(new Response('[]', { status: 200 }));

    await TestBed.configureTestingModule({
      imports: [CalendarMonth],
      providers: [
        { provide: SettingsService, useValue: settingsService },
        { provide: AuthService, useValue: { authHeader: () => ({ Authorization: 'Bearer test-token' }) } },
      ],
    }).compileComponents();
  });

  async function createComponent(): Promise<CalendarMonth> {
    fixture = TestBed.createComponent(CalendarMonth);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return component;
  }

  it('initializes in Month view when the backend preference is monthly', async () => {
    settingsService.loadDefaultCalendarViewPreference.and.resolveTo('month');

    await createComponent();

    expect(component.viewMode).toBe('month');
    expect(fixture.nativeElement.querySelector('.month-view')).toBeTruthy();
  });

  it('initializes in Week view when the backend preference is weekly', async () => {
    settingsService.loadDefaultCalendarViewPreference.and.resolveTo('week');

    await createComponent();

    expect(component.viewMode).toBe('week');
    expect(fixture.nativeElement.querySelector('.week-view')).toBeTruthy();
  });

  it('lets the backend preference override stale local calendar storage', async () => {
    settingsService.getDefaultCalendarView.and.returnValue('month');
    settingsService.loadDefaultCalendarViewPreference.and.resolveTo('week');

    await createComponent();

    expect(component.viewMode).toBe('week');
    expect(settingsService.loadDefaultCalendarViewPreference).toHaveBeenCalled();
  });

  it('uses the backend preference in a fresh browser with no local calendar storage', async () => {
    settingsService.getDefaultCalendarView.and.returnValue('month');
    settingsService.loadDefaultCalendarViewPreference.and.resolveTo('week');

    await createComponent();

    expect(component.viewMode).toBe('week');
  });

  it('uses the backend preference after page refresh and login recreation', async () => {
    settingsService.loadDefaultCalendarViewPreference.and.resolveTo('week');

    await createComponent();
    expect(component.viewMode).toBe('week');

    fixture.destroy();
    await createComponent();
    expect(component.viewMode).toBe('week');
    expect(settingsService.loadDefaultCalendarViewPreference).toHaveBeenCalledTimes(2);
  });

  it('falls back safely when the backend preference request fails', async () => {
    settingsService.getDefaultCalendarView.and.returnValue('month');
    settingsService.loadDefaultCalendarViewPreference.and.rejectWith(new Error('settings unavailable'));

    await createComponent();

    expect(component.viewMode).toBe('month');
    expect(fixture.nativeElement.querySelector('.month-view')).toBeTruthy();
  });

  it('updates the open Calendar when the saved preference changes', async () => {
    await createComponent();

    defaultCalendarView.set('week');
    fixture.detectChanges();

    expect(component.viewMode).toBe('week');
    expect(fixture.nativeElement.querySelector('.week-view')).toBeTruthy();
  });

  it('keeps manual Week and Month switching temporary after initialization', async () => {
    await createComponent();

    component.setViewMode('week');
    fixture.detectChanges();
    expect(component.viewMode).toBe('week');
    expect(fixture.nativeElement.querySelector('.week-view')).toBeTruthy();

    component.setViewMode('month');
    fixture.detectChanges();
    expect(component.viewMode).toBe('month');
    expect(fixture.nativeElement.querySelector('.month-view')).toBeTruthy();
    expect(settingsService.loadDefaultCalendarViewPreference).toHaveBeenCalledTimes(1);
  });

  it('still renders loaded calendar events', async () => {
    (window.fetch as jasmine.Spy).and.callFake(() => Promise.resolve(new Response(JSON.stringify([
      {
        id: 1,
        title: 'Museum Visit',
        description: 'Morning tickets',
        location: 'Paris',
        startDateTime: '2026-07-21T10:00:00',
        endDateTime: '2026-07-21T12:00:00',
        category: 'Activity',
        budgetCost: 28,
        notes: null
      }
    ]), { status: 200 })));

    await createComponent();
    await component.loadCalendarEvents();
    fixture.detectChanges();

    expect(component.events.map((event) => event.title)).toContain('Museum Visit');
  });
});
