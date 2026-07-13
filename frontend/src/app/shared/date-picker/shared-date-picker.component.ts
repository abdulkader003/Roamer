import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface SharedDatePickerDay {
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isRangeStart?: boolean;
  isRangeEnd?: boolean;
  isInRange?: boolean;
  isPast?: boolean;
}

@Component({
  selector: 'app-shared-date-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="open"
      class="date-popover-backdrop"
      role="presentation"
      (click)="closed.emit()">
      <section
        class="date-popover"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="ariaLabel || title"
        (click)="$event.stopPropagation()">
        <header class="date-popover__head">
          <div>
            <span class="date-popover__eyebrow">{{ eyebrow }}</span>
            <h3>{{ title }}</h3>
          </div>
          <button type="button" class="date-close" aria-label="Close date picker" (click)="closed.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div class="date-popover__body">
          <aside class="date-manual">
            <label>
              <span>Manual date</span>
              <input
                type="text"
                [value]="manualValue"
                (input)="manualInput.emit($any($event.target).value)"
                [class.invalid]="hasError"
                [attr.aria-invalid]="hasError ? 'true' : 'false'"
                [attr.aria-describedby]="hintId"
                [attr.aria-label]="title"
                placeholder="YYYY-MM-DD"
                inputmode="numeric"
              />
            </label>
            <p [id]="hintId" class="date-hint" [class.error]="hasError">{{ hint }}</p>
            <p class="date-range-summary" *ngIf="rangeSummary">{{ rangeSummary }}</p>
            <button *ngIf="clearLabel" type="button" class="date-clear" (click)="clearRequested.emit()">
              {{ clearLabel }}
            </button>
          </aside>

          <div class="date-calendar">
            <div class="date-calendar__toolbar">
              <button type="button" aria-label="Previous month" (click)="previousMonth.emit()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <strong>{{ monthLabel }}</strong>
              <button type="button" aria-label="Next month" (click)="nextMonth.emit()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            <div class="date-weekdays">
              <span *ngFor="let day of weekDays">{{ day }}</span>
            </div>

            <div class="date-days">
              <button
                type="button"
                *ngFor="let day of days"
                [class.muted]="!day.inCurrentMonth"
                [class.today]="day.isToday"
                [class.selected]="day.isSelected"
                [class.range-start]="day.isRangeStart"
                [class.range-end]="day.isRangeEnd"
                [class.in-range]="day.isInRange"
                [class.past]="day.isPast"
                (click)="daySelected.emit(day)">
                {{ day.dayNumber }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class SharedDatePickerComponent {
  @Input() open = false;
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() ariaLabel = '';
  @Input() manualValue = '';
  @Input() hint = '';
  @Input() hasError = false;
  @Input() hintId = 'manual-date-hint';
  @Input() rangeSummary = '';
  @Input() clearLabel = '';
  @Input() monthLabel = '';
  @Input() weekDays: readonly string[] = [];
  @Input() days: readonly SharedDatePickerDay[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() manualInput = new EventEmitter<string>();
  @Output() clearRequested = new EventEmitter<void>();
  @Output() previousMonth = new EventEmitter<void>();
  @Output() nextMonth = new EventEmitter<void>();
  @Output() daySelected = new EventEmitter<SharedDatePickerDay>();
}
