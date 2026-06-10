package com.sep.email;

import com.sep.user.VerificationPurpose;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends one-time verification codes for authentication and password reset flows.
 */
@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public EmailService(JavaMailSender mailSender, @Value("${spring.mail.username}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    /**
     * Sends a purpose-specific verification email to the user.
     *
     * @param to recipient email address
     * @param code one-time code already stored on the user record
     * @param purpose flow that determines the subject and message wording
     */
    public void sendVerificationCode(String to, String code, VerificationPurpose purpose) {

        SimpleMailMessage message = new SimpleMailMessage();

        message.setTo(to);

        String action = switch (purpose) {
            case LOGIN -> "Login code";
            case PASSWORD_RESET -> "Password reset code";
            case REGISTER -> "Verification code";
        };

        message.setSubject("SEP Travel App " + action);

        message.setText(
                "Your " + action.toLowerCase() + " is: " + code +
                        "\n\nThis code expires in 10 minutes."
        );
        message.setFrom(fromAddress);
        mailSender.send(message);
    }
}
