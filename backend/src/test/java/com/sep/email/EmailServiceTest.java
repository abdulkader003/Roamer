package com.sep.email;

import com.sep.user.VerificationPurpose;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class EmailServiceTest {

    @Test
    void sendVerificationCodeSendsCodeToUserEmailAddress() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        EmailService emailService = new EmailService(mailSender, "auth@example.com");

        emailService.sendVerificationCode("traveler@example.com", "123456", VerificationPurpose.LOGIN);

        ArgumentCaptor<SimpleMailMessage> messageCaptor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(messageCaptor.capture());

        SimpleMailMessage message = messageCaptor.getValue();
        assertThat(message.getTo()).containsExactly("traveler@example.com");
        assertThat(message.getFrom()).isEqualTo("auth@example.com");
        assertThat(message.getSubject()).isEqualTo("SEP Travel App Login code");
        assertThat(message.getText()).contains("123456");
    }
}
