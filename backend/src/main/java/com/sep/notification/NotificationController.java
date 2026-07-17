package com.sep.notification;

import com.sep.websocket.dto.RealtimeNotificationMessage;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationQueryService notificationQueryService;

    public NotificationController(NotificationQueryService notificationQueryService) {
        this.notificationQueryService = notificationQueryService;
    }

    @GetMapping
    public List<RealtimeNotificationMessage> getNotifications(Authentication authentication) {
        return notificationQueryService.getNotifications(authentication.getName());
    }
}
