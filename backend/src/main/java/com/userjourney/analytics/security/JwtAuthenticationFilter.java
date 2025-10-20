package com.userjourney.analytics.security;

import com.userjourney.analytics.service.AuditLogService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Value("${app.jwt.secret:defaultSecretKeyThatShouldBeChangedInProduction}")
    private String jwtSecret;

    @Autowired
    private AuditLogService auditLogService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        String path = request.getRequestURI();
        
        // Remove context path for comparison
        String contextPath = request.getContextPath();
        if (path.startsWith(contextPath)) {
            path = path.substring(contextPath.length());
        }
        
        boolean skip = path.equals("/errors") || 
                      path.startsWith("/errors/") || 
                      path.equals("/performance") ||
                      path.equals("/health") ||
                      path.equals("/ping") ||
                      path.equals("/api/health") ||
                      path.equals("/api/ping") ||
                      path.startsWith("/api/events/") ||
                      path.startsWith("/events/") ||
                      path.startsWith("/api/analytics/") ||
                      path.startsWith("/analytics/") ||
                      path.startsWith("/auth/") ||
                      path.startsWith("/compliance/") ||
                      path.startsWith("/actuator/");
        
        // Only log non-skipped paths to reduce noise
        if (!skip) {
            logger.info("🔐 JWT Filter will authenticate: {}", path);
        }
        
        return skip;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        // Generate correlation ID for request tracing
        String correlationId = UUID.randomUUID().toString();
        MDC.put("correlationId", correlationId);

        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && validateToken(jwt)) {
                Claims claims = getClaimsFromToken(jwt);
                String userId = claims.getSubject();

                // Safely extract roles with null check
                @SuppressWarnings("unchecked")
                List<String> roles = (List<String>) claims.get("roles");
                if (roles == null) {
                    roles = List.of("USER"); // Default role
                }

                List<SimpleGrantedAuthority> authorities = roles.stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                        .collect(Collectors.toList());

                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(userId,
                        null, authorities);
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);

                // Add user context to MDC for logging
                MDC.put("userId", userId);

                // Log successful authentication
                logger.info("✅ Authenticated user: {} for {}", userId, request.getRequestURI());
                auditLogService.logSecurityEvent(userId, "AUTHENTICATION_SUCCESS",
                        getClientIpAddress(request), request.getRequestURI());
            }
        } catch (ExpiredJwtException ex) {
            logger.warn("⚠️  JWT token expired: {}", request.getRequestURI());
            auditLogService.logSecurityEvent("unknown", "TOKEN_EXPIRED",
                    getClientIpAddress(request), request.getRequestURI());
        } catch (SignatureException ex) {
            logger.error("❌ Invalid JWT signature: {}", request.getRequestURI());
            auditLogService.logSecurityEvent("unknown", "INVALID_SIGNATURE",
                    getClientIpAddress(request), request.getRequestURI());
        } catch (Exception ex) {
            logger.error("❌ Authentication failed: {}", request.getRequestURI(), ex);
            auditLogService.logSecurityEvent("unknown", "AUTHENTICATION_FAILURE",
                    getClientIpAddress(request), request.getRequestURI());
        } finally {
            // Clean up MDC after request
            try {
                filterChain.doFilter(request, response);
            } finally {
                MDC.clear();
            }
        }
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    private boolean validateToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (MalformedJwtException ex) {
            logger.error("Invalid JWT token");
        } catch (ExpiredJwtException ex) {
            logger.error("Expired JWT token");
        } catch (UnsupportedJwtException ex) {
            logger.error("Unsupported JWT token");
        } catch (IllegalArgumentException ex) {
            logger.error("JWT claims string is empty");
        } catch (SignatureException ex) {
            logger.error("Invalid JWT signature");
        }
        return false;
    }

    private Claims getClaimsFromToken(String token) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
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
}