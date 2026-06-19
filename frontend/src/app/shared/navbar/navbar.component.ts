import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, OnDestroy, OnInit, Output, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ProfileStateService } from '../../services/profile-state.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly profileState = inject(ProfileStateService);
  private routerSubscription: Subscription | null = null;
  authService = inject(AuthService);
  @Output() menuRequested = new EventEmitter<void>();

  isDark = computed(() => this.themeService.theme() === 'dark');
  isAuthenticated = computed(() => this.authService.isAuthenticated());
  isAccountMenuOpen = signal(false);
  accountEmail = computed(() => this.profileState.profile()?.email || this.authService.email());
  avatarLabel = computed(() => this.profileState.avatarInitials());
  avatarImageUrl = computed(() => this.profileState.pictureUrl());
  accountDisplayName = computed(() => this.profileState.displayName());

  ngOnInit(): void {
    this.syncProfileState();
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncProfileState());
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  @HostListener('document:click')
  closeMenuFromOutsideClick(): void {
    this.closeAccountMenu();
  }

  @HostListener('document:keydown.escape')
  closeMenuFromEscape(): void {
    this.closeAccountMenu();
  }

  requestMenu(): void {
    this.menuRequested.emit();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  toggleAccountMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isAccountMenuOpen.update((isOpen) => !isOpen);
  }

  closeAccountMenu(): void {
    if (this.isAccountMenuOpen()) {
      this.isAccountMenuOpen.set(false);
    }
  }

  logout(): void {
    this.closeAccountMenu();
    this.profileState.clear();
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  onAvatarImageError(): void {
    this.profileState.clearPictureUrl();
  }

  private syncProfileState(): void {
    if (this.authService.isAuthenticated()) {
      this.profileState.loadCurrentProfile();
      return;
    }

    this.profileState.clear();
  }
}
