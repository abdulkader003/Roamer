package com.sep.config.websocket;

import com.sep.auth.JwtService;
import com.sep.user.AppUserRepository;
import java.util.Collections;
import java.util.List;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Authenticates STOMP CONNECT frames using the existing bearer token format.
 *
 * <p>The broker is ready for future events, but today it simply ensures the client
 * can only establish a websocket session with a valid logged-in account.</p>
 */
@Component
public class JwtStompChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final AppUserRepository appUserRepository;

    public JwtStompChannelInterceptor(JwtService jwtService, AppUserRepository appUserRepository) {
        this.jwtService = jwtService;
        this.appUserRepository = appUserRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            Authentication authentication = authenticate(accessor.getNativeHeader("Authorization"));
            accessor.setUser(authentication);
            accessor.setLeaveMutable(true);
            return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
        }

        return message;
    }

    private Authentication authenticate(List<String> authorizationHeaders) {
        if (authorizationHeaders == null || authorizationHeaders.isEmpty()) {
            throw new AccessDeniedException("WebSocket authorization header is required.");
        }

        String authorizationHeader = authorizationHeaders.getFirst();
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("Invalid WebSocket authorization header.");
        }

        String token = authorizationHeader.substring(7);

        if (!jwtService.isAuthTokenValid(token)) {
            throw new AccessDeniedException("Invalid WebSocket token.");
        }

        String email = jwtService.extractEmail(token);
        if (!appUserRepository.existsByEmail(email)) {
            throw new AccessDeniedException("WebSocket user was not found.");
        }

        return new UsernamePasswordAuthenticationToken(email, null, Collections.emptyList());
    }
}
