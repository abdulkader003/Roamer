import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import { AuthService } from './auth';
import { FriendCommunityService, FriendRequestItem } from './friend-community.service';
import { RealtimeWebSocketService } from './realtime-websocket.service';
import { TripPlanningService, TripInvitationResponse, TripRealtimeEvent, TripResponse } from './trip-planning.service';

export interface FriendNotificationItem {
  id: number;
  type: 'FRIEND_REQUEST' | 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE' | 'TRIP_UPDATE' | 'TRIP_BUDGET_UPDATE' | 'TRIP_PARTICIPANT_JOINED' | 'TRIP_PARTICIPANT_LEFT' | 'TRIP_REMINDER' | 'BUDGET_ALERT';
  requestId: number;
  title: string;
  description: string;
  details?: string;
  createdAt: string;
  read: boolean;
}

export interface RealtimeNotificationMessage {
  eventType: string;
  notificationType: FriendNotificationItem['type'];
  notificationId: number;
  title: string;
  description: string;
  details?: string | null;
  createdAt: string;
  relatedEntityId?: number | null;
  actorEmail?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class FriendNotificationService {
  private readonly authService = inject(AuthService);
  private readonly friendCommunityService = inject(FriendCommunityService);
  private readonly tripPlanningService = inject(TripPlanningService);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly realtimeWebSocketService = inject(RealtimeWebSocketService, { optional: true });
  private dismissedNotificationsStorageKey = this.buildDismissedNotificationsStorageKey();
  private notificationsStorageKey = this.buildNotificationsStorageKey();
  private readonly notifications = signal<FriendNotificationItem[]>(this.loadStoredNotifications());
  private readonly dismissedNotificationKeys = signal<string[]>(this.loadDismissedNotificationKeys());
  private readNotificationKeysStorageKey = this.buildReadNotificationsStorageKey();
  private readonly readNotificationKeys = signal<string[]>(this.loadReadNotificationKeys());
  private readonly budgetAlertToastNotification = signal<FriendNotificationItem | null>(null);
  private readonly tripTopicSubscriptions = new Map<number, Subscription>();
  private budgetAlertToastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly items = this.notifications.asReadonly();
  readonly budgetAlertToast = this.budgetAlertToastNotification.asReadonly();
  readonly unreadCount = computed(() => this.notifications().filter((notification) => !notification.read && !this.isReadNotification(notification) && !this.isDismissed(notification.type, notification.requestId)).length);
  readonly hasNotifications = computed(() => this.notifications().length > 0);

  constructor() {
    this.realtimeWebSocketService?.observe<RealtimeNotificationMessage>('/user/queue/notifications').subscribe((message) => {
      this.ingestRealtimeNotification(message);
    });

    effect(
      () => {
        const token = (this.authService.token?.() ?? '').trim();

        if (!token) {
          this.clearTripTopicSubscriptions();
          return;
        }

        this.refreshTripTopicSubscriptions();
      },
      { allowSignalWrites: true }
    );
  }

  refresh(): void {
    this.ensureNotificationsLoaded();
    this.ensureDismissedNotificationsLoaded();

    forkJoin({
      requests: this.friendCommunityService.listIncomingRequests().pipe(catchError(() => of(null))),
      invitations: this.tripPlanningService.listIncomingTripInvitations().pipe(catchError(() => of(null))),
      sentInvitations: this.tripPlanningService.listSentTripInvitations().pipe(catchError(() => of(null))),
      persistedNotifications: this.listPersistedNotifications().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ requests, invitations, sentInvitations, persistedNotifications }) => {
        if (requests && invitations && sentInvitations) {
          this.syncNotifications(requests, invitations, sentInvitations);
        }

        if (requests) {
          this.syncIncomingRequests(requests);
        }

        if (invitations) {
          this.syncTripInvitations(invitations);
        }

        if (sentInvitations) {
          this.syncSentTripInvitationResponses(sentInvitations);
        }

        if (persistedNotifications) {
          this.syncPersistedNotifications(persistedNotifications);
        }

        this.refreshTripTopicSubscriptions();
      },
      error: () => {
        // Keep the last known notifications if the refresh fails.
      }
    });
  }

  syncIncomingRequests(requests: FriendRequestItem[]): void {
    this.ensureNotificationsLoaded();
    this.ensureReadNotificationsLoaded();
    this.mergeNotifications(
      requests.map((request) => this.friendRequestNotification(request, new Map(this.notifications().map((notification) => [`${notification.type}:${notification.requestId}`, notification.read]))))
    );
  }

  syncTripInvitations(invitations: TripInvitationResponse[]): void {
    this.ensureNotificationsLoaded();
    this.ensureReadNotificationsLoaded();
    this.mergeNotifications(
      this.filterVisibleNotifications(
        invitations.map((invitation) => this.mapTripInvitation(invitation, 'TRIP_INVITATION'))
      ).map((notification) => notification.source).map((invitation) => {
        const inviterName = this.displayName(
          invitation.invitedBy.username,
          invitation.invitedBy.firstName,
          invitation.invitedBy.lastName,
        );

        return {
          id: invitation.id,
          type: 'TRIP_INVITATION' as const,
          requestId: invitation.id,
          title: 'Trip invitation',
          description: `${inviterName} invited you to ${invitation.trip.name}.`,
          details: `${this.formatTripDetails(invitation.trip.destination, invitation.trip.startDate, invitation.trip.endDate, invitation.trip.budget)} · ${inviterName} invited you.`,
          createdAt: invitation.createdAt,
          read: false,
        };
      })
    );
  }

  syncSentTripInvitationResponses(invitations: TripInvitationResponse[]): void {
    this.ensureNotificationsLoaded();
    this.ensureReadNotificationsLoaded();
    const responseNotifications = this.filterVisibleNotifications(
      invitations
        .filter((invitation) => invitation.status !== 'PENDING')
        .map((invitation) => this.mapTripInvitation(invitation, 'TRIP_INVITATION_RESPONSE'))
    ).map((notification) => {
      const invitation = notification.source;
      const invitedUserName = this.displayName(
        invitation.invitedUser.username,
        invitation.invitedUser.firstName,
        invitation.invitedUser.lastName,
      );
      const statusLabel = invitation.status === 'ACCEPTED' ? 'accepted' : 'declined';

      return {
        id: invitation.id,
        type: 'TRIP_INVITATION_RESPONSE' as const,
        requestId: invitation.id,
        title: `Trip invite ${statusLabel}`,
        description: `${invitedUserName} ${statusLabel} your invitation to ${invitation.trip.name}.`,
        details: this.formatTripDetails(invitation.trip.destination, invitation.trip.startDate, invitation.trip.endDate, invitation.trip.budget),
        createdAt: invitation.createdAt,
        read: false,
      };
    });

    this.mergeNotifications(responseNotifications);
  }

  private syncNotifications(requests: FriendRequestItem[], invitations: TripInvitationResponse[], sentInvitations: TripInvitationResponse[]): void {
    this.ensureNotificationsLoaded();
    this.ensureReadNotificationsLoaded();
    const previousState = new Map(this.notifications().map((notification) => [`${notification.type}:${notification.requestId}`, notification.read]));
    const friendNotifications = requests.map((request) => this.friendRequestNotification(request, previousState));
    const tripNotifications = this.filterVisibleNotifications(
      invitations.map((invitation) => this.mapTripInvitation(invitation, 'TRIP_INVITATION'))
    ).map((notification) => ({
      id: notification.id,
      type: 'TRIP_INVITATION' as const,
      requestId: notification.requestId,
      title: notification.title,
      description: notification.description,
      details: notification.details,
      createdAt: notification.createdAt,
      read: this.isRead('TRIP_INVITATION', notification.requestId) || notification.read,
    }));
    const responseNotifications = this.filterVisibleNotifications(
      sentInvitations
        .filter((invitation) => invitation.status !== 'PENDING')
        .map((invitation) => this.mapTripInvitation(invitation, 'TRIP_INVITATION_RESPONSE'))
    ).map((notification) => ({
      id: notification.id,
      type: 'TRIP_INVITATION_RESPONSE' as const,
      requestId: notification.requestId,
      title: notification.title,
      description: notification.description,
      details: notification.details,
      createdAt: notification.createdAt,
      read: this.isRead('TRIP_INVITATION_RESPONSE', notification.requestId) || notification.read,
    }));

    this.mergeNotifications([...friendNotifications, ...tripNotifications, ...responseNotifications]);
  }

  private friendRequestNotification(
    request: FriendRequestItem,
    previousState: Map<string, boolean>
  ): FriendNotificationItem {
    const senderName = this.displayName(request.sender.username, request.sender.firstName, request.sender.lastName);
    return {
      id: request.id,
      type: 'FRIEND_REQUEST',
      requestId: request.id,
      title: 'New friend request',
      description: `${senderName} sent you a friend request.`,
      createdAt: request.createdAt,
      read: previousState.get(`FRIEND_REQUEST:${request.id}`) ?? false,
    };
  }

  dismissNotification(notification: FriendNotificationItem): void {
    this.ensureNotificationsLoaded();
    this.ensureDismissedNotificationsLoaded();
    const key = this.dismissedNotificationKey(notification);
    this.dismissedNotificationKeys.update((keys) => (keys.includes(key) ? keys : [...keys, key]));
    this.persistDismissedNotifications();
    this.notifications.update((notifications) =>
      notifications.filter((item) => this.dismissedNotificationKey(item) !== key)
    );
    this.persistNotifications();
  }

  dismissBudgetAlertToast(): void {
    this.clearBudgetAlertToastTimeout();
    this.budgetAlertToastNotification.set(null);
  }

  dismissTripInvitation(invitationId: number): void {
    const notification = this.notifications().find((item) => item.requestId === invitationId && item.type !== 'FRIEND_REQUEST');
    if (notification) {
      this.dismissNotification(notification);
      return;
    }

    const fallbackNotification: FriendNotificationItem = {
      id: invitationId,
      type: 'TRIP_INVITATION',
      requestId: invitationId,
      title: '',
      description: '',
      createdAt: new Date().toISOString(),
      read: true,
    };
    this.dismissNotification(fallbackNotification);
  }

  markAllAsRead(): void {
    this.ensureNotificationsLoaded();
    this.ensureReadNotificationsLoaded();
    const keys = this.notifications().map((notification) => this.readNotificationKey(notification));
    this.readNotificationKeys.set(Array.from(new Set([...this.readNotificationKeys(), ...keys])));
    this.persistReadNotifications();
    this.notifications.update((notifications) => notifications.map((notification) => ({ ...notification, read: true })));
    this.persistNotifications();
  }

  clear(): void {
    this.notifications.set([]);
    this.dismissBudgetAlertToast();
    this.clearTripTopicSubscriptions();
  }

  private displayName(username: string, firstName?: string | null, lastName?: string | null): string {
    const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
    return parts.length ? parts.join(' ') : username;
  }

  private formatTripDetails(destination: string, startDate: string, endDate: string, budget: number): string {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const budgetLabel = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(Number(budget ?? 0));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return `${destination} · ${budgetLabel}`;
    }

    const format = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${destination} · ${format.format(start)} → ${format.format(end)} · ${budgetLabel}`;
  }

  private filterVisibleNotifications(notifications: Array<FriendNotificationItem & { source: TripInvitationResponse }>): Array<FriendNotificationItem & { source: TripInvitationResponse }> {
    return notifications.filter((notification) => !this.isDismissed(notification.type, notification.requestId));
  }

  private mapTripInvitation(invitation: TripInvitationResponse, type: FriendNotificationItem['type']): FriendNotificationItem & { source: TripInvitationResponse } {
    const inviterName = this.displayName(
      invitation.invitedBy.username,
      invitation.invitedBy.firstName,
      invitation.invitedBy.lastName,
    );
    const invitedUserName = this.displayName(
      invitation.invitedUser.username,
      invitation.invitedUser.firstName,
      invitation.invitedUser.lastName,
    );
    const description = type === 'TRIP_INVITATION'
      ? `${inviterName} invited you to ${invitation.trip.name}.`
      : `${invitedUserName} ${invitation.status === 'ACCEPTED' ? 'accepted' : 'declined'} your invitation to ${invitation.trip.name}.`;

    return {
      id: invitation.id,
      type,
      requestId: invitation.id,
      title: type === 'TRIP_INVITATION' ? 'Trip invitation' : `Trip invite ${invitation.status === 'ACCEPTED' ? 'accepted' : 'declined'}`,
      description,
      details: `${this.formatTripDetails(invitation.trip.destination, invitation.trip.startDate, invitation.trip.endDate, invitation.trip.budget)} · ${type === 'TRIP_INVITATION' ? inviterName : invitedUserName}`,
      createdAt: invitation.createdAt,
      read: false,
      source: invitation,
    };
  }

  private loadDismissedNotificationKeys(): string[] {
    const storage = this.getStorage();

    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(this.dismissedNotificationsStorageKey);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((value) => String(value))
        .filter((value) => value.length > 0);
    } catch {
      return [];
    }
  }

  private persistDismissedNotifications(): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    storage.setItem(this.dismissedNotificationsStorageKey, JSON.stringify(this.dismissedNotificationKeys()));
  }

  private loadReadNotificationKeys(): string[] {
    const storage = this.getStorage();

    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(this.readNotificationKeysStorageKey);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((value) => String(value))
        .filter((value) => value.length > 0);
    } catch {
      return [];
    }
  }

  private persistReadNotifications(): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    storage.setItem(this.readNotificationKeysStorageKey, JSON.stringify(this.readNotificationKeys()));
  }

  private ensureReadNotificationsLoaded(): void {
    const nextStorageKey = this.buildReadNotificationsStorageKey();

    if (this.readNotificationKeysStorageKey === nextStorageKey) {
      return;
    }

    this.readNotificationKeysStorageKey = nextStorageKey;
    this.readNotificationKeys.set(this.loadReadNotificationKeys());
  }

  private ensureDismissedNotificationsLoaded(): void {
    const nextStorageKey = this.buildDismissedNotificationsStorageKey();

    if (this.dismissedNotificationsStorageKey === nextStorageKey) {
      return;
    }

    this.dismissedNotificationsStorageKey = nextStorageKey;
    this.dismissedNotificationKeys.set(this.loadDismissedNotificationKeys());
  }

  private buildDismissedNotificationsStorageKey(): string {
    const email = this.authService.email()?.trim().toLowerCase();
    return email ? `roamer.dismissed-notifications.${email}` : 'roamer.dismissed-notifications';
  }

  private buildNotificationsStorageKey(): string {
    const email = this.authService.email()?.trim().toLowerCase();
    return email ? `roamer.notifications.${email}` : 'roamer.notifications';
  }

  private buildReadNotificationsStorageKey(): string {
    const email = this.authService.email()?.trim().toLowerCase();
    return email ? `roamer.read-notifications.${email}` : 'roamer.read-notifications';
  }

  private loadStoredNotifications(): FriendNotificationItem[] {
    const storage = this.getStorage();

    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(this.notificationsStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((item): item is FriendNotificationItem => Boolean(item && item.type && item.requestId !== undefined));
    } catch {
      return [];
    }
  }

  private persistNotifications(): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    storage.setItem(this.notificationsStorageKey, JSON.stringify(this.notifications()));
  }

  private notificationKey(type: FriendNotificationItem['type'], requestId: number): string {
    return `${type}:${requestId}`;
  }

  private isDismissed(type: FriendNotificationItem['type'], requestId: number): boolean {
    return this.dismissedNotificationKeys().includes(this.notificationKey(type, requestId));
  }

  private isDismissedNotification(notification: FriendNotificationItem): boolean {
    return this.dismissedNotificationKeys().includes(this.dismissedNotificationKey(notification));
  }

  private dismissedNotificationKey(notification: FriendNotificationItem): string {
    if (notification.type === 'BUDGET_ALERT') {
      return `${notification.type}:${notification.requestId}:${notification.createdAt}`;
    }

    return this.notificationKey(notification.type, notification.requestId);
  }

  private isRead(type: FriendNotificationItem['type'], requestId: number): boolean {
    return this.readNotificationKeys().includes(this.notificationKey(type, requestId));
  }

  private isReadNotification(notification: FriendNotificationItem): boolean {
    return this.readNotificationKeys().includes(this.readNotificationKey(notification));
  }

  private readNotificationKey(notification: FriendNotificationItem): string {
    if (notification.type === 'BUDGET_ALERT') {
      return `${notification.type}:${notification.requestId}:${notification.createdAt}`;
    }

    return this.notificationKey(notification.type, notification.requestId);
  }

  private mergeNotifications(nextNotifications: FriendNotificationItem[]): void {
    this.ensureNotificationsLoaded();
    this.ensureDismissedNotificationsLoaded();
    this.ensureReadNotificationsLoaded();
    const existingNotifications = new Map(
      this.notifications().map((notification) => [this.notificationKey(notification.type, notification.requestId), notification])
    );

    nextNotifications.forEach((notification) => {
      if (this.isDismissedNotification(notification)) {
        return;
      }

      const key = this.notificationKey(notification.type, notification.requestId);
      const existing = existingNotifications.get(key);
      const isNewPopoverNotificationVersion = (notification.type === 'BUDGET_ALERT' || notification.type === 'TRIP_REMINDER')
        && !this.isReadNotification(notification)
        && (!existing || this.readNotificationKey(existing) !== this.readNotificationKey(notification));
      const existingReadStillApplies = existing
        ? this.readNotificationKey(existing) === this.readNotificationKey(notification) && existing.read
        : false;
      existingNotifications.set(key, {
        ...existing,
        ...notification,
        read: this.isReadNotification(notification) || existingReadStillApplies || notification.read,
      });

      if (isNewPopoverNotificationVersion && !notification.read) {
        this.showBudgetAlertToast(notification);
      }
    });

    const merged = [...existingNotifications.values()]
      .filter((notification) => !this.isDismissedNotification(notification))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    this.notifications.set(merged);
    this.persistNotifications();
  }

  private listPersistedNotifications() {
    if (!this.http) {
      return of([] as RealtimeNotificationMessage[]);
    }

    const authHeaders = typeof this.authService.authHeader === 'function' ? this.authService.authHeader() : {};
    if (!authHeaders['Authorization']) {
      return of([] as RealtimeNotificationMessage[]);
    }

    return this.http.get<RealtimeNotificationMessage[]>('/api/notifications', {
      headers: authHeaders,
    });
  }

  private syncPersistedNotifications(messages: RealtimeNotificationMessage[]): void {
    const persistedItems = messages
      .map((message) => this.toPersistedNotificationItem(message))
      .filter((item): item is FriendNotificationItem => item !== null);
    const persistedKeys = new Set(persistedItems.map((item) => this.notificationKey(item.type, item.requestId)));
    const persistedTypes: FriendNotificationItem['type'][] = ['TRIP_REMINDER', 'BUDGET_ALERT', 'TRIP_UPDATE'];

    this.notifications.update((notifications) =>
      notifications.filter((notification) =>
        !persistedTypes.includes(notification.type) || persistedKeys.has(this.notificationKey(notification.type, notification.requestId))
      )
    );
    this.mergeNotifications(persistedItems);
  }

  private toPersistedNotificationItem(message: RealtimeNotificationMessage): FriendNotificationItem | null {
    if (!message?.notificationId || !message.notificationType) {
      return null;
    }

    if (message.notificationType !== 'TRIP_REMINDER' && message.notificationType !== 'BUDGET_ALERT' && message.notificationType !== 'TRIP_UPDATE') {
      return null;
    }

    return {
      id: message.notificationId,
      type: message.notificationType,
      requestId: message.notificationId,
      title: message.title,
      description: message.description,
      details: message.details ?? undefined,
      createdAt: message.createdAt,
      read: false,
    };
  }

  private ingestRealtimeNotification(message: RealtimeNotificationMessage): void {
    if (!message?.notificationId || !message.notificationType) {
      return;
    }

    if (this.isSelfAuthoredTripNotification(message.actorEmail, message.notificationType)) {
      return;
    }

    this.mergeNotifications([
      {
        id: message.notificationId,
        type: message.notificationType,
        requestId: message.notificationId,
        title: message.title,
        description: message.description,
        details: message.details ?? undefined,
        createdAt: message.createdAt,
        read: false,
      },
    ]);
  }

  private showBudgetAlertToast(notification: FriendNotificationItem): void {
    this.clearBudgetAlertToastTimeout();
    this.budgetAlertToastNotification.set(notification);
    this.budgetAlertToastTimeoutId = setTimeout(() => {
      this.budgetAlertToastNotification.set(null);
      this.budgetAlertToastTimeoutId = null;
    }, 8000);
  }

  private clearBudgetAlertToastTimeout(): void {
    if (!this.budgetAlertToastTimeoutId) {
      return;
    }

    clearTimeout(this.budgetAlertToastTimeoutId);
    this.budgetAlertToastTimeoutId = null;
  }

  private refreshTripTopicSubscriptions(): void {
    if (!(this.authService.token?.() ?? '').trim()) {
      return;
    }

    this.tripPlanningService.listSavedTrips().subscribe({
      next: (trips) => this.syncTripTopicSubscriptions(trips),
      error: () => {
        // Keep the last known trip subscriptions if the trip list cannot be loaded.
      },
    });
  }

  private syncTripTopicSubscriptions(trips: TripResponse[]): void {
    const nextTripIds = new Set(trips.map((trip) => trip.id));

    for (const [tripId, subscription] of this.tripTopicSubscriptions.entries()) {
      if (nextTripIds.has(tripId)) {
        continue;
      }

      subscription.unsubscribe();
      this.tripTopicSubscriptions.delete(tripId);
    }

    for (const tripId of nextTripIds) {
      if (this.tripTopicSubscriptions.has(tripId)) {
        continue;
      }

      const subscription = this.tripPlanningService.observeTripTopicUpdates(tripId).subscribe((event) => {
        this.ingestTripRealtimeNotification(event);
      });

      this.tripTopicSubscriptions.set(tripId, subscription);
    }
  }

  private ingestTripRealtimeNotification(event: TripRealtimeEvent): void {
    if (
      !event?.notificationId ||
      !event.notificationType ||
      !['TRIP_UPDATE', 'TRIP_BUDGET_UPDATE', 'TRIP_PARTICIPANT_JOINED', 'TRIP_PARTICIPANT_LEFT'].includes(event.notificationType)
    ) {
      return;
    }

    if (this.isSelfAuthoredTripNotification(event.actorEmail, event.notificationType)) {
      return;
    }

    this.mergeNotifications([
      {
        id: event.notificationId,
        type: event.notificationType,
        requestId: event.notificationId,
        title: event.title,
        description: event.description,
        details: event.details ?? undefined,
        createdAt: event.createdAt,
        read: false,
      },
    ]);
  }

  private clearTripTopicSubscriptions(): void {
    for (const subscription of this.tripTopicSubscriptions.values()) {
      subscription.unsubscribe();
    }

    this.tripTopicSubscriptions.clear();
  }

  private ensureNotificationsLoaded(): void {
    const nextStorageKey = this.buildNotificationsStorageKey();

    if (this.notificationsStorageKey === nextStorageKey) {
      return;
    }

    this.notificationsStorageKey = nextStorageKey;
    this.notifications.set(this.loadStoredNotifications());
  }

  private getStorage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  private isSelfAuthoredTripNotification(
    actorEmail: string | null | undefined,
    notificationType: FriendNotificationItem['type']
  ): boolean {
    if (
      notificationType !== 'TRIP_UPDATE' &&
      notificationType !== 'TRIP_BUDGET_UPDATE' &&
      notificationType !== 'TRIP_PARTICIPANT_JOINED' &&
      notificationType !== 'TRIP_PARTICIPANT_LEFT'
    ) {
      return false;
    }

    const currentEmail = this.authService.email()?.trim().toLowerCase();
    const normalizedActorEmail = actorEmail?.trim().toLowerCase();

    return Boolean(currentEmail && normalizedActorEmail && currentEmail === normalizedActorEmail);
  }
}
