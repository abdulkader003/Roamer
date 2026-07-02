import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from './auth';
import { FriendCommunityService, FriendRequestItem } from './friend-community.service';
import { TripPlanningService, TripInvitationResponse } from './trip-planning.service';

export interface FriendNotificationItem {
  id: number;
  type: 'FRIEND_REQUEST' | 'TRIP_INVITATION' | 'TRIP_INVITATION_RESPONSE';
  requestId: number;
  title: string;
  description: string;
  details?: string;
  createdAt: string;
  read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FriendNotificationService {
  private readonly authService = inject(AuthService);
  private readonly friendCommunityService = inject(FriendCommunityService);
  private readonly tripPlanningService = inject(TripPlanningService);
  private dismissedNotificationsStorageKey = this.buildDismissedNotificationsStorageKey();
  private readonly notifications = signal<FriendNotificationItem[]>([]);
  private readonly dismissedNotificationKeys = signal<string[]>(this.loadDismissedNotificationKeys());
  private friendRequestStorageKey = this.buildFriendRequestStorageKey();
  private readonly storedFriendRequests = signal<FriendNotificationItem[]>(this.loadStoredFriendRequests());

  readonly items = this.notifications.asReadonly();
  readonly unreadCount = computed(() => this.notifications().filter((notification) => !notification.read).length);
  readonly hasNotifications = computed(() => this.notifications().length > 0);

  refresh(): void {
    this.ensureDismissedNotificationsLoaded();
    this.ensureStoredFriendRequestsLoaded();

    forkJoin({
      requests: this.friendCommunityService.listIncomingRequests().pipe(catchError(() => of(null))),
      invitations: this.tripPlanningService.listIncomingTripInvitations().pipe(catchError(() => of(null))),
      sentInvitations: this.tripPlanningService.listSentTripInvitations().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ requests, invitations, sentInvitations }) => {
        if (requests && invitations && sentInvitations) {
          this.syncNotifications(requests, invitations, sentInvitations);
          return;
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
      },
      error: () => {
        // Keep the last known notifications if the refresh fails.
      }
    });
  }

  syncIncomingRequests(requests: FriendRequestItem[]): void {
    this.ensureStoredFriendRequestsLoaded();
    const previousState = new Map(this.notifications().map((notification) => [`${notification.type}:${notification.requestId}`, notification.read]));
    const currentTripNotifications = this.notifications().filter((notification) => notification.type !== 'FRIEND_REQUEST');
    const existingFriendNotifications = new Map(
      this.storedFriendRequests().map((notification) => [notification.requestId, notification])
    );

    requests.forEach((request) => {
      const notification = this.friendRequestNotification(request, previousState);
      if (!this.isDismissed(notification.type, notification.requestId)) {
        const existing = existingFriendNotifications.get(notification.requestId);
        existingFriendNotifications.set(notification.requestId, {
          ...existing,
          ...notification,
          read: existing?.read ?? notification.read,
        });
      }
    });

    const nextFriendRequests = [...existingFriendNotifications.values()]
      .filter((notification) => !this.isDismissed(notification.type, notification.requestId));

    this.storedFriendRequests.set(nextFriendRequests);
    this.persistStoredFriendRequests();
    this.notifications.set([
      ...nextFriendRequests,
      ...currentTripNotifications,
    ]);
  }

  syncTripInvitations(invitations: TripInvitationResponse[]): void {
    const previousState = new Map(this.notifications().map((notification) => [`${notification.type}:${notification.requestId}`, notification.read]));
    const currentFriendRequests = this.notifications().filter((notification) => notification.type === 'FRIEND_REQUEST');
    const visibleInvitations = this.filterVisibleNotifications(
      invitations.map((invitation) => this.mapTripInvitation(invitation, 'TRIP_INVITATION'))
    ).map((notification) => notification.source);

    const tripNotifications = visibleInvitations.map((invitation) => {
      const inviterName = this.displayName(
        invitation.invitedBy.username,
        invitation.invitedBy.firstName,
        invitation.invitedBy.lastName,
      );
      const description = `${inviterName} invited you to ${invitation.trip.name}.`;

      return {
        id: invitation.id,
        type: 'TRIP_INVITATION' as const,
        requestId: invitation.id,
        title: 'Trip invitation',
        description,
        details: `${this.formatTripDetails(invitation.trip.destination, invitation.trip.startDate, invitation.trip.endDate, invitation.trip.budget)} · ${invitation.invitedBy.username} invited you.`,
        createdAt: invitation.createdAt,
        read: previousState.get(`TRIP_INVITATION:${invitation.id}`) ?? false,
      };
    });

    this.notifications.set([...currentFriendRequests, ...tripNotifications]);
  }

