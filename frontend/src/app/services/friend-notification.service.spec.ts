import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FriendCommunityService } from './friend-community.service';
import { FriendNotificationService } from './friend-notification.service';

describe('FriendNotificationService', () => {
  it('syncs incoming friend requests into notifications', () => {
    const friendCommunityService = {
      listIncomingRequests: () => of([
        {
          id: 15,
          sender: {
            id: 2,
            username: 'friend',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'friend@example.com',
            verified: true,
            profilePictureUpdatedAt: null,
          },
          createdAt: '2026-07-01T10:15:30',
        },
      ]),
    };

    TestBed.configureTestingModule({
      providers: [
        FriendNotificationService,
        { provide: FriendCommunityService, useValue: friendCommunityService },
      ],
    });

    const service = TestBed.inject(FriendNotificationService);

    service.refresh();

    expect(service.items().length).toBe(1);
    expect(service.items()[0].description).toContain('Ada Lovelace sent you a friend request.');
    expect(service.unreadCount()).toBe(1);

    service.markAllAsRead();
    expect(service.unreadCount()).toBe(0);
  });
});
