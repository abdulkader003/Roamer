import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  private themeService = inject(ThemeService);
  @Output() menuRequested = new EventEmitter<void>();

  isDark = computed(() => this.themeService.theme() === 'dark');

  requestMenu(): void {
    this.menuRequested.emit();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }
}
