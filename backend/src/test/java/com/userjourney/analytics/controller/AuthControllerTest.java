package com.userjourney.analytics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.userjourney.analytics.service.AuditLogService;
import com.userjourney.analytics.service.FirebaseAuthService;
import com.userjourney.analytics.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for AuthController
 * Tests authentication endpoints including login, logout, and token operations
 */
@SpringBootTest(classes = com.userjourney.analytics.AnalyticsBackendApplication.class)
@AutoConfigureMockMvc
public class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private FirebaseAuthService firebaseAuthService;

    @MockBean
    private AuditLogService auditLogService;

    @MockBean
    private PasswordEncoder passwordEncoder;

    @MockBean
    private FirebaseToken mockFirebaseToken;

    private String testEmail;
    private String testUid;
    private String testRole;
    private String testIdToken;
    private String testJwtToken;

    @BeforeEach
    public void setUp() {
        testEmail = "test@example.com";
        testUid = "test-uid-123";
        testRole = "ADMIN";
        testIdToken = "firebase-id-token";
        testJwtToken = "jwt-token-123";

        // Setup common mocks
        doNothing().when(auditLogService).logSecurityEvent(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    public void testLogin_Success() throws Exception {
        // Mock Firebase token verification
        when(mockFirebaseToken.getEmail()).thenReturn(testEmail);
        when(mockFirebaseToken.getUid()).thenReturn(testUid);
        when(mockFirebaseToken.getName()).thenReturn("Test User");
        when(firebaseAuthService.verifyIdToken(testIdToken)).thenReturn(mockFirebaseToken);
        when(firebaseAuthService.isAuthorizedUser(testEmail)).thenReturn(true);
        when(firebaseAuthService.getUserRole(testEmail)).thenReturn(testRole);
        when(firebaseAuthService.getUserDisplayName(testEmail)).thenReturn("Test User");
        when(jwtService.generateToken(eq(testUid), anyList(), anyMap())).thenReturn(testJwtToken);

        // Perform login request
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("idToken", testIdToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value(testJwtToken))
                .andExpect(jsonPath("$.user.uid").value(testUid))
                .andExpect(jsonPath("$.user.email").value(testEmail))
                .andExpect(jsonPath("$.user.role").value(testRole))
                .andExpect(jsonPath("$.expiresIn").value(86400));

        // Verify interactions
        verify(firebaseAuthService).verifyIdToken(testIdToken);
        verify(firebaseAuthService).isAuthorizedUser(testEmail);
        verify(firebaseAuthService).getUserRole(testEmail);
        verify(jwtService).generateToken(eq(testUid), anyList(), anyMap());
        verify(auditLogService).logSecurityEvent(eq(testUid), eq("LOGIN_SUCCESS"), anyString(), eq("/api/auth/login"));
    }

    @Test
    public void testLogin_UnauthorizedUser() throws Exception {
        // Mock Firebase token verification but user not authorized
        when(mockFirebaseToken.getEmail()).thenReturn(testEmail);
        when(mockFirebaseToken.getUid()).thenReturn(testUid);
        when(firebaseAuthService.verifyIdToken(testIdToken)).thenReturn(mockFirebaseToken);
        when(firebaseAuthService.isAuthorizedUser(testEmail)).thenReturn(false);

        // Perform login request
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("idToken", testIdToken))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("You are not authorized to access this application"));

        // Verify audit log
        verify(auditLogService).logSecurityEvent(eq(testEmail), eq("UNAUTHORIZED_LOGIN_ATTEMPT"), anyString(), eq("/api/auth/login"));
    }

    @Test
    public void testLogin_InvalidFirebaseToken() throws Exception {
        // Mock Firebase token verification failure
        when(firebaseAuthService.verifyIdToken(testIdToken))
                .thenThrow(new RuntimeException("Invalid token"));

        // Perform login request
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("idToken", testIdToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid credentials"));

        // Verify audit log
        verify(auditLogService).logSecurityEvent(eq("unknown"), eq("LOGIN_FAILED_INVALID_TOKEN"), anyString(), eq("/api/auth/login"));
    }

    @Test
    public void testLogin_MissingIdToken() throws Exception {
        // Perform login request without idToken
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of())))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testRefreshToken_Success() throws Exception {
        // Mock token validation and refresh
        when(jwtService.validateToken(testJwtToken)).thenReturn(true);
        when(jwtService.isTokenExpired(testJwtToken)).thenReturn(false);
        when(jwtService.refreshToken(testJwtToken)).thenReturn("new-jwt-token");
        when(jwtService.getUserIdFromToken("new-jwt-token")).thenReturn(testUid);
        when(jwtService.getEmailFromToken("new-jwt-token")).thenReturn(testEmail);

        // Perform refresh request
        mockMvc.perform(post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("token", testJwtToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("new-jwt-token"))
                .andExpect(jsonPath("$.expiresIn").value(86400));

        // Verify interactions
        verify(jwtService).validateToken(testJwtToken);
        verify(jwtService).refreshToken(testJwtToken);
        verify(auditLogService).logSecurityEvent(eq(testUid), eq("TOKEN_REFRESHED"), anyString(), eq("/api/auth/refresh"));
    }

    @Test
    public void testRefreshToken_InvalidToken() throws Exception {
        // Mock invalid token
        when(jwtService.validateToken(testJwtToken)).thenReturn(false);

        // Perform refresh request
        mockMvc.perform(post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("token", testJwtToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid or expired token"));
    }

    @Test
    public void testRefreshToken_ExpiredToken() throws Exception {
        // Mock expired token
        when(jwtService.validateToken(testJwtToken)).thenReturn(true);
        when(jwtService.isTokenExpired(testJwtToken)).thenReturn(true);

        // Perform refresh request
        mockMvc.perform(post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("token", testJwtToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Token expired - please login again"));
    }

    @Test
    public void testLogout_Success() throws Exception {
        // Mock token validation
        when(jwtService.validateToken(testJwtToken)).thenReturn(true);
        when(jwtService.getUserIdFromToken(testJwtToken)).thenReturn(testUid);
        when(jwtService.getEmailFromToken(testJwtToken)).thenReturn(testEmail);

        // Perform logout request
        mockMvc.perform(post("/api/auth/logout")
                .header("Authorization", "Bearer " + testJwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logged out successfully"));

        // Verify audit log
        verify(auditLogService).logSecurityEvent(eq(testUid), eq("USER_LOGOUT"), anyString(), eq("/api/auth/logout"));
    }

    @Test
    public void testLogout_WithoutToken() throws Exception {
        // Perform logout request without token
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logged out successfully"));
    }

    @Test
    public void testGetCurrentUser_Success() throws Exception {
        // Mock token validation and extraction
        when(jwtService.validateToken(testJwtToken)).thenReturn(true);
        when(jwtService.getUserIdFromToken(testJwtToken)).thenReturn(testUid);
        when(jwtService.getEmailFromToken(testJwtToken)).thenReturn(testEmail);
        when(jwtService.getRolesFromToken(testJwtToken)).thenReturn(List.of(testRole));
        when(firebaseAuthService.isAuthorizedUser(testEmail)).thenReturn(true);
        when(firebaseAuthService.getUserDisplayName(testEmail)).thenReturn("Test User");

        // Perform get current user request
        mockMvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + testJwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.uid").value(testUid))
                .andExpect(jsonPath("$.user.email").value(testEmail))
                .andExpect(jsonPath("$.user.role").value(testRole))
                .andExpect(jsonPath("$.user.displayName").value("Test User"));
    }

    @Test
    public void testGetCurrentUser_MissingAuthHeader() throws Exception {
        // Perform get current user request without auth header
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Missing or invalid Authorization header"));
    }

    @Test
    public void testGetCurrentUser_InvalidToken() throws Exception {
        // Mock invalid token
        when(jwtService.validateToken(testJwtToken)).thenReturn(false);

        // Perform get current user request
        mockMvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + testJwtToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid or expired token"));
    }

    @Test
    public void testAdminLogin_Success() throws Exception {
        // Mock password encoder
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        when(jwtService.generateAdminToken(anyString(), anyString())).thenReturn(testJwtToken);

        // Perform admin login request
        mockMvc.perform(post("/api/auth/admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "username", "admin",
                    "password", "admin123"
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.user.role").value("ADMIN"));

        // Verify audit log
        verify(auditLogService).logSecurityEvent(eq("admin-1"), eq("ADMIN_LOGIN_SUCCESS"), anyString(), eq("/api/auth/admin/login"));
    }

    @Test
    public void testAdminLogin_InvalidCredentials() throws Exception {
        // Mock password encoder to return false
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        // Perform admin login request with wrong password
        mockMvc.perform(post("/api/auth/admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "username", "admin",
                    "password", "wrongpassword"
                ))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid credentials"));

        // Verify audit log
        verify(auditLogService).logSecurityEvent(eq("admin"), eq("ADMIN_LOGIN_FAILED"), anyString(), eq("/api/auth/admin/login"));
    }

    @Test
    public void testFirebaseVerify_Success() throws Exception {
        // Mock Firebase token verification
        when(mockFirebaseToken.getUid()).thenReturn(testUid);
        when(mockFirebaseToken.getEmail()).thenReturn(testEmail);
        when(mockFirebaseToken.getName()).thenReturn("Test User");
        when(firebaseAuthService.verifyIdToken(testIdToken)).thenReturn(mockFirebaseToken);
        when(jwtService.generateUserToken(testUid, testEmail)).thenReturn(testJwtToken);

        // Perform Firebase verify request
        mockMvc.perform(post("/api/auth/firebase-verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("idToken", testIdToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value(testJwtToken))
                .andExpect(jsonPath("$.user.id").value(testUid))
                .andExpect(jsonPath("$.user.email").value(testEmail));

        // Verify audit log
        verify(auditLogService).logSecurityEvent(eq(testUid), eq("FIREBASE_LOGIN_SUCCESS"), anyString(), eq("/api/auth/firebase-verify"));
    }

    @Test
    public void testFirebaseVerify_InvalidToken() throws Exception {
        // Mock Firebase token verification failure
        when(firebaseAuthService.verifyIdToken(testIdToken))
                .thenThrow(new RuntimeException("Invalid token"));

        // Perform Firebase verify request
        mockMvc.perform(post("/api/auth/firebase-verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("idToken", testIdToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid Firebase token"));

        // Verify audit log
        verify(auditLogService).logSecurityEvent(eq("unknown"), eq("FIREBASE_LOGIN_FAILED"), anyString(), eq("/api/auth/firebase-verify"));
    }
}
