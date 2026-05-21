import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  private themeService = inject(ThemeService);
  authService = inject(AuthService);
  @Output() menuRequested = new EventEmitter<void>();

  isDark = computed(() => this.themeService.theme() === 'dark');
  isAuthenticated = computed(() => this.authService.isAuthenticated());
  avatarLabel = computed(() => {
    const email = this.authService.email();
    if (!email) {
      return 'GU';
    }

    const prefix = email.split('@')[0]?.slice(0, 2).toUpperCase();
    return prefix || 'RO';
  });

  requestMenu(): void {
    this.menuRequested.emit();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }
}
