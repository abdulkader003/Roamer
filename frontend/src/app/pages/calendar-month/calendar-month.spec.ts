import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { AuthService } from '../../services/auth';
import { SettingsService } from '../../services/settings.service';
import { CalendarMonth } from './calendar-month';

describe('CalendarMonth default view preference', () => {
  let fixture: ComponentFixture<CalendarMonth>;
  let component: CalendarMonth;
  let settingsService: jasmine.SpyObj<SettingsService>;

  beforeEach(async () => {
    settingsService = jasmine.createSpyObj<SettingsService>('SettingsService', ['getDefaultCalendarView']);
    settingsService.getDefaultCalendarView.and.returnValue('month');
    spyOn(window, 'fetch').and.resolveTo(new Response('[]', { status: 200 }));

    await TestBed.configureTestingModule({
      imports: [CalendarMonth],
      providers: [
        { provide: SettingsService, useValue: settingsService },
        { provide: AuthService, useValue: { authHeader: () => ({ Authorization: 'Bearer test-token' }) } },
      ],
    }).compileComponents();
  });

  function createComponent(): CalendarMonth {
    fixture = TestBed.createComponent(CalendarMonth);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return component;
  }

  it('initializes in Month view when the preference is month', () => {
    createComponent();

    expect(component.viewMode).toBe('month');
    expect(fixture.nativeElement.querySelector('.month-view')).toBeTruthy();
  });

  it('initializes in Week view when the preference is week', () => {
    settingsService.getDefaultCalendarView.and.returnValue('week');

    createComponent();

    expect(component.viewMode).toBe('week');
    expect(fixture.nativeElement.querySelector('.week-view')).toBeTruthy();
  });

  it('keeps manual Week and Month switching temporary after initialization', () => {
    createComponent();

    component.setViewMode('week');
    fixture.detectChanges();
    expect(component.viewMode).toBe('week');
    expect(fixture.nativeElement.querySelector('.week-view')).toBeTruthy();

    component.setViewMode('month');
    fixture.detectChanges();
    expect(component.viewMode).toBe('month');
    expect(fixture.nativeElement.querySelector('.month-view')).toBeTruthy();
    expect(settingsService.getDefaultCalendarView).toHaveBeenCalledTimes(1);
  });

  it('still renders loaded calendar events', fakeAsync(() => {
    (window.fetch as jasmine.Spy).and.resolveTo(new Response(JSON.stringify([
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
    ]), { status: 200 }));

    createComponent();
    flushMicrotasks();
    fixture.detectChanges();

    expect(component.events.map((event) => event.title)).toContain('Museum Visit');
  }));
});
