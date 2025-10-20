package com.userjourney.analytics.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.userjourney.analytics.service.ComplianceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureWebMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureWebMvc
public class ComplianceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ComplianceService complianceService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser(username = "testuser", roles = "USER")
    public void testGDPRDataExport() throws Exception {
        // Mock the service response
        Map<String, Object> mockData = Map.of(
            "UserProfiles", Map.of("userId", "testuser", "email", "test@example.com"),
            "exportTimestamp", "2024-01-01T00:00:00"
        );
        
        when(complianceService.exportUserData(eq("testuser"), anyString(), anyString()))
            .thenReturn(CompletableFuture.completedFuture(mockData));

        mockMvc.perform(post("/api/compliance/gdpr/export/testuser"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("completed"))
                .andExpect(jsonPath("$.data").exists())
                .andExpect(jsonPath("$.requestId").exists());
    }

    @Test
    @WithMockUser(username = "testuser", roles = "USER")
    public void testGDPRDataDeletion() throws Exception {
        // Mock successful deletion
        when(complianceService.deleteUserData(eq("testuser"), anyString(), anyString(), anyString()))
            .thenReturn(CompletableFuture.completedFuture(true));

        mockMvc.perform(delete("/api/compliance/gdpr/delete/testuser")
                .param("reason", "User request"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("completed"))
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.requestId").exists());
    }

    @Test
    @WithMockUser(username = "testuser", roles = "USER")
    public void testCCPADataDeletion() throws Exception {
        // Mock successful CCPA deletion
        when(complianceService.deleteCCPAUserData(eq("testuser"), anyString(), anyString()))
            .thenReturn(CompletableFuture.completedFuture(true));

        mockMvc.perform(delete("/api/compliance/ccpa/delete/testuser"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("completed"))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @WithMockUser(username = "testuser", roles = "USER")
    public void testUpdateUserConsent() throws Exception {
        Map<String, Boolean> consentPreferences = Map.of(
            "analytics", true,
            "marketing", false,
            "personalization", true
        );

        mockMvc.perform(post("/api/compliance/consent/testuser")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(consentPreferences)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @WithMockUser(username = "testuser", roles = "USER")
    public void testGetUserConsent() throws Exception {
        Map<String, Boolean> mockConsent = Map.of(
            "analytics", true,
            "marketing", false,
            "personalization", true,
            "essential", true
        );

        when(complianceService.getUserConsent("testuser")).thenReturn(mockConsent);

        mockMvc.perform(get("/api/compliance/consent/testuser"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.consent.analytics").value(true))
                .andExpect(jsonPath("$.consent.marketing").value(false))
                .andExpect(jsonPath("$.consent.essential").value(true));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    public void testAnonymizeUserData() throws Exception {
        mockMvc.perform(post("/api/compliance/anonymize/testuser"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @WithMockUser(roles = "USER")
    public void testRegularUserCannotAnonymizeData() throws Exception {
        mockMvc.perform(post("/api/compliance/anonymize/testuser"))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testGetPrivacyPolicy() throws Exception {
        mockMvc.perform(get("/api/compliance/privacy-policy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Privacy Policy"))
                .andExpect(jsonPath("$.dataTypes").exists())
                .andExpect(jsonPath("$.rights").exists());
    }

    @Test
    public void testGetTermsOfService() throws Exception {
        mockMvc.perform(get("/api/compliance/terms-of-service"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Terms of Service"))
                .andExpect(jsonPath("$.dataRetention").exists())
                .andExpect(jsonPath("$.userRights").exists());
    }

    @Test
    public void testUnauthorizedAccessToUserData() throws Exception {
        // Test that users cannot access other users' data
        mockMvc.perform(post("/api/compliance/gdpr/export/otheruser"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(delete("/api/compliance/gdpr/delete/otheruser"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "testuser", roles = "USER")
    public void testUserCannotAccessOtherUsersData() throws Exception {
        // Test that authenticated users cannot access other users' data
        mockMvc.perform(post("/api/compliance/gdpr/export/otheruser"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/compliance/consent/otheruser"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = "ADMIN")
    public void testAdminCanAccessAnyUserData() throws Exception {
        // Mock the service response for admin access
        Map<String, Object> mockData = Map.of("data", "admin-accessible");
        when(complianceService.exportUserData(eq("anyuser"), anyString(), anyString()))
            .thenReturn(CompletableFuture.completedFuture(mockData));

        mockMvc.perform(post("/api/compliance/gdpr/export/anyuser"))
                .andExpect(status().isOk());
    }
}