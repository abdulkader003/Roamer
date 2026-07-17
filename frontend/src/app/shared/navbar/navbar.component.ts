import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, OnDestroy, OnInit, Output, computed, effect, inject, signal } from '@angular/core';
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
  private notificationAppearanceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private notificationDismissTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private notificationPulseTimerId: ReturnType<typeof setTimeout> | null = null;
  private readonly knownNotificationKeys = signal<string[]>([]);
  private readonly freshNotificationKeys = signal<string[]>([]);
  private readonly dismissingNotificationKeys = signal<string[]>([]);
  readonly notificationPulseActive = signal(false);
  private notificationSnapshotInitialized = false;
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
  budgetAlertToast = this.friendNotificationService.budgetAlertToast;
  unreadNotificationCount = this.friendNotificationService.unreadCount;
  hasFriendNotifications = computed(() => this.notificationItems().some((notification) => notification.type === 'FRIEND_REQUEST'));
  hasBudgetNotifications = computed(() => this.notificationItems().some((notification) => notification.type === 'BUDGET_ALERT'));
  hasTripNotifications = computed(() => this.notificationItems().some((notification) => notification.type !== 'FRIEND_REQUEST' && notification.type !== 'BUDGET_ALERT'));

  ngOnInit(): void {
    this.syncProfileState();
    this.startNotificationPolling();
    this.setupNotificationAnimations();
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
    if (this.notificationPulseTimerId) {
      window.clearTimeout(this.notificationPulseTimerId);
      this.notificationPulseTimerId = null;
    }
    this.clearNotificationAppearanceTimers();
    this.clearNotificationDismissTimers();
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

    this.friendNotificationService.refresh();
    this.friendNotificationService.markAllAsRead();
  }

  markAllNotificationsAsRead(event: MouseEvent): void {
    event.stopPropagation();

  }

  dismissNotification(event: MouseEvent, notification: { type: 'FRIEND_REQUEST' | 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE' | 'TRIP_UPDATE' | 'TRIP_BUDGET_UPDATE' | 'TRIP_PARTICIPANT_JOINED' | 'TRIP_PARTICIPANT_LEFT' | 'TRIP_REMINDER' | 'BUDGET_ALERT'; requestId: number }): void {
    event.stopPropagation();
    const item = this.notificationItems().find((entry) => entry.type === notification.type && entry.requestId === notification.requestId);
    if (item) {
      const key = this.notificationKey(notification.type, notification.requestId);
      if (this.dismissingNotificationKeys().includes(key)) {
        return;
      }

      this.dismissingNotificationKeys.update((keys) => [...keys, key]);

      const existingTimer = this.notificationDismissTimers.get(key);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      const timer = window.setTimeout(() => {
        this.notificationDismissTimers.delete(key);
        this.dismissingNotificationKeys.update((keys) => keys.filter((current) => current !== key));
        this.friendNotificationService.dismissNotification(item);
      }, 180);

      this.notificationDismissTimers.set(key, timer);
    }
  }

  dismissBudgetAlertToast(event: MouseEvent): void {
    event.stopPropagation();
    this.friendNotificationService.dismissBudgetAlertToast();
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

  notificationTone(notification: { type: string; title?: string; description?: string }): 'trip' | 'budget' | 'invitation' | 'reminder' | 'system' | 'flight' | 'hotel' | 'activity' {
    switch (notification.type) {
      case 'TRIP_UPDATE':
      case 'TRIP_PARTICIPANT_JOINED':
      case 'TRIP_PARTICIPANT_LEFT':
        return 'trip';
      case 'TRIP_BUDGET_UPDATE':
        return 'budget';
      case 'TRIP_INVITATION':
      case 'TRIP_INVITATION_RESPONSE':
        return 'invitation';
      case 'FRIEND_REQUEST':
        return 'reminder';
      default: {
        const text = `${notification.title ?? ''} ${notification.description ?? ''}`.toLowerCase();
        if (text.includes('flight')) return 'flight';
        if (text.includes('hotel')) return 'hotel';
        if (text.includes('activity')) return 'activity';
        return 'system';
      }
    }
  }

  notificationIconLabel(notification: { type: string; title?: string; description?: string }): string {
    switch (this.notificationTone(notification)) {
      case 'trip': return 'Trip';
      case 'budget': return 'Budget';
      case 'invitation': return 'Invite';
      case 'reminder': return 'Reminder';
      case 'flight': return 'Flight';
      case 'hotel': return 'Hotel';
      case 'activity': return 'Activity';
      default: return 'Info';
    }
  }

  isFreshNotification(notification: { type: string; requestId: number }): boolean {
    return this.freshNotificationKeys().includes(this.notificationKey(notification.type, notification.requestId));
  }

  formatRelativeNotificationTime(createdAt: string): string {
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) {
      return '';
    }

    const diffMs = Date.now() - created.getTime();
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSeconds < 45) {
      return 'just now';
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(created);
  }

  trackNotification(_: number, notification: { type: string; requestId: number }): string {
    return `${notification.type}-${notification.requestId}`;
  }

  notificationAriaLabel(notification: { title: string; description: string; read: boolean }): string {
    return `${notification.read ? 'Read' : 'Unread'} notification: ${notification.title}. ${notification.description}`;
  }

  notificationKey(type: string, requestId: number): string {
    return `${type}:${requestId}`;
  }

  isNotificationDismissing(notification: { type: string; requestId: number }): boolean {
    return this.dismissingNotificationKeys().includes(this.notificationKey(notification.type, notification.requestId));
  }

  private setupNotificationAnimations(): void {
    effect(
      () => {
        const nextKeys = this.notificationItems().map((notification) => this.notificationKey(notification.type, notification.requestId));

        if (!this.notificationSnapshotInitialized) {
          this.notificationSnapshotInitialized = true;
          this.knownNotificationKeys.set(nextKeys);
          return;
        }

        const previousKeys = new Set(this.knownNotificationKeys());
        const addedKeys = nextKeys.filter((key) => !previousKeys.has(key));

        this.knownNotificationKeys.set(nextKeys);

        if (!addedKeys.length) {
          return;
        }

        this.triggerNotificationPulse(addedKeys);
      },
      { allowSignalWrites: true }
    );
  }

  private triggerNotificationPulse(keys: string[]): void {
    const nextFreshKeys = new Set(this.freshNotificationKeys());
    keys.forEach((key) => {
      nextFreshKeys.add(key);

      const existingTimer = this.notificationAppearanceTimers.get(key);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      const timer = window.setTimeout(() => {
        this.notificationAppearanceTimers.delete(key);
        this.freshNotificationKeys.update((freshKeys) => freshKeys.filter((current) => current !== key));
      }, 1500);

      this.notificationAppearanceTimers.set(key, timer);
    });

    this.freshNotificationKeys.set(Array.from(nextFreshKeys));
    this.notificationPulseActive.set(true);

    if (this.notificationPulseTimerId) {
      window.clearTimeout(this.notificationPulseTimerId);
    }

    this.notificationPulseTimerId = window.setTimeout(() => {
      this.notificationPulseActive.set(false);
      this.notificationPulseTimerId = null;
    }, 360);
  }

  private clearNotificationAppearanceTimers(): void {
    this.notificationAppearanceTimers.forEach((timer) => window.clearTimeout(timer));
    this.notificationAppearanceTimers.clear();
    this.freshNotificationKeys.set([]);
    this.notificationPulseActive.set(false);
  }

  private clearNotificationDismissTimers(): void {
    this.notificationDismissTimers.forEach((timer) => window.clearTimeout(timer));
    this.notificationDismissTimers.clear();
    this.dismissingNotificationKeys.set([]);
  }

}
