package com.sep.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    private static final String PURPOSE_CLAIM = "purpose";
    private static final String AUTH_PURPOSE = "AUTH";
    private static final String PASSWORD_RESET_PURPOSE = "PASSWORD_RESET";
    private static final Duration PASSWORD_RESET_EXPIRATION = Duration.ofMinutes(15);

    private final SecretKey signingKey;
    private final Duration expiration;

    public JwtService(
            @Value("${security.jwt.secret}") String secret,
            @Value("${security.jwt.expiration-minutes:43200}") long expirationMinutes
    ) {
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        this.expiration = Duration.ofMinutes(expirationMinutes);
    }

    public String generateToken(String email) {
        return generateToken(email, AUTH_PURPOSE, expiration);
    }

    public String generatePasswordResetToken(String email) {
        return generateToken(email, PASSWORD_RESET_PURPOSE, PASSWORD_RESET_EXPIRATION);
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        Claims claims = parseClaims(token);
        Date expirationDate = claims.getExpiration();
        return expirationDate != null && expirationDate.after(new Date());
    }

    public boolean isAuthTokenValid(String token) {
        Claims claims = parseClaims(token);
        Date expirationDate = claims.getExpiration();
        String purpose = claims.get(PURPOSE_CLAIM, String.class);

        return expirationDate != null
                && expirationDate.after(new Date())
                && (purpose == null || AUTH_PURPOSE.equals(purpose));
    }

    public boolean isPasswordResetTokenValid(String token) {
        Claims claims = parseClaims(token);
        Date expirationDate = claims.getExpiration();
        String purpose = claims.get(PURPOSE_CLAIM, String.class);

        return expirationDate != null
                && expirationDate.after(new Date())
                && PASSWORD_RESET_PURPOSE.equals(purpose);
    }

    private String generateToken(String email, String purpose, Duration tokenExpiration) {
        Instant now = Instant.now();

        return Jwts.builder()
                .subject(email)
                .claim(PURPOSE_CLAIM, purpose)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(tokenExpiration)))
                .signWith(signingKey)
                .compact();
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
