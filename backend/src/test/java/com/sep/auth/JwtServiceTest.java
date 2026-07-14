package com.sep.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = Base64.getEncoder().encodeToString(
            "01234567890123456789012345678901".getBytes(StandardCharsets.UTF_8)
    );

    private final JwtService jwtService = new JwtService(SECRET, 30);

    @Test
    void generatesAndValidatesAuthToken() {
        String token = jwtService.generateToken("traveler@example.com");

        assertThat(token).isNotBlank();
        assertThat(jwtService.extractEmail(token)).isEqualTo("traveler@example.com");
        assertThat(jwtService.isTokenValid(token)).isTrue();
        assertThat(jwtService.isAuthTokenValid(token)).isTrue();
        assertThat(jwtService.isPasswordResetTokenValid(token)).isFalse();
    }

    @Test
    void generatesAndValidatesPasswordResetToken() {
        String token = jwtService.generatePasswordResetToken("traveler@example.com");

        assertThat(token).isNotBlank();
        assertThat(jwtService.extractEmail(token)).isEqualTo("traveler@example.com");
        assertThat(jwtService.isTokenValid(token)).isTrue();
        assertThat(jwtService.isPasswordResetTokenValid(token)).isTrue();
        assertThat(jwtService.isAuthTokenValid(token)).isFalse();
    }

    @Test
    void acceptsTokenWithoutPurposeClaimForNormalAuth() {
        String token = tokenWithoutPurpose("traveler@example.com", Instant.now().plusSeconds(60));

        assertThat(jwtService.isTokenValid(token)).isTrue();
        assertThat(jwtService.isAuthTokenValid(token)).isTrue();
        assertThat(jwtService.isPasswordResetTokenValid(token)).isFalse();
    }

    @Test
    void rejectsExpiredToken() {
        String token = signedToken("traveler@example.com", "AUTH", Instant.now().minusSeconds(60));

        assertThatThrownBy(() -> jwtService.isTokenValid(token))
                .isInstanceOf(ExpiredJwtException.class);
        assertThatThrownBy(() -> jwtService.isAuthTokenValid(token))
                .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void rejectsMalformedToken() {
        assertThatThrownBy(() -> jwtService.isAuthTokenValid("not-a-token"))
                .isInstanceOf(MalformedJwtException.class);
    }

    @Test
    void rejectsTokenWithoutExpirationClaim() {
        String token = tokenWithoutExpiration("traveler@example.com", "AUTH");

        assertThat(jwtService.isTokenValid(token)).isFalse();
        assertThat(jwtService.isAuthTokenValid(token)).isFalse();
    }

    private String signedToken(String email, String purpose, Instant expiration) {
        SecretKey key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET));

        return Jwts.builder()
                .subject(email)
                .claim("purpose", purpose)
                .issuedAt(new Date())
                .expiration(Date.from(expiration))
                .signWith(key)
                .compact();
    }

    private String tokenWithoutPurpose(String email, Instant expiration) {
        SecretKey key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET));

        return Jwts.builder()
                .subject(email)
                .issuedAt(new Date())
                .expiration(Date.from(expiration))
                .signWith(key)
                .compact();
    }

    private String tokenWithoutExpiration(String email, String purpose) {
        SecretKey key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET));

        return Jwts.builder()
                .subject(email)
                .claim("purpose", purpose)
                .issuedAt(new Date())
                .signWith(key)
                .compact();
    }
}
