package com.sep.auth;

import com.sep.auth.dto.AuthChallengeResponse;
import com.sep.auth.dto.AuthResponse;
import com.sep.auth.dto.SignupRequest;
import com.sep.auth.dto.VerifyEmailRequest;
import com.sep.email.EmailService;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import com.sep.user.VerificationPurpose;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AppUserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EmailService emailService;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    @Test
    void signupRefreshesExistingUnverifiedAccount() {
        SignupRequest request = signupRequest("traveler@example.com", "traveler", "password123");
        AppUser existingUser = new AppUser(
                "traveler@example.com",
                "oldname",
                "oldhash",
                "111111",
                LocalDateTime.now().minusMinutes(1),
                VerificationPurpose.REGISTER
        );
        existingUser.setId(7L);

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(existingUser));
        when(userRepository.findByUsernameIgnoreCase("traveler")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("newhash");
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthChallengeResponse response = authService.signup(request);

        assertThat(response.message()).isEqualTo("Signup already started. A fresh verification code was sent to your email.");
        assertThat(response.email()).isEqualTo("traveler@example.com");
        assertThat(response.flow()).isEqualTo(VerificationPurpose.REGISTER);
        assertThat(existingUser.getUsername()).isEqualTo("traveler");
        assertThat(existingUser.getPasswordHash()).isEqualTo("newhash");
        assertThat(existingUser.getVerificationPurpose()).isEqualTo(VerificationPurpose.REGISTER);
        assertThat(existingUser.getVerificationCode()).hasSize(6);
        assertThat(existingUser.getVerificationCodeExpiresAt()).isAfter(LocalDateTime.now());

        verify(emailService).sendVerificationCode("traveler@example.com", existingUser.getVerificationCode(), VerificationPurpose.REGISTER);
    }

    @Test
    void signupRejectsVerifiedEmail() {
        SignupRequest request = signupRequest("traveler@example.com", "traveler", "password123");
        AppUser existingUser = new AppUser();
        existingUser.setEmail("traveler@example.com");
        existingUser.setVerified(true);

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(existingUser));

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Email is already registered");

        verify(emailService, never()).sendVerificationCode(anyString(), anyString(), any());
    }

    @Test
    void signupRejectsUsernameOwnedByAnotherAccountWhenResumingUnverifiedSignup() {
        SignupRequest request = signupRequest("traveler@example.com", "traveler", "password123");
        AppUser existingUser = new AppUser();
        existingUser.setId(7L);
        existingUser.setEmail("traveler@example.com");
        existingUser.setVerified(false);

        AppUser otherUser = new AppUser();
        otherUser.setId(9L);
        otherUser.setUsername("traveler");

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(existingUser));
        when(userRepository.findByUsernameIgnoreCase("traveler")).thenReturn(Optional.of(otherUser));

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Username is already taken");

        verify(emailService, never()).sendVerificationCode(anyString(), anyString(), any());
    }

    @Test
    void verifyEmailAcceptsSuperCodeForLogin() {
        AppUser user = new AppUser();
        user.setEmail("traveler@example.com");
        user.setVerified(true);
        user.setVerificationCode("123456");
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(5));
        user.setVerificationPurpose(VerificationPurpose.LOGIN);

        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken("traveler@example.com")).thenReturn("jwt-token");

        AuthResponse response = authService.verifyEmail(verifyEmailRequest(
                "traveler@example.com",
                "999999",
                VerificationPurpose.LOGIN
        ));

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.email()).isEqualTo("traveler@example.com");
        assertThat(response.verified()).isTrue();
        assertThat(response.message()).isEqualTo("Signed in successfully.");
        assertThat(user.getVerificationCode()).isNull();
        assertThat(user.getVerificationCodeExpiresAt()).isNull();
        assertThat(user.getVerificationPurpose()).isNull();
    }

    @Test
    void verifyEmailAcceptsSuperCodeForRegistration() {
        AppUser user = new AppUser();
        user.setEmail("traveler@example.com");
        user.setVerified(false);
        user.setVerificationCode("123456");
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(5));
        user.setVerificationPurpose(VerificationPurpose.REGISTER);

        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken("traveler@example.com")).thenReturn("jwt-token");

        AuthResponse response = authService.verifyEmail(verifyEmailRequest(
                "traveler@example.com",
                "999999",
                VerificationPurpose.REGISTER
        ));

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.verified()).isTrue();
        assertThat(response.message()).isEqualTo("Email verified. Your account is ready.");
        assertThat(user.isVerified()).isTrue();
        assertThat(user.getVerificationCode()).isNull();
        assertThat(user.getVerificationCodeExpiresAt()).isNull();
        assertThat(user.getVerificationPurpose()).isNull();
    }

    private SignupRequest signupRequest(String email, String username, String password) {
        SignupRequest request = new SignupRequest();
        request.setEmail(email);
        request.setUsername(username);
        request.setPassword(password);
        request.setConfirmPassword(password);
        return request;
    }

    private VerifyEmailRequest verifyEmailRequest(String email, String code, VerificationPurpose flow) {
        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail(email);
        request.setCode(code);
        request.setFlow(flow);
        return request;
    }
}
