package com.userjourney.analytics.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
public class JwtService {

    private static final Logger logger = LoggerFactory.getLogger(JwtService.class);

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration:3600}")
    private int jwtExpirationInSeconds;

    public String generateToken(String userId, List<String> roles, Map<String, Object> additionalClaims) {
        Instant now = Instant.now();
        Instant expiration = now.plus(jwtExpirationInSeconds, ChronoUnit.SECONDS);

        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

        var jwtBuilder = Jwts.builder()
            .setSubject(userId)
            .setIssuedAt(Date.from(now))
            .setExpiration(Date.from(expiration))
            .claim("roles", roles)
            .claim("iat", now.getEpochSecond())
            .signWith(key, SignatureAlgorithm.HS512);

        // Add additional claims if provided
        if (additionalClaims != null) {
            additionalClaims.forEach(jwtBuilder::claim);
        }

        return jwtBuilder.compact();
    }

    public String generateAdminToken(String adminId, String email) {
        return generateToken(adminId, List.of("ADMIN"), Map.of(
            "email", email,
            "type", "admin",
            "scope", "analytics-dashboard"
        ));
    }

    public String generateUserToken(String userId, String email) {
        return generateToken(userId, List.of("USER"), Map.of(
            "email", email,
            "type", "user",
            "scope", "user-app"
        ));
    }

    public boolean validateToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token);
            return true;
        } catch (ExpiredJwtException ex) {
            logger.warn("JWT token expired");
            return false;
        } catch (MalformedJwtException ex) {
            logger.error("Invalid JWT token format");
            return false;
        } catch (SignatureException ex) {
            logger.error("Invalid JWT signature");
            return false;
        } catch (UnsupportedJwtException ex) {
            logger.error("Unsupported JWT token");
            return false;
        } catch (IllegalArgumentException ex) {
            logger.error("JWT claims string is empty");
            return false;
        }
    }

    public Claims getClaimsFromToken(String token) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        return Jwts.parserBuilder()
            .setSigningKey(key)
            .build()
            .parseClaimsJws(token)
            .getBody();
    }

    public String getUserIdFromToken(String token) {
        Claims claims = getClaimsFromToken(token);
        return claims.getSubject();
    }

    @SuppressWarnings("unchecked")
    public List<String> getRolesFromToken(String token) {
        Claims claims = getClaimsFromToken(token);
        return (List<String>) claims.get("roles");
    }

    public boolean isTokenExpired(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            return claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return true;
        }
    }

    public String refreshToken(String token) {
        if (!validateToken(token) || isTokenExpired(token)) {
            throw new IllegalArgumentException("Cannot refresh invalid or expired token");
        }

        Claims claims = getClaimsFromToken(token);
        String userId = claims.getSubject();
        @SuppressWarnings("unchecked")
        List<String> roles = (List<String>) claims.get("roles");
        
        // Extract additional claims (excluding standard ones)
        Map<String, Object> additionalClaims = Map.of(
            "email", claims.get("email", String.class),
            "type", claims.get("type", String.class),
            "scope", claims.get("scope", String.class)
        );

        return generateToken(userId, roles, additionalClaims);
    }
}