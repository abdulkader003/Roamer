import { computed, inject, Injectable, signal } from '@angular/core';
import { FriendCommunityService, FriendRequestItem } from './friend-community.service';

export interface FriendNotificationItem {
  id: number;
  requestId: number;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FriendNotificationService {
  private readonly friendCommunityService = inject(FriendCommunityService);
  private readonly notifications = signal<FriendNotificationItem[]>([]);

  readonly items = this.notifications.asReadonly();
  readonly unreadCount = computed(() => this.notifications().filter((notification) => !notification.read).length);
  readonly hasNotifications = computed(() => this.notifications().length > 0);

  refresh(): void {
    this.friendCommunityService.listIncomingRequests().subscribe({
      next: (requests) => this.syncIncomingRequests(requests),
      error: () => {
        // Keep the last known notifications if the refresh fails.
      }
    });
  }

  syncIncomingRequests(requests: FriendRequestItem[]): void {
    const previousState = new Map(this.notifications().map((notification) => [notification.requestId, notification.read]));

    this.notifications.set(requests.map((request) => {
      const senderName = this.displayName(request.sender.username, request.sender.firstName, request.sender.lastName);
      const description = `${senderName} sent you a friend request.`;

      return {
        id: request.id,
        requestId: request.id,
        title: 'New friend request',
        description,
        createdAt: request.createdAt,
        read: previousState.get(request.id) ?? false
      };
    }));
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
}
