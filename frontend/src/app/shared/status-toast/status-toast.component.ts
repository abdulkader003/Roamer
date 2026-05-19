import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type StatusToastType = 'success' | 'error' | 'info';

@Component({
  selector: 'app-status-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="message"
      class="status-toast"
      [class.status-toast--success]="type === 'success'"
      [class.status-toast--error]="type === 'error'"
      [class.status-toast--info]="type === 'info'"
      [attr.role]="type === 'error' ? 'alert' : 'status'"
      [attr.aria-live]="type === 'error' ? 'assertive' : 'polite'">
      {{ message }}
    </div>
  `,
  styleUrls: ['./status-toast.component.css'],
})
export class StatusToastComponent {
  @Input() message = '';
  @Input() type: StatusToastType = 'info';
}
