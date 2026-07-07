package com.sep.config.websocket;

import com.sep.auth.JwtService;
import com.sep.user.AppUserRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtStompChannelInterceptorTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private AppUserRepository appUserRepository;

    private JwtStompChannelInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new JwtStompChannelInterceptor(jwtService, appUserRepository);
    }

    @Test
    void authenticatesConnectFramesWithAValidBearerToken() {
        when(jwtService.isAuthTokenValid("valid-token")).thenReturn(true);
        when(jwtService.extractEmail("valid-token")).thenReturn("traveler@example.com");
        when(appUserRepository.existsByEmail("traveler@example.com")).thenReturn(true);

        Message<byte[]> message = connectMessage("Bearer valid-token");

        Message<?> result = interceptor.preSend(message, null);

        Authentication authentication = (Authentication) StompHeaderAccessor.wrap(result).getUser();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getName()).isEqualTo("traveler@example.com");
    }

    @Test
    void rejectsConnectFramesWithoutAnAuthorizationHeader() {
        Message<byte[]> message = connectMessage(null);

        assertThatThrownBy(() -> interceptor.preSend(message, null))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("required");
    }

    @Test
    void rejectsConnectFramesWithAnInvalidToken() {
        when(jwtService.isAuthTokenValid("bad-token")).thenReturn(false);

        Message<byte[]> message = connectMessage("Bearer bad-token");

        assertThatThrownBy(() -> interceptor.preSend(message, null))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Invalid WebSocket token");
    }

    private Message<byte[]> connectMessage(String authorizationHeader) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        if (authorizationHeader != null) {
            accessor.setNativeHeader("Authorization", authorizationHeader);
        }

        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
