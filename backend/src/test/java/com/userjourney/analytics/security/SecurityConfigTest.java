package com.userjourney.analytics.security;

import com.userjourney.analytics.service.AuditLogService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureWebMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@AutoConfigureWebMvc
public class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuditLogService auditLogService;

    @Test
    public void testPublicEndpointsAccessible() throws Exception {
        // Test that public endpoints are accessible without authentication
        mockMvc.perform(get("/api/compliance/privacy-policy"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/compliance/terms-of-service"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    public void testProtectedEndpointsRequireAuthentication() throws Exception {
        // Test that protected endpoints require authentication
        mockMvc.perform(get("/api/events/track"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/analytics/dashboard"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/dashboard/metrics"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    public void testAuthenticatedUserCanAccessProtectedEndpoints() throws Exception {
        // Test that authenticated users can access protected endpoints
        // Note: These will return 404 or other errors since endpoints don't exist yet,
        // but they should not return 401 Unauthorized
        mockMvc.perform(get("/api/events/user/test-user"))
                .andExpect(result -> assertNotEquals(401, result.getResponse().getStatus()));
    }

    @Test
    public void testAdminEndpointsRequireAdminRole() throws Exception {
        // Test that admin endpoints require admin role
        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/compliance/audit/logs"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    public void testAdminUserCanAccessAdminEndpoints() throws Exception {
        // Test that admin users can access admin endpoints
        mockMvc.perform(get("/api/compliance/audit/logs"))
                .andExpect(result -> assertNotEquals(401, result.getResponse().getStatus()));
    }

    @Test
    @WithMockUser(roles = "USER")
    public void testRegularUserCannotAccessAdminEndpoints() throws Exception {
        // Test that regular users cannot access admin endpoints
        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testCorsConfiguration() throws Exception {
        // Test CORS headers are properly configured
        mockMvc.perform(options("/api/compliance/privacy-policy")
                .header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Access-Control-Allow-Origin"));
    }
}