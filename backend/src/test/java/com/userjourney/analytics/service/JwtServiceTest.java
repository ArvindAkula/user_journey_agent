package com.userjourney.analytics.service;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for JwtService
 * Tests JWT token generation, validation, and claim extraction
 */
@SpringBootTest(classes = com.userjourney.analytics.AnalyticsBackendApplication.class)
@TestPropertySource(properties = {
    "app.jwt.secret=testSecretKeyThatIsAtLeast256BitsLongForHS512Algorithm",
    "app.jwt.expiration=3600"
})
public class JwtServiceTest {

    @Autowired
    private JwtService jwtService;

    private String testUserId;
    private String testEmail;
    private String testRole;

    @BeforeEach
    public void setUp() {
        testUserId = "test-user-123";
        testEmail = "test@example.com";
        testRole = "ADMIN";
    }

    @Test
    public void testGenerateToken_WithEmailAndRole() {
        // Generate token
        String token = jwtService.generateToken(testEmail, testRole);

        // Verify token is not null and not empty
        assertNotNull(token);
        assertFalse(token.isEmpty());

        // Verify token is valid
        assertTrue(jwtService.validateToken(token));
    }

    @Test
    public void testGenerateToken_WithUserIdRolesAndClaims() {
        // Generate token with multiple roles and additional claims
        List<String> roles = List.of("ADMIN", "ANALYST");
        Map<String, Object> additionalClaims = Map.of(
            "email", testEmail,
            "displayName", "Test User"
        );

        String token = jwtService.generateToken(testUserId, roles, additionalClaims);

        // Verify token is valid
        assertNotNull(token);
        assertTrue(jwtService.validateToken(token));

        // Verify claims
        Claims claims = jwtService.getClaimsFromToken(token);
        assertEquals(testUserId, claims.getSubject());
        assertEquals(testEmail, claims.get("email", String.class));
        assertEquals("Test User", claims.get("displayName", String.class));
    }

    @Test
    public void testGenerateAdminToken() {
        String adminId = "admin-1";
        String adminEmail = "admin@example.com";

        String token = jwtService.generateAdminToken(adminId, adminEmail);

        assertNotNull(token);
        assertTrue(jwtService.validateToken(token));

        // Verify admin-specific claims
        Claims claims = jwtService.getClaimsFromToken(token);
        assertEquals(adminId, claims.getSubject());
        assertEquals(adminEmail, claims.get("email", String.class));
        assertEquals("admin", claims.get("type", String.class));
        assertEquals("analytics-dashboard", claims.get("scope", String.class));
    }

    @Test
    public void testGenerateUserToken() {
        String userId = "user-1";
        String userEmail = "user@example.com";

        String token = jwtService.generateUserToken(userId, userEmail);

        assertNotNull(token);
        assertTrue(jwtService.validateToken(token));

        // Verify user-specific claims
        Claims claims = jwtService.getClaimsFromToken(token);
        assertEquals(userId, claims.getSubject());
        assertEquals(userEmail, claims.get("email", String.class));
        assertEquals("user", claims.get("type", String.class));
        assertEquals("user-app", claims.get("scope", String.class));
    }

    @Test
    public void testValidateToken_ValidToken() {
        String token = jwtService.generateToken(testEmail, testRole);
        assertTrue(jwtService.validateToken(token));
    }

    @Test
    public void testValidateToken_InvalidToken() {
        String invalidToken = "invalid.token.here";
        assertFalse(jwtService.validateToken(invalidToken));
    }

    @Test
    public void testValidateToken_MalformedToken() {
        String malformedToken = "not-a-jwt-token";
        assertFalse(jwtService.validateToken(malformedToken));
    }

    @Test
    public void testGetUserIdFromToken() {
        String token = jwtService.generateToken(testUserId, List.of(testRole), Map.of("email", testEmail));
        String extractedUserId = jwtService.getUserIdFromToken(token);
        assertEquals(testUserId, extractedUserId);
    }

    @Test
    public void testGetEmailFromToken() {
        String token = jwtService.generateToken(testEmail, testRole);
        String extractedEmail = jwtService.getEmailFromToken(token);
        assertEquals(testEmail, extractedEmail);
    }

    @Test
    public void testGetRoleFromToken() {
        String token = jwtService.generateToken(testEmail, testRole);
        String extractedRole = jwtService.getRoleFromToken(token);
        assertEquals(testRole, extractedRole);
    }

    @Test
    public void testGetRolesFromToken() {
        List<String> roles = List.of("ADMIN", "ANALYST", "VIEWER");
        String token = jwtService.generateToken(testUserId, roles, Map.of("email", testEmail));
        
        List<String> extractedRoles = jwtService.getRolesFromToken(token);
        assertNotNull(extractedRoles);
        assertEquals(3, extractedRoles.size());
        assertTrue(extractedRoles.containsAll(roles));
    }

    @Test
    public void testIsTokenExpired_ValidToken() {
        String token = jwtService.generateToken(testEmail, testRole);
        assertFalse(jwtService.isTokenExpired(token));
    }

    @Test
    public void testRefreshToken_ValidToken() {
        // Generate initial token
        String originalToken = jwtService.generateToken(testEmail, testRole);
        
        // Wait a moment to ensure different timestamps
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // Refresh token
        String refreshedToken = jwtService.refreshToken(originalToken);
        
        // Verify refreshed token is different but valid
        assertNotNull(refreshedToken);
        assertNotEquals(originalToken, refreshedToken);
        assertTrue(jwtService.validateToken(refreshedToken));
        
        // Verify claims are preserved
        assertEquals(testEmail, jwtService.getEmailFromToken(refreshedToken));
        assertEquals(testRole, jwtService.getRoleFromToken(refreshedToken));
    }

    @Test
    public void testRefreshToken_InvalidToken() {
        String invalidToken = "invalid.token.here";
        
        assertThrows(IllegalArgumentException.class, () -> {
            jwtService.refreshToken(invalidToken);
        });
    }

    @Test
    public void testGetClaimsFromToken() {
        Map<String, Object> additionalClaims = Map.of(
            "email", testEmail,
            "displayName", "Test User",
            "department", "Engineering"
        );
        
        String token = jwtService.generateToken(testUserId, List.of(testRole), additionalClaims);
        Claims claims = jwtService.getClaimsFromToken(token);
        
        assertNotNull(claims);
        assertEquals(testUserId, claims.getSubject());
        assertEquals(testEmail, claims.get("email", String.class));
        assertEquals("Test User", claims.get("displayName", String.class));
        assertEquals("Engineering", claims.get("department", String.class));
        assertEquals("user-journey-analytics", claims.getIssuer());
    }

    @Test
    public void testTokenContainsIssuedAtClaim() {
        String token = jwtService.generateToken(testEmail, testRole);
        Claims claims = jwtService.getClaimsFromToken(token);
        
        assertNotNull(claims.getIssuedAt());
        assertNotNull(claims.get("iat"));
    }

    @Test
    public void testTokenContainsExpirationClaim() {
        String token = jwtService.generateToken(testEmail, testRole);
        Claims claims = jwtService.getClaimsFromToken(token);
        
        assertNotNull(claims.getExpiration());
        assertTrue(claims.getExpiration().getTime() > System.currentTimeMillis());
    }
}
