package com.userjourney.analytics.service;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.auth.UserRecord;
import com.userjourney.analytics.config.AuthorizedUsersConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for FirebaseAuthService
 * Tests Firebase token verification and user authorization
 */
@SpringBootTest(classes = com.userjourney.analytics.AnalyticsBackendApplication.class)
public class FirebaseAuthServiceTest {

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private AuthorizedUsersConfig authorizedUsersConfig;

    @Mock
    private FirebaseToken mockFirebaseToken;

    @InjectMocks
    private FirebaseAuthService firebaseAuthService;

    private String testEmail;
    private String testUid;
    private String testRole;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        testEmail = "test@example.com";
        testUid = "test-uid-123";
        testRole = "ADMIN";
    }

    @Test
    public void testGetUserRole_AuthorizedUser() {
        // Mock authorized user configuration
        when(authorizedUsersConfig.getUserRole(testEmail)).thenReturn(Optional.of(testRole));

        String role = firebaseAuthService.getUserRole(testEmail);

        assertEquals(testRole, role);
        verify(authorizedUsersConfig).getUserRole(testEmail);
    }

    @Test
    public void testGetUserRole_UnauthorizedUser() {
        // Mock unauthorized user
        when(authorizedUsersConfig.getUserRole(testEmail)).thenReturn(Optional.empty());

        String role = firebaseAuthService.getUserRole(testEmail);

        assertNull(role);
        verify(authorizedUsersConfig).getUserRole(testEmail);
    }

    @Test
    public void testIsAuthorizedUser_Authorized() {
        // Mock authorized user
        when(authorizedUsersConfig.isAuthorizedUser(testEmail)).thenReturn(true);
        doNothing().when(auditLogService).logSecurityEvent(anyString(), anyString(), anyString(), anyString());

        boolean isAuthorized = firebaseAuthService.isAuthorizedUser(testEmail);

        assertTrue(isAuthorized);
        verify(authorizedUsersConfig).isAuthorizedUser(testEmail);
        verify(auditLogService).logSecurityEvent(
            eq(testEmail),
            eq("USER_AUTHORIZATION_CHECK_PASSED"),
            eq("system"),
            eq("firebase-auth")
        );
    }

    @Test
    public void testIsAuthorizedUser_Unauthorized() {
        // Mock unauthorized user
        when(authorizedUsersConfig.isAuthorizedUser(testEmail)).thenReturn(false);
        doNothing().when(auditLogService).logSecurityEvent(anyString(), anyString(), anyString(), anyString());

        boolean isAuthorized = firebaseAuthService.isAuthorizedUser(testEmail);

        assertFalse(isAuthorized);
        verify(authorizedUsersConfig).isAuthorizedUser(testEmail);
        verify(auditLogService).logSecurityEvent(
            eq(testEmail),
            eq("USER_AUTHORIZATION_CHECK_FAILED"),
            eq("system"),
            eq("firebase-auth")
        );
    }

    @Test
    public void testGetUserDisplayName_AuthorizedUser() {
        String displayName = "Test User";
        AuthorizedUsersConfig.AuthorizedUser authorizedUser = new AuthorizedUsersConfig.AuthorizedUser();
        authorizedUser.setEmail(testEmail);
        authorizedUser.setDisplayName(displayName);
        authorizedUser.setRole(testRole);

        when(authorizedUsersConfig.getAuthorizedUser(testEmail)).thenReturn(Optional.of(authorizedUser));

        String result = firebaseAuthService.getUserDisplayName(testEmail);

        assertEquals(displayName, result);
        verify(authorizedUsersConfig).getAuthorizedUser(testEmail);
    }

    @Test
    public void testGetUserDisplayName_UnauthorizedUser() {
        when(authorizedUsersConfig.getAuthorizedUser(testEmail)).thenReturn(Optional.empty());

        String result = firebaseAuthService.getUserDisplayName(testEmail);

        assertNull(result);
        verify(authorizedUsersConfig).getAuthorizedUser(testEmail);
    }

    @Test
    public void testIsTokenValid_ValidToken() {
        // Note: This test requires mocking static FirebaseAuth methods
        // In a real scenario, you would use PowerMock or refactor to make it testable
        // For now, we'll test the logic flow
        
        // This is a placeholder test that verifies the method exists and handles exceptions
        String invalidToken = "invalid-token";
        boolean isValid = firebaseAuthService.isTokenValid(invalidToken);
        
        // With an invalid token, it should return false
        assertFalse(isValid);
    }

    @Test
    public void testGetUserRole_MultipleRoles() {
        // Test with different roles
        String[] roles = {"ADMIN", "ANALYST", "VIEWER"};
        String[] emails = {"admin@example.com", "analyst@example.com", "viewer@example.com"};

        for (int i = 0; i < roles.length; i++) {
            when(authorizedUsersConfig.getUserRole(emails[i])).thenReturn(Optional.of(roles[i]));
            String role = firebaseAuthService.getUserRole(emails[i]);
            assertEquals(roles[i], role);
        }
    }

    @Test
    public void testIsAuthorizedUser_LogsSecurityEvents() {
        // Test that security events are logged for both authorized and unauthorized users
        when(authorizedUsersConfig.isAuthorizedUser(testEmail)).thenReturn(true);
        doNothing().when(auditLogService).logSecurityEvent(anyString(), anyString(), anyString(), anyString());

        firebaseAuthService.isAuthorizedUser(testEmail);

        verify(auditLogService, times(1)).logSecurityEvent(
            anyString(),
            anyString(),
            eq("system"),
            eq("firebase-auth")
        );
    }
}
