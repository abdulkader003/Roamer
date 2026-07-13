import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, OnDestroy, OnInit, Output, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../services/auth';
import { FriendNotificationService } from '../../services/friend-notification.service';
import { ProfileStateService } from '../../services/profile-state.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly profileState = inject(ProfileStateService);
  private readonly friendNotificationService = inject(FriendNotificationService);
  private routerSubscription: Subscription | null = null;
  private notificationPollId: ReturnType<typeof setInterval> | null = null;
  authService = inject(AuthService);
  @Output() menuRequested = new EventEmitter<void>();

  isDark = computed(() => this.themeService.resolvedTheme() === 'dark');
  isAuthenticated = computed(() => this.authService.isAuthenticated());
  isAccountMenuOpen = signal(false);
  isNotificationMenuOpen = signal(false);
  accountEmail = computed(() => this.profileState.profile()?.email || this.authService.email());
  avatarLabel = computed(() => this.profileState.avatarInitials());
  avatarImageUrl = computed(() => this.profileState.pictureUrl());
  accountDisplayName = computed(() => this.profileState.displayName());
  notificationItems = this.friendNotificationService.items;
  unreadNotificationCount = this.friendNotificationService.unreadCount;
  hasFriendNotifications = computed(() => this.notificationItems().some((notification) => notification.type === 'FRIEND_REQUEST'));
  hasTripNotifications = computed(() => this.notificationItems().some((notification) => notification.type !== 'FRIEND_REQUEST'));

  ngOnInit(): void {
    this.syncProfileState();
    this.startNotificationPolling();
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncProfileState());
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    if (this.notificationPollId) {
      window.clearInterval(this.notificationPollId);
      this.notificationPollId = null;
    }
  }

  @HostListener('document:click')
  closeMenuFromOutsideClick(): void {
    this.closeAccountMenu();
    this.closeNotificationMenu();
  }

  @HostListener('document:keydown.escape')
  closeMenuFromEscape(): void {
    this.closeAccountMenu();
    this.closeNotificationMenu();
  }

  requestMenu(): void {
    this.menuRequested.emit();
  }

  toggleTheme(event?: MouseEvent): void {
    event?.stopPropagation();
    this.themeService.toggle();
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.isNotificationMenuOpen.update((isOpen) => !isOpen);

    if (!this.isNotificationMenuOpen()) {
      return;
    }

    this.friendNotificationService.markAllAsRead();
  }

  dismissNotification(event: MouseEvent, notification: { type: 'FRIEND_REQUEST' | 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE'; requestId: number }): void {
    event.stopPropagation();
    const item = this.notificationItems().find((entry) => entry.type === notification.type && entry.requestId === notification.requestId);
    if (item) {
      this.friendNotificationService.dismissNotification(item);
    }
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

  closeNotificationMenu(): void {
    if (this.isNotificationMenuOpen()) {
      this.isNotificationMenuOpen.set(false);
    }
  }

  logout(): void {
    this.closeAccountMenu();
    this.closeNotificationMenu();
    this.friendNotificationService.clear();
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
      this.friendNotificationService.refresh();
      return;
    }

    this.profileState.clear();
    this.friendNotificationService.clear();
  }

  private startNotificationPolling(): void {
    this.notificationPollId = window.setInterval(() => {
      if (this.authService.isAuthenticated()) {
        this.friendNotificationService.refresh();
        return;
      }

      this.friendNotificationService.clear();
    }, 45000);
  }
}
