package com.sep.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Repository for account lookup paths used by authentication and verification flows.
 */
public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmail(String email);

    Optional<AppUser> findByEmailIgnoreCase(String email);

    Optional<AppUser> findByUsernameIgnoreCase(String username);

    Optional<AppUser> findByEmailIgnoreCaseOrUsernameIgnoreCase(String email, String username);

    boolean existsByEmail(String email);

    boolean existsByUsernameIgnoreCase(String username);

    @Query("""
            select user
            from AppUser user
            where user.id <> :currentUserId
              and (
                    lower(coalesce(user.email, '')) like lower(concat('%', :query, '%'))
                 or lower(coalesce(user.username, '')) like lower(concat('%', :query, '%'))
                 or lower(coalesce(user.firstName, '')) like lower(concat('%', :query, '%'))
                 or lower(coalesce(user.lastName, '')) like lower(concat('%', :query, '%'))
              )
            order by lower(coalesce(user.username, user.email))
            """)
    List<AppUser> searchCommunityUsers(@Param("currentUserId") Long currentUserId, @Param("query") String query);
}