  syncSentTripInvitationResponses(invitations: TripInvitationResponse[]): void {
    const previousState = new Map(this.notifications().map((notification) => [`${notification.type}:${notification.requestId}`, notification.read]));
    const currentFriendRequests = this.notifications().filter((notification) => notification.type === 'FRIEND_REQUEST');
    const currentIncomingInvitations = this.notifications().filter((notification) => notification.type === 'TRIP_INVITATION');
    const responseInvitations = invitations.filter((invitation) => invitation.status !== 'PENDING');
    const visibleResponses = this.filterVisibleNotifications(
      responseInvitations.map((invitation) => this.mapTripInvitation(invitation, 'TRIP_INVITATION_RESPONSE'))
    ).map((notification) => notification.source);

    const responseNotifications = visibleResponses.map((invitation) => {
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
        read: previousState.get(`TRIP_INVITATION_RESPONSE:${invitation.id}`) ?? false,
      };
    });

    this.notifications.set([...currentFriendRequests, ...currentIncomingInvitations, ...responseNotifications]);
  }

  private syncNotifications(requests: FriendRequestItem[], invitations: TripInvitationResponse[], sentInvitations: TripInvitationResponse[]): void {
    this.ensureStoredFriendRequestsLoaded();
    const previousState = new Map(this.notifications().map((notification) => [`${notification.type}:${notification.requestId}`, notification.read]));
    const visibleInvitations = this.filterVisibleNotifications(
      invitations.map((invitation) => this.mapTripInvitation(invitation, 'TRIP_INVITATION'))
    ).map((notification) => notification.source);
    const responseInvitations = sentInvitations.filter((invitation) => invitation.status !== 'PENDING');
    const visibleResponses = this.filterVisibleNotifications(
      responseInvitations.map((invitation) => this.mapTripInvitation(invitation, 'TRIP_INVITATION_RESPONSE'))
    ).map((notification) => notification.source);

    const friendNotifications = this.mergeFriendRequestNotifications(requests, previousState);

    const tripNotifications = visibleInvitations.map((invitation) => {
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
        read: previousState.get(`TRIP_INVITATION:${invitation.id}`) ?? false,
      };
    });

    const responseNotifications = visibleResponses.map((invitation) => {
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
        read: previousState.get(`TRIP_INVITATION_RESPONSE:${invitation.id}`) ?? false,
      };
    });

    this.notifications.set([...friendNotifications, ...tripNotifications, ...responseNotifications]);
  }

  private mergeFriendRequestNotifications(
    requests: FriendRequestItem[],
    previousState: Map<string, boolean>
  ): FriendNotificationItem[] {
    const existingFriendNotifications = new Map(
      this.storedFriendRequests().map((notification) => [notification.requestId, notification])
    );

    requests.forEach((request) => {
      const notification = this.friendRequestNotification(request, previousState);
      if (!this.isDismissed(notification.type, notification.requestId)) {
        const existing = existingFriendNotifications.get(notification.requestId);
        existingFriendNotifications.set(notification.requestId, {
          ...existing,
          ...notification,
          read: existing?.read ?? notification.read,
        });
      }
    });

    const nextFriendRequests = [...existingFriendNotifications.values()]
      .filter((notification) => !this.isDismissed(notification.type, notification.requestId));

    this.storedFriendRequests.set(nextFriendRequests);
    this.persistStoredFriendRequests();
    return nextFriendRequests;
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
    this.ensureDismissedNotificationsLoaded();
    this.ensureStoredFriendRequestsLoaded();
    const key = this.notificationKey(notification.type, notification.requestId);
    this.dismissedNotificationKeys.update((keys) => (keys.includes(key) ? keys : [...keys, key]));
    this.persistDismissedNotifications();
    if (notification.type === 'FRIEND_REQUEST') {
      this.storedFriendRequests.update((items) => items.filter((item) => item.requestId !== notification.requestId));
      this.persistStoredFriendRequests();
    }
    this.notifications.update((notifications) =>
      notifications.filter((item) => this.notificationKey(item.type, item.requestId) !== key)
    );
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
    this.notifications.update((notifications) => notifications.map((notification) => ({ ...notification, read: true })));
  }

  clear(): void {
    this.notifications.set([]);
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

  private buildFriendRequestStorageKey(): string {
    const email = this.authService.email()?.trim().toLowerCase();
    return email ? `roamer.friend-request-notifications.${email}` : 'roamer.friend-request-notifications';
  }

  private loadStoredFriendRequests(): FriendNotificationItem[] {
    const storage = this.getStorage();

    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(this.friendRequestStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((item): item is FriendNotificationItem => Boolean(item && item.type === 'FRIEND_REQUEST'));
    } catch {
      return [];
    }
  }

  private persistStoredFriendRequests(): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    storage.setItem(this.friendRequestStorageKey, JSON.stringify(this.storedFriendRequests()));
  }

  private ensureStoredFriendRequestsLoaded(): void {
    const nextStorageKey = this.buildFriendRequestStorageKey();

    if (this.friendRequestStorageKey === nextStorageKey) {
      return;
    }

    this.friendRequestStorageKey = nextStorageKey;
    this.storedFriendRequests.set(this.loadStoredFriendRequests());
  }

  private notificationKey(type: FriendNotificationItem['type'], requestId: number): string {
    return `${type}:${requestId}`;
  }

  private isDismissed(type: FriendNotificationItem['type'], requestId: number): boolean {
    return this.dismissedNotificationKeys().includes(this.notificationKey(type, requestId));
  }

  private getStorage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }
}
