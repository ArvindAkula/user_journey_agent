package com.userjourney.analytics.config;

import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;

/**
 * Configuration for structured logging with correlation IDs
 */
@Configuration
public class LoggingConfig {

    public static final String CORRELATION_ID_HEADER = "X-Correlation-ID";
    public static final String CORRELATION_ID_MDC_KEY = "correlationId";
    public static final String REQUEST_ID_MDC_KEY = "requestId";
    public static final String USER_ID_MDC_KEY = "userId";
    public static final String SESSION_ID_MDC_KEY = "sessionId";

    @Bean
    public CorrelationIdFilter correlationIdFilter() {
        return new CorrelationIdFilter();
    }

    /**
     * Filter to add correlation ID to all requests for request tracing
     */
    public static class CorrelationIdFilter extends OncePerRequestFilter {

        @Override
        protected void doFilterInternal(HttpServletRequest request, 
                                      HttpServletResponse response, 
                                      FilterChain filterChain) throws ServletException, IOException {
            
            try {
                // Get or generate correlation ID
                String correlationId = getOrGenerateCorrelationId(request);
                
                // Generate unique request ID
                String requestId = UUID.randomUUID().toString().substring(0, 8);
                
                // Add to MDC for logging
                MDC.put(CORRELATION_ID_MDC_KEY, correlationId);
                MDC.put(REQUEST_ID_MDC_KEY, requestId);
                
                // Extract user information if available
                extractUserContext(request);
                
                // Add correlation ID to response header
                response.setHeader(CORRELATION_ID_HEADER, correlationId);
                
                // Continue with the request
                filterChain.doFilter(request, response);
                
            } finally {
                // Clean up MDC to prevent memory leaks
                MDC.clear();
            }
        }

        private String getOrGenerateCorrelationId(HttpServletRequest request) {
            // Check if correlation ID is provided in header
            String correlationId = request.getHeader(CORRELATION_ID_HEADER);
            
            if (correlationId == null || correlationId.trim().isEmpty()) {
                // Generate new correlation ID
                correlationId = UUID.randomUUID().toString();
            }
            
            return correlationId;
        }

        private void extractUserContext(HttpServletRequest request) {
            // Extract user ID from JWT token or session if available
            String userId = extractUserIdFromRequest(request);
            if (userId != null) {
                MDC.put(USER_ID_MDC_KEY, userId);
            }
            
            // Extract session ID if available
            String sessionId = request.getHeader("X-Session-ID");
            if (sessionId != null) {
                MDC.put(SESSION_ID_MDC_KEY, sessionId);
            }
        }

        private String extractUserIdFromRequest(HttpServletRequest request) {
            // Try to extract from Authorization header
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                try {
                    // This would integrate with your JWT service
                    // For now, return null - will be enhanced when JWT is processed
                    return null;
                } catch (Exception e) {
                    // Log error but don't fail the request
                    return null;
                }
            }
            
            return null;
        }
    }
}