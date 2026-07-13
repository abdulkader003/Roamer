package com.sep.settings;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserFeedbackRepository extends JpaRepository<UserFeedback, Long> {

    void deleteAllByOwnerId(Long ownerId);
}
