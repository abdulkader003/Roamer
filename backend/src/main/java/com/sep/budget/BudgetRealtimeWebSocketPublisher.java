package com.sep.budget;

import com.sep.trip.Trip;
import com.sep.user.AppUser;
import com.sep.websocket.dto.RealtimeNotificationMessage;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Publishes shared budget and expense updates to the authenticated user queue.
 */
@Service
public class BudgetRealtimeWebSocketPublisher {

    private static final String NOTIFICATION_DESTINATION = "/queue/notifications";
    private static final AtomicLong EVENT_SEQUENCE = new AtomicLong(Instant.now().toEpochMilli() * 1000);

    private final SimpMessagingTemplate messagingTemplate;

    public BudgetRealtimeWebSocketPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishExpenseCreated(Trip trip, AppUser actor, Collection<AppUser> recipients, Expense expense) {
        publish(
                recipients,
                notification(
                        "TRIP_EXPENSE_CREATED",
                        trip,
                        "Trip budget updated",
                        displayName(actor) + " added an expense to " + trip.getName() + ".",
                        expenseDetails(expense, actor)
                )
        );
    }

    public void publishExpenseUpdated(Trip trip, AppUser actor, Collection<AppUser> recipients, Expense expense) {
        publish(
                recipients,
                notification(
                        "TRIP_EXPENSE_UPDATED",
                        trip,
                        "Trip budget updated",
                        displayName(actor) + " updated an expense on " + trip.getName() + ".",
                        expenseDetails(expense, actor)
                )
        );
    }

    public void publishExpenseDeleted(Trip trip, AppUser actor, Collection<AppUser> recipients, Expense expense) {
        publish(
                recipients,
                notification(
                        "TRIP_EXPENSE_DELETED",
                        trip,
                        "Trip budget updated",
                        displayName(actor) + " deleted an expense from " + trip.getName() + ".",
                        expenseDetails(expense, actor)
                )
        );
    }

    private void publish(Collection<AppUser> recipients, RealtimeNotificationMessage message) {
        Map<Long, AppUser> recipientsById = new LinkedHashMap<>();

        if (recipients != null) {
            for (AppUser recipient : recipients) {
                if (recipient == null || recipient.getId() == null) {
                    continue;
                }

                recipientsById.putIfAbsent(recipient.getId(), recipient);
            }
        }

        for (AppUser recipient : recipientsById.values()) {
            if (recipient.getEmail() == null || recipient.getEmail().isBlank()) {
                continue;
            }

            messagingTemplate.convertAndSendToUser(recipient.getEmail(), NOTIFICATION_DESTINATION, message);
        }
    }

    private RealtimeNotificationMessage notification(
            String eventType,
            Trip trip,
            String title,
            String description,
            String details
    ) {
        return new RealtimeNotificationMessage(
                eventType,
                "TRIP_BUDGET_UPDATE",
                nextEventId(),
                title,
                description,
                details,
                Instant.now().toString(),
                trip.getId()
        );
    }

    private long nextEventId() {
        return EVENT_SEQUENCE.getAndIncrement();
    }

    private String expenseDetails(Expense expense, AppUser actor) {
        String amount = bigDecimalValue(expense.getAmount());
        String category = expense.getCategory() == null ? "expense" : expense.getCategory().name().toLowerCase();
        String description = expense.getDescription() == null || expense.getDescription().isBlank()
                ? ""
                : " · " + expense.getDescription().trim();

        return "€" + amount
                + " · "
                + category
                + description
                + " · "
                + displayName(actor);
    }

    private String displayName(AppUser user) {
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String combined = (firstName + " " + lastName).trim();
        return combined.isBlank() ? user.getUsername() : combined;
    }

    private String bigDecimalValue(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }
}
