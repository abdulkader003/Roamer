import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-global-loading-avatar',
  standalone: true,
  templateUrl: './global-loading-avatar.component.html',
  styleUrl: './global-loading-avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlobalLoadingAvatarComponent {}
