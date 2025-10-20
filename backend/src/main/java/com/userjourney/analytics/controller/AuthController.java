package com.userjourney.analytics.controller;

import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.userjourney.analytics.service.AuditLogService;
import com.userjourney.analytics.service.FirebaseAuthService;
import com.userjourney.analytics.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private JwtService jwtService;

    @Autowired
    private FirebaseAuthService firebaseAuthService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // Hardcoded admin credentials for production (should be moved to database in
    // real production)
    private static final String ADMIN_USERNAME = "admin";
    private static final String ADMIN_PASSWORD_HASH = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsW5Uy/lW"; // "admin123"

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> adminLogin(
            @Valid @RequestBody AdminLoginRequest request,
            HttpServletRequest httpRequest) {

        try {
            String clientIp = getClientIpAddress(httpRequest);

            // Validate admin credentials
            if (!ADMIN_USERNAME.equals(request.getUsername()) ||
                    !passwordEncoder.matches(request.getPassword(), ADMIN_PASSWORD_HASH)) {

                auditLogService.logSecurityEvent(
                        request.getUsername(),
                        "ADMIN_LOGIN_FAILED",
                        clientIp,
                        "/api/auth/login");

                Map<String, Object> response = new HashMap<>();
                response.put("error", "Invalid credentials");
                response.put("timestamp", LocalDateTime.now().toString());
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }

            // Generate JWT token for admin
            String token = jwtService.generateAdminToken("admin-1", "admin@userjourney.com");

            auditLogService.logSecurityEvent(
                    "admin-1",
                    "ADMIN_LOGIN_SUCCESS",
                    clientIp,
                    "/api/auth/login");

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("user", Map.of(
                    "id", "admin-1",
                    "username", "admin",
                    "email", "admin@userjourney.com",
                    "role", "ADMIN",
                    "type", "admin"));
            response.put("expiresIn", 3600);
            response.put("timestamp", LocalDateTime.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error during admin login", e);
            Map<String, Object> response = new HashMap<>();
            response.put("error", "Authentication failed");
            response.put("timestamp", LocalDateTime.now().toString());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    // Keep existing analytics endpoints for backward compatibility
    @PostMapping("/analytics/login")
    public ResponseEntity<Map<String, Object>> loginAnalytics(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");

        // Use the same admin authentication for analytics dashboard
        if (ADMIN_USERNAME.equals(email) && passwordEncoder.matches(password, ADMIN_PASSWORD_HASH)) {
            String accessToken = jwtService.generateAdminToken("admin-1", email);
            String refreshToken = "refresh-" + System.currentTimeMillis();

            Map<String, Object> user = new HashMap<>();
            user.put("id", "admin-1");
            user.put("email", email);
            user.put("name", "admin");
            user.put("role", "analytics");
            user.put("permissions", Arrays.asList("read:analytics", "export:data", "view:dashboard"));
            user.put("isActive", true);
            user.put("createdAt", LocalDateTime.now().toString());
            user.put("lastLoginAt", LocalDateTime.now().toString());

            Map<String, Object> response = new HashMap<>();
            response.put("accessToken", accessToken);
            response.put("refreshToken", refreshToken);
            response.put("user", user);

            return ResponseEntity.ok(response);
        } else {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Invalid credentials");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }
    }

    @PostMapping("/firebase-verify")
    public ResponseEntity<Map<String, Object>> verifyFirebaseToken(
            @Valid @RequestBody FirebaseTokenRequest request,
            HttpServletRequest httpRequest) {

        try {
            String clientIp = getClientIpAddress(httpRequest);

            // Verify Firebase ID token
            FirebaseToken decodedToken = firebaseAuthService.verifyIdToken(request.getIdToken());

            // Generate JWT token for user
            String jwtToken = jwtService.generateUserToken(decodedToken.getUid(), decodedToken.getEmail());

            auditLogService.logSecurityEvent(
                    decodedToken.getUid(),
                    "FIREBASE_LOGIN_SUCCESS",
                    clientIp,
                    "/api/auth/firebase-verify");

            Map<String, Object> response = new HashMap<>();
            response.put("token", jwtToken);
            response.put("user", Map.of(
                    "id", decodedToken.getUid(),
                    "email", decodedToken.getEmail(),
                    "name", decodedToken.getName(),
                    "role", "USER",
                    "type", "user"));
            response.put("expiresIn", 3600);
            response.put("timestamp", LocalDateTime.now().toString());

            return ResponseEntity.ok(response);

        } catch (FirebaseAuthException e) {
            logger.error("Firebase token verification failed", e);

            auditLogService.logSecurityEvent(
                    "unknown",
                    "FIREBASE_LOGIN_FAILED",
                    getClientIpAddress(httpRequest),
                    "/api/auth/firebase-verify");

            Map<String, Object> response = new HashMap<>();
            response.put("error", "Invalid Firebase token");
            response.put("timestamp", LocalDateTime.now().toString());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        } catch (Exception e) {
            logger.error("Error during Firebase authentication", e);
            Map<String, Object> response = new HashMap<>();
            response.put("error", "Authentication failed");
            response.put("timestamp", LocalDateTime.now().toString());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request,
            HttpServletRequest httpRequest) {

        try {
            String clientIp = getClientIpAddress(httpRequest);

            if (!jwtService.validateToken(request.getToken())) {
                Map<String, Object> response = new HashMap<>();
                response.put("error", "Invalid token");
                response.put("timestamp", LocalDateTime.now().toString());
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }

            String newToken = jwtService.refreshToken(request.getToken());
            String userId = jwtService.getUserIdFromToken(newToken);

            auditLogService.logSecurityEvent(
                    userId,
                    "TOKEN_REFRESHED",
                    clientIp,
                    "/api/auth/refresh");

            Map<String, Object> response = new HashMap<>();
            response.put("token", newToken);
            response.put("expiresIn", 3600);
            response.put("timestamp", LocalDateTime.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error during token refresh", e);
            Map<String, Object> response = new HashMap<>();
            response.put("error", "Token refresh failed");
            response.put("timestamp", LocalDateTime.now().toString());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest httpRequest) {
        try {
            String authHeader = httpRequest.getHeader("Authorization");
            if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                String userId = jwtService.getUserIdFromToken(token);

                auditLogService.logSecurityEvent(
                        userId,
                        "USER_LOGOUT",
                        getClientIpAddress(httpRequest),
                        "/api/auth/logout");
            }

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Logged out successfully");
            response.put("timestamp", LocalDateTime.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error during logout", e);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Logged out");
            response.put("timestamp", LocalDateTime.now().toString());
            return ResponseEntity.ok(response);
        }
    }

    // Keep existing endpoints for backward compatibility
    @GetMapping("/analytics/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtService.validateToken(token)) {
                String userId = jwtService.getUserIdFromToken(token);

                Map<String, Object> user = new HashMap<>();
                user.put("id", userId);
                user.put("email", "admin@userjourney.com");
                user.put("name", "admin");
                user.put("role", "analytics");
                user.put("permissions", Arrays.asList("read:analytics", "export:data", "view:dashboard"));
                user.put("isActive", true);
                user.put("createdAt", LocalDateTime.now().toString());
                user.put("lastLoginAt", LocalDateTime.now().toString());

                return ResponseEntity.ok(user);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Invalid or missing token");
        return ResponseEntity.status(401).body(response);
    }

    @PostMapping("/analytics/logout")
    public ResponseEntity<Map<String, Object>> logoutAnalytics() {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Logged out successfully");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/verify")
    public ResponseEntity<Map<String, Object>> verifyToken(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtService.validateToken(token)) {
                String userId = jwtService.getUserIdFromToken(token);

                Map<String, Object> user = new HashMap<>();
                user.put("id", userId);
                user.put("email", "admin@userjourney.com");
                user.put("role", "analytics");

                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("valid", true);
                response.put("user", user);

                return ResponseEntity.ok(response);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("message", "Invalid or missing token");
        return ResponseEntity.status(401).body(response);
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(xForwardedFor)) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(xRealIp)) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }

    // Request DTOs
    public static class AdminLoginRequest {
        @NotBlank(message = "Username is required")
        private String username;

        @NotBlank(message = "Password is required")
        private String password;

        // Getters and setters
        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }

    public static class FirebaseTokenRequest {
        @NotBlank(message = "Firebase ID token is required")
        private String idToken;

        // Getters and setters
        public String getIdToken() {
            return idToken;
        }

        public void setIdToken(String idToken) {
            this.idToken = idToken;
        }
    }

    public static class RefreshTokenRequest {
        @NotBlank(message = "Token is required")
        private String token;

        // Getters and setters
        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }
    }
}