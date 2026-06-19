package com.sep.profile;

import com.sep.profile.dto.DeleteAccountRequest;
import com.sep.user.AppUser;
import com.sep.user.AppUserRepository;
import com.sep.user.VerificationPurpose;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;

@SpringBootTest
class ProfileDeleteDebugTest {

    @Autowired
    private ProfileService profileService;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void debugDeleteAccount() {
        String email = "codex.delete.debug@example.com";
        userRepository.findByEmailIgnoreCase(email).ifPresent(userRepository::delete);
        userRepository.flush();

        AppUser user = new AppUser(
                email,
                "codex_delete_debug",
                passwordEncoder.encode("TempPass123!"),
                null,
                LocalDateTime.now(),
                VerificationPurpose.LOGIN
        );
        user.setVerified(true);
        userRepository.saveAndFlush(user);

        profileService.deleteCurrentAccount(email, new DeleteAccountRequest("TempPass123!"));
    }
}
