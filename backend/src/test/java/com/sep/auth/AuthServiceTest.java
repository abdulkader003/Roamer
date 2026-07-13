package com.sep.auth;

import com.sep.auth.dto.AuthChallengeResponse;
import com.sep.auth.dto.AuthChallengeRequest;
import com.sep.auth.dto.AuthResponse;
import com.sep.auth.dto.SignupRequest;
import com.sep.auth.dto.LoginRequest;
import com.sep.auth.dto.PasswordResetRequest;
import com.sep.auth.dto.PasswordResetTokenResponse;
import com.sep.auth.dto.PasswordResetVerifyRequest;
import com.sep.auth.dto.ResetPasswordRequest;
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
import java.lang.reflect.Method;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
    void signupAllowsResumingUnverifiedAccountWithSameUsernameOnSameRecord() {
        SignupRequest request = signupRequest("traveler@example.com", "traveler", "password123");
        AppUser existingUser = new AppUser();
        existingUser.setId(7L);
        existingUser.setEmail("traveler@example.com");
        existingUser.setUsername("traveler");
        existingUser.setVerified(false);

        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(existingUser));
        when(userRepository.findByUsernameIgnoreCase("traveler")).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.encode("password123")).thenReturn("newhash");
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthChallengeResponse response = authService.signup(request);

        assertThat(response.flow()).isEqualTo(VerificationPurpose.REGISTER);
        assertThat(existingUser.getPasswordHash()).isEqualTo("newhash");
    }

    @Test
    void signupRejectsPasswordMismatch() {
        SignupRequest request = new SignupRequest();
        request.setEmail("new@example.com");
        request.setUsername("newtraveler");
        request.setPassword("password123");
        request.setConfirmPassword("different");

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Passwords do not match");
    }

    @Test
    void signupCreatesNewUserAndEncodesPassword() {
        SignupRequest request = signupRequest("new@example.com", "newtraveler", "password123");

        when(userRepository.findByEmailIgnoreCase("new@example.com")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("newtraveler")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("encoded-password");
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthChallengeResponse response = authService.signup(request);

        assertThat(response.message()).isEqualTo("Signup successful. Enter the code sent to your email to finish setting up your account.");
        assertThat(response.email()).isEqualTo("new@example.com");
        assertThat(response.flow()).isEqualTo(VerificationPurpose.REGISTER);
        assertThat(response.expiresInMinutes()).isEqualTo(10);
        verify(userRepository).save(any(AppUser.class));
        verify(passwordEncoder).encode("password123");
        verify(emailService).sendVerificationCode(
                org.mockito.ArgumentMatchers.eq("new@example.com"),
                org.mockito.ArgumentMatchers.argThat(code -> code != null && code.length() == 6),
                org.mockito.ArgumentMatchers.eq(VerificationPurpose.REGISTER)
        );
    }

    @Test
    void signupRejectsDuplicateUsernameWhenEmailIsNew() {
        SignupRequest request = signupRequest("new@example.com", "traveler", "password123");

        when(userRepository.findByEmailIgnoreCase("new@example.com")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("traveler")).thenReturn(Optional.of(new AppUser()));

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Username is already taken");

        verifyNoInteractions(passwordEncoder, emailService, jwtService);
    }

    @Test
    void loginReturnsLoginChallengeForVerifiedAccount() {
        LoginRequest request = loginRequest("traveler@example.com", "password123");
        AppUser user = verifiedUser("traveler@example.com", "encoded-password");
        when(userRepository.findByEmailIgnoreCaseOrUsernameIgnoreCase("traveler@example.com", "traveler@example.com"))
                .thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "encoded-password")).thenReturn(true);
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthChallengeResponse response = authService.login(request);

        assertThat(response.message()).isEqualTo("A login code was sent to your email. Enter it to finish signing in.");
        assertThat(response.email()).isEqualTo("traveler@example.com");
        assertThat(response.flow()).isEqualTo(VerificationPurpose.LOGIN);
        verify(emailService).sendVerificationCode("traveler@example.com", user.getVerificationCode(), VerificationPurpose.LOGIN);
    }

    @Test
    void loginReturnsRegisterChallengeForUnverifiedAccount() {
        LoginRequest request = loginRequest("traveler@example.com", "password123");
        AppUser user = unverifiedUser("traveler@example.com", "encoded-password");
        when(userRepository.findByEmailIgnoreCaseOrUsernameIgnoreCase("traveler@example.com", "traveler@example.com"))
                .thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "encoded-password")).thenReturn(true);
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthChallengeResponse response = authService.login(request);

        assertThat(response.message()).isEqualTo("This account still needs verification. Enter the code sent to your email to continue.");
        assertThat(response.flow()).isEqualTo(VerificationPurpose.REGISTER);
        verify(emailService).sendVerificationCode("traveler@example.com", user.getVerificationCode(), VerificationPurpose.REGISTER);
    }

    @Test
    void resendCodeResendsRegisterCodeForUnverifiedAccount() {
        AppUser user = unverifiedUser("traveler@example.com", "encoded-password");
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthChallengeResponse response = authService.resendCode(authChallengeRequest("traveler@example.com", VerificationPurpose.REGISTER));

        assertThat(response.flow()).isEqualTo(VerificationPurpose.REGISTER);
        assertThat(response.message()).isEqualTo("A fresh verification code was sent to your email.");
        verify(emailService).sendVerificationCode("traveler@example.com", user.getVerificationCode(), VerificationPurpose.REGISTER);
    }

    @Test
    void loginRejectsInvalidPassword() {
        LoginRequest request = loginRequest("traveler@example.com", "wrongpassword");
        AppUser user = verifiedUser("traveler@example.com", "encoded-password");
        when(userRepository.findByEmailIgnoreCaseOrUsernameIgnoreCase("traveler@example.com", "traveler@example.com"))
                .thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongpassword", "encoded-password")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid email, username, or password");

        verifyNoInteractions(emailService, jwtService);
    }

    @Test
    void loginRejectsMissingUser() {
        LoginRequest request = loginRequest("missing@example.com", "password123");
        when(userRepository.findByEmailIgnoreCaseOrUsernameIgnoreCase("missing@example.com", "missing@example.com"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid email, username, or password");
    }

    @Test
    void signupNormalizesNullEmailAndUsername() {
        SignupRequest request = signupRequest(null, null, "password123");

        when(userRepository.findByEmailIgnoreCase("")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("encoded-password");
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthChallengeResponse response = authService.signup(request);

        assertThat(response.email()).isEqualTo("");
        verify(passwordEncoder).encode("password123");
        verify(emailService).sendVerificationCode(org.mockito.ArgumentMatchers.eq(""), anyString(), org.mockito.ArgumentMatchers.eq(VerificationPurpose.REGISTER));
    }

    @Test
    void loginNormalizesNullIdentifier() {
        LoginRequest request = loginRequest(null, "password123");
        when(userRepository.findByEmailIgnoreCaseOrUsernameIgnoreCase("", "")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid email, username, or password");
    }

    @Test
    void resendCodeRejectsVerifiedAccountWhenStartingRegisterFlow() {
        AppUser user = verifiedUser("traveler@example.com", "encoded-password");
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.resendCode(authChallengeRequest("traveler@example.com", VerificationPurpose.REGISTER)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("This account is already verified. Please log in instead.");
    }

    @Test
    void resendCodeRejectsUnverifiedAccountWhenStartingLoginFlow() {
        AppUser user = unverifiedUser("traveler@example.com", "encoded-password");
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.resendCode(authChallengeRequest("traveler@example.com", VerificationPurpose.LOGIN)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Verify your account first before requesting a login code.");
    }

    @Test
    void resendCodeResendsLoginCode() {
        AppUser user = verifiedUser("traveler@example.com", "encoded-password");
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthChallengeResponse response = authService.resendCode(authChallengeRequest("traveler@example.com", VerificationPurpose.LOGIN));

        assertThat(response.flow()).isEqualTo(VerificationPurpose.LOGIN);
        assertThat(response.message()).isEqualTo("A fresh login code was sent to your email.");
        verify(emailService).sendVerificationCode("traveler@example.com", user.getVerificationCode(), VerificationPurpose.LOGIN);
    }

    @Test
    void requestPasswordResetStartsFlow() {
        AppUser user = verifiedUser("traveler@example.com", "encoded-password");
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthChallengeResponse response = authService.requestPasswordReset(passwordResetRequest("traveler@example.com"));

        assertThat(response.flow()).isEqualTo(VerificationPurpose.PASSWORD_RESET);
        assertThat(response.message()).isEqualTo("A password reset code was sent to your email.");
        verify(emailService).sendVerificationCode("traveler@example.com", user.getVerificationCode(), VerificationPurpose.PASSWORD_RESET);
    }

    @Test
    void requestPasswordResetRejectsUnknownEmail() {
        when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.requestPasswordReset(passwordResetRequest("missing@example.com")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("No account found for this email address.");
    }

    @Test
    void verifyEmailRejectsWrongFlow() {
        AppUser user = userWithVerification("traveler@example.com", VerificationPurpose.REGISTER, "123456");
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.verifyEmail(verifyEmailRequest("traveler@example.com", "123456", VerificationPurpose.LOGIN)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("This code was requested for a different verification step.");
    }

    @Test
    void verifyEmailRejectsExpiredCode() {
        AppUser user = userWithVerification("traveler@example.com", VerificationPurpose.REGISTER, "123456");
        user.setVerificationCodeExpiresAt(LocalDateTime.now().minusMinutes(1));
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.verifyEmail(verifyEmailRequest("traveler@example.com", "123456", VerificationPurpose.REGISTER)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Verification code expired");
    }

    @Test
    void verifyEmailRejectsInvalidCode() {
        AppUser user = userWithVerification("traveler@example.com", VerificationPurpose.REGISTER, "123456");
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.verifyEmail(verifyEmailRequest("traveler@example.com", "999998", VerificationPurpose.REGISTER)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid verification code");
    }

    @Test
    void verifyEmailRejectsMissingActiveCode() {
        AppUser user = new AppUser();
        user.setEmail("traveler@example.com");
        user.setVerificationPurpose(VerificationPurpose.REGISTER);
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.verifyEmail(verifyEmailRequest("traveler@example.com", "123456", VerificationPurpose.REGISTER)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("No active verification code was found for this account.");
    }

    @Test
    void verifyEmailRejectsMissingExpirationWhenCodeExists() {
        AppUser user = new AppUser();
        user.setEmail("traveler@example.com");
        user.setVerificationCode("123456");
        user.setVerificationPurpose(VerificationPurpose.REGISTER);
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.verifyEmail(verifyEmailRequest("traveler@example.com", "123456", VerificationPurpose.REGISTER)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("No active verification code was found for this account.");
    }

    @Test
    void verifyEmailAcceptsActualVerificationCodeForRegistration() {
        AppUser user = userWithVerification("traveler@example.com", VerificationPurpose.REGISTER, "123456");
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken("traveler@example.com")).thenReturn("jwt-token");

        AuthResponse response = authService.verifyEmail(verifyEmailRequest("traveler@example.com", "123456", VerificationPurpose.REGISTER));

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.message()).isEqualTo("Email verified. Your account is ready.");
    }

    @Test
    void verifyPasswordResetCodeReturnsResetToken() {
        AppUser user = userWithVerification("traveler@example.com", null, "654321");
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generatePasswordResetToken("traveler@example.com")).thenReturn("reset-token");

        PasswordResetTokenResponse response = authService.verifyPasswordResetCode(passwordResetVerifyRequest("traveler@example.com", "654321"));

        assertThat(response.resetToken()).isEqualTo("reset-token");
        assertThat(response.email()).isEqualTo("traveler@example.com");
        assertThat(response.message()).isEqualTo("Code verified. You can set a new password now.");
        verify(jwtService).generatePasswordResetToken("traveler@example.com");
    }

    @Test
    void verifyPasswordResetCodeRejectsInvalidToken() {
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyPasswordResetCode(passwordResetVerifyRequest("traveler@example.com", "654321")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid email or verification code.");
    }

    @Test
    void verifyPasswordResetCodeRejectsMissingActiveCode() {
        AppUser user = new AppUser();
        user.setEmail("traveler@example.com");
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.verifyPasswordResetCode(passwordResetVerifyRequest("traveler@example.com", "654321")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("No active password reset code was found for this account.");
    }

    @Test
    void verifyPasswordResetCodeRejectsMissingExpirationWhenCodeExists() {
        AppUser user = new AppUser();
        user.setEmail("traveler@example.com");
        user.setVerificationCode("654321");
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.verifyPasswordResetCode(passwordResetVerifyRequest("traveler@example.com", "654321")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("No active password reset code was found for this account.");
    }

    @Test
    void verifyPasswordResetCodeRejectsExpiredCode() {
        AppUser user = userWithVerification("traveler@example.com", null, "654321");
        user.setVerificationCodeExpiresAt(LocalDateTime.now().minusMinutes(1));
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.verifyPasswordResetCode(passwordResetVerifyRequest("traveler@example.com", "654321")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Password reset code expired.");
    }

    @Test
    void verifyPasswordResetCodeRejectsInvalidCode() {
        AppUser user = userWithVerification("traveler@example.com", null, "654321");
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.verifyPasswordResetCode(passwordResetVerifyRequest("traveler@example.com", "000000")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid email or verification code.");
    }

    @Test
    void resetPasswordUpdatesPasswordHash() {
        AppUser user = verifiedUser("traveler@example.com", "oldhash");
        when(jwtService.isPasswordResetTokenValid("reset-token")).thenReturn(true);
        when(jwtService.extractEmail("reset-token")).thenReturn("traveler@example.com");
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("newpassword")).thenReturn("newhash");
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(authService.resetPassword(resetPasswordRequest("reset-token", "newpassword", "newpassword")).message())
                .isEqualTo("Password updated successfully. Sign in with your new password.");

        assertThat(user.getPasswordHash()).isEqualTo("newhash");
        verify(passwordEncoder).encode("newpassword");
    }

    @Test
    void resetPasswordRejectsMismatchedPasswords() {
        assertThatThrownBy(() -> authService.resetPassword(resetPasswordRequest("reset-token", "newpassword", "different")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Passwords do not match");
    }

    @Test
    void resetPasswordRejectsInvalidToken() {
        when(jwtService.isPasswordResetTokenValid("reset-token")).thenReturn(false);

        assertThatThrownBy(() -> authService.resetPassword(resetPasswordRequest("reset-token", "newpassword", "newpassword")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Reset token expired or invalid. Start the password reset flow again.");
    }

    @Test
    void resetPasswordRejectsMissingUser() {
        when(jwtService.isPasswordResetTokenValid("reset-token")).thenReturn(true);
        when(jwtService.extractEmail("reset-token")).thenReturn("traveler@example.com");
        when(userRepository.findByEmailIgnoreCase("traveler@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.resetPassword(resetPasswordRequest("reset-token", "newpassword", "newpassword")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User not found");
    }

    @Test
    void validVerificationCodeTreatsNullSubmittedCodeAsFalse() throws Exception {
        AppUser user = userWithVerification("traveler@example.com", VerificationPurpose.REGISTER, "123456");
        Method method = AuthService.class.getDeclaredMethod("isValidVerificationCode", AppUser.class, String.class);
        method.setAccessible(true);

        boolean result = (boolean) method.invoke(authService, user, null);

        assertThat(result).isFalse();
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

    private LoginRequest loginRequest(String identifier, String password) {
        LoginRequest request = new LoginRequest();
        request.setIdentifier(identifier);
        request.setPassword(password);
        return request;
    }

    private AuthChallengeRequest authChallengeRequest(String email, VerificationPurpose flow) {
        AuthChallengeRequest request = new AuthChallengeRequest();
        request.setEmail(email);
        request.setFlow(flow);
        return request;
    }

    private PasswordResetRequest passwordResetRequest(String email) {
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail(email);
        return request;
    }

    private PasswordResetVerifyRequest passwordResetVerifyRequest(String email, String code) {
        PasswordResetVerifyRequest request = new PasswordResetVerifyRequest();
        request.setEmail(email);
        request.setCode(code);
        return request;
    }

    private ResetPasswordRequest resetPasswordRequest(String token, String password, String confirmPassword) {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken(token);
        request.setPassword(password);
        request.setConfirmPassword(confirmPassword);
        return request;
    }

    private AppUser verifiedUser(String email, String passwordHash) {
        AppUser user = new AppUser();
        user.setEmail(email);
        user.setVerified(true);
        user.setPasswordHash(passwordHash);
        user.setVerificationCode("123456");
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(5));
        user.setVerificationPurpose(VerificationPurpose.LOGIN);
        return user;
    }

    private AppUser unverifiedUser(String email, String passwordHash) {
        AppUser user = new AppUser();
        user.setEmail(email);
        user.setVerified(false);
        user.setPasswordHash(passwordHash);
        user.setVerificationCode("123456");
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(5));
        user.setVerificationPurpose(VerificationPurpose.REGISTER);
        return user;
    }

    private AppUser userWithVerification(String email, VerificationPurpose purpose, String code) {
        AppUser user = new AppUser();
        user.setEmail(email);
        user.setVerified(purpose == VerificationPurpose.LOGIN);
        user.setPasswordHash("encoded");
        user.setVerificationCode(code);
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(5));
        user.setVerificationPurpose(purpose);
        return user;
    }
}
