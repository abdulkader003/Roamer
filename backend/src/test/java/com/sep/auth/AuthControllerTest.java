package com.sep.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep.auth.dto.AuthChallengeResponse;
import com.sep.auth.dto.AuthResponse;
import com.sep.auth.dto.LoginRequest;
import com.sep.auth.dto.MessageResponse;
import com.sep.auth.dto.PasswordResetRequest;
import com.sep.auth.dto.PasswordResetTokenResponse;
import com.sep.auth.dto.PasswordResetVerifyRequest;
import com.sep.auth.dto.ResetPasswordRequest;
import com.sep.auth.dto.SignupRequest;
import com.sep.auth.dto.VerifyEmailRequest;
import com.sep.user.VerificationPurpose;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;

    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService))
                .setValidator(validator)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .build();
    }

    @Test
    void signupReturnsChallengeResponse() throws Exception {
        when(authService.signup(any(SignupRequest.class))).thenReturn(
                new AuthChallengeResponse("Signup successful.", "traveler@example.com", VerificationPurpose.REGISTER, 10)
        );

        mockMvc.perform(post("/api/auth/signup")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com",
                                  "username": "traveler",
                                  "password": "password123",
                                  "confirmPassword": "password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("traveler@example.com"))
                .andExpect(jsonPath("$.flow").value("REGISTER"))
                .andExpect(jsonPath("$.message").value("Signup successful."));

        verify(authService).signup(any(SignupRequest.class));
    }

    @Test
    void loginReturnsChallengeResponse() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenReturn(
                new AuthChallengeResponse("A login code was sent to your email. Enter it to finish signing in.", "traveler@example.com", VerificationPurpose.LOGIN, 10)
        );

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("""
                                {
                                  "identifier": "traveler@example.com",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flow").value("LOGIN"))
                .andExpect(jsonPath("$.email").value("traveler@example.com"));

        verify(authService).login(any(LoginRequest.class));
    }

    @Test
    void verifyEmailReturnsAuthResponse() throws Exception {
        when(authService.verifyEmail(any(VerifyEmailRequest.class))).thenReturn(
                new AuthResponse("jwt-token", "traveler@example.com", true, "Signed in successfully.")
        );

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com",
                                  "code": "123456",
                                  "flow": "LOGIN"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token"))
                .andExpect(jsonPath("$.verified").value(true));

        verify(authService).verifyEmail(any(VerifyEmailRequest.class));
    }

    @Test
    void resendCodeReturnsChallengeResponse() throws Exception {
        when(authService.resendCode(any())).thenReturn(
                new AuthChallengeResponse("A fresh login code was sent to your email.", "traveler@example.com", VerificationPurpose.LOGIN, 10)
        );

        mockMvc.perform(post("/api/auth/resend-code")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com",
                                  "flow": "LOGIN"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("A fresh login code was sent to your email."));

        verify(authService).resendCode(any());
    }

    @Test
    void requestPasswordResetReturnsChallengeResponse() throws Exception {
        when(authService.requestPasswordReset(any(PasswordResetRequest.class))).thenReturn(
                new AuthChallengeResponse("A password reset code was sent to your email.", "traveler@example.com", VerificationPurpose.PASSWORD_RESET, 10)
        );

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flow").value("PASSWORD_RESET"));

        verify(authService).requestPasswordReset(any(PasswordResetRequest.class));
    }

    @Test
    void verifyPasswordResetCodeReturnsResetToken() throws Exception {
        when(authService.verifyPasswordResetCode(any(PasswordResetVerifyRequest.class))).thenReturn(
                new PasswordResetTokenResponse("Code verified. You can set a new password now.", "traveler@example.com", "reset-token", 15)
        );

        mockMvc.perform(post("/api/auth/forgot-password/verify")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com",
                                  "code": "123456"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resetToken").value("reset-token"));

        verify(authService).verifyPasswordResetCode(any(PasswordResetVerifyRequest.class));
    }

    @Test
    void resetPasswordReturnsMessage() throws Exception {
        when(authService.resetPassword(any(ResetPasswordRequest.class))).thenReturn(
                new MessageResponse("Password updated successfully. Sign in with your new password.")
        );

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType("application/json")
                        .content("""
                                {
                                  "token": "reset-token",
                                  "password": "password123",
                                  "confirmPassword": "password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password updated successfully. Sign in with your new password."));

        verify(authService).resetPassword(any(ResetPasswordRequest.class));
    }

    @Test
    void rejectsInvalidSignupBodyBeforeService() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType("application/json")
                .content("""
                                {
                                  "email": " ",
                                  "username": "traveler",
                                  "password": "password123",
                                  "confirmPassword": "password123"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());

        verifyNoInteractions(authService);
    }

    @Test
    void rejectsInvalidLoginBodyBeforeService() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("""
                                {
                                  "identifier": "traveler@example.com",
                                  "password": " "
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(authService);
    }

    @Test
    void convertsIllegalArgumentToBadRequest() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenThrow(new IllegalArgumentException("Invalid email, username, or password"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("""
                                {
                                  "identifier": "traveler@example.com",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid email, username, or password"));
    }

    @Test
    void convertsDataIntegrityViolationToClientSafeMessage() throws Exception {
        when(authService.signup(any(SignupRequest.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate", new RuntimeException("email already exists")));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com",
                                  "username": "traveler",
                                  "password": "password123",
                                  "confirmPassword": "password123"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("This email or username is already in use."));
    }

    @Test
    void convertsDataIntegrityViolationWithUsernameDetailsToClientSafeMessage() throws Exception {
        when(authService.signup(any(SignupRequest.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate", new RuntimeException("username already exists")));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com",
                                  "username": "traveler",
                                  "password": "password123",
                                  "confirmPassword": "password123"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("This email or username is already in use."));
    }

    @Test
    void convertsDataIntegrityViolationWithoutDetailsToGenericMessage() throws Exception {
        when(authService.requestPasswordReset(any(PasswordResetRequest.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unable to save your request right now. Please try again."));
    }

    @Test
    void convertsDataIntegrityViolationWithNoCauseToGenericMessage() throws Exception {
        when(authService.requestPasswordReset(any(PasswordResetRequest.class)))
                .thenThrow(new DataIntegrityViolationException(null) {
                    @Override
                    public Throwable getMostSpecificCause() {
                        return null;
                    }
                });

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unable to save your request right now. Please try again."));
    }

    @Test
    void convertsUnexpectedExceptionToServerError() throws Exception {
        when(authService.requestPasswordReset(any(PasswordResetRequest.class)))
                .thenThrow(new RuntimeException("boom"));

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "traveler@example.com"
                                }
                                """))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("Unexpected server error. Check the backend logs for details."));
    }
}
