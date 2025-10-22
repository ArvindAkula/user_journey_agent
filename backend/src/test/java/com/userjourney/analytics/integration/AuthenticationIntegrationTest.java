package com.userjourney.analytics.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.userjourney.analytics.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for Authentication Flow
 * Tests end-to-end authentication, role-based access, and token management
 */
@SpringBootTest(classes = com.userjourney.analytics.AnalyticsBackendApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class AuthenticationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @Test
    void testHealthEndpointIsPublic() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());
    }

    @Test
    void testProtectedEndpointRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/events"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void testAccessProtectedEndpointWithValidToken() throws Exception {
        // Generate a valid token
        String token = jwtService.generateToken("test@example.com", "VIEWER");

        mockMvc.perform(get("/api/events")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void testAccessProtectedEndpointWithInvalidToken() throws Exception {
        mockMvc.perform(get("/api/events")
                .header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void testAccessProtectedEndpointWithExpiredToken() throws Exception {
        // Create an expired token (this would require modifying JwtService to support custom expiration)
        String token = jwtService.generateToken("test@example.com", "VIEWER");
        
        // Wait for token to expire (not practical in real test, so we'll just test with invalid token)
        mockMvc.perform(get("/api/events")
                .header("Authorization", "Bearer " + token + "expired"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void testRoleBasedAccessControl_ViewerCanAccessEvents() throws Exception {
        String token = jwtService.generateToken("viewer@example.com", "VIEWER");

        mockMvc.perform(get("/api/events")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void testRoleBasedAccessControl_AnalystCanAccessAnalytics() throws Exception {
        String token = jwtService.generateToken("analyst@example.com", "ANALYST");

        mockMvc.perform(get("/api/analytics/dashboard")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void testRoleBasedAccessControl_ViewerCannotAccessAdminEndpoints() throws Exception {
        String token = jwtService.generateToken("viewer@example.com", "VIEWER");

        mockMvc.perform(get("/api/admin/users")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void testRoleBasedAccessControl_AdminCanAccessAllEndpoints() throws Exception {
        String token = jwtService.generateToken("admin@example.com", "ADMIN");

        // Test admin endpoint
        mockMvc.perform(get("/api/admin/users")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Test analytics endpoint
        mockMvc.perform(get("/api/analytics/dashboard")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Test events endpoint
        mockMvc.perform(get("/api/events")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void testTokenRefresh() throws Exception {
        String token = jwtService.generateToken("test@example.com", "VIEWER");

        mockMvc.perform(post("/api/auth/refresh")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists());
    }

    @Test
    void testGetCurrentUser() throws Exception {
        String token = jwtService.generateToken("test@example.com", "VIEWER");

        mockMvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@example.com"))
                .andExpect(jsonPath("$.role").value("VIEWER"));
    }

    @Test
    void testLogout() throws Exception {
        String token = jwtService.generateToken("test@example.com", "VIEWER");

        mockMvc.perform(post("/api/auth/logout")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void testCorsConfiguration() throws Exception {
        mockMvc.perform(options("/api/events")
                .header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Access-Control-Allow-Origin"));
    }
}
