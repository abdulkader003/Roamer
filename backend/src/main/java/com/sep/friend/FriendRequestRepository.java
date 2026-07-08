package com.sep.friend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

    List<FriendRequest> findByReceiverIdAndStatusOrderByCreatedAtDesc(Long receiverId, FriendRequestStatus status);

    Optional<FriendRequest> findByIdAndReceiverIdAndStatus(Long id, Long receiverId, FriendRequestStatus status);

    boolean existsBySenderIdAndReceiverIdAndStatus(Long senderId, Long receiverId, FriendRequestStatus status);

    @Query("""
            select friendRequest
            from FriendRequest friendRequest
            where friendRequest.status = com.sep.friend.FriendRequestStatus.ACCEPTED
              and (friendRequest.sender.id = :userId or friendRequest.receiver.id = :userId)
            order by friendRequest.createdAt desc
            """)
    List<FriendRequest> findAcceptedConnectionsForUser(@Param("userId") Long userId);

    @Query("""
            select friendRequest
            from FriendRequest friendRequest
            where friendRequest.status = com.sep.friend.FriendRequestStatus.ACCEPTED
              and (
                (friendRequest.sender.id = :firstUserId and friendRequest.receiver.id = :secondUserId)
                or
                (friendRequest.sender.id = :secondUserId and friendRequest.receiver.id = :firstUserId)
              )
            """)
    Optional<FriendRequest> findAcceptedConnectionBetweenUsers(
            @Param("firstUserId") Long firstUserId,
            @Param("secondUserId") Long secondUserId
    );

    @Query("""
            select friendRequest
            from FriendRequest friendRequest
            where friendRequest.status = com.sep.friend.FriendRequestStatus.ACCEPTED
              and (
                (friendRequest.sender.id = :firstUserId and friendRequest.receiver.id = :secondUserId)
                or
                (friendRequest.sender.id = :secondUserId and friendRequest.receiver.id = :firstUserId)
              )
            """)
    List<FriendRequest> findAcceptedConnectionsBetweenUsers(
            @Param("firstUserId") Long firstUserId,
            @Param("secondUserId") Long secondUserId
    );

    Optional<FriendRequest> findByIdAndStatus(Long id, FriendRequestStatus status);
}
