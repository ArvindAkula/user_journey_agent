package com.userjourney.analytics.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.proxy.ProxyManager;
// import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager; // Commented out due to dependency issues
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.codec.ByteArrayCodec;
import io.lettuce.core.codec.RedisCodec;
import io.lettuce.core.codec.StringCodec;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(1)
public class RateLimitingFilter extends OncePerRequestFilter {

    private final Map<String, Bucket> cache = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;

    @Value("${app.rate-limit.enabled:true}")
    private boolean rateLimitEnabled;

    @Value("${app.rate-limit.requests-per-minute:1000}")
    private int generalLimit;

    @Value("${app.rate-limit.burst-capacity:100}")
    private int burstCapacity;

    // Rate limits for different endpoint categories
    private static final int AUTH_LIMIT = 10;
    private static final int ADMIN_LIMIT = 50;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, 
                                  FilterChain filterChain) throws ServletException, IOException {
        
        if (!rateLimitEnabled) {
            filterChain.doFilter(request, response);
            return;
        }
        
        String clientId = getClientId(request);
        String endpoint = request.getRequestURI();
        
        // Skip rate limiting for health checks
        if (endpoint.equals("/api/health") || endpoint.equals("/api/ping")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        Bucket bucket = getBucket(clientId, endpoint);
        
        if (bucket.tryConsume(1)) {
            // Add rate limit headers
            response.setHeader("X-RateLimit-Remaining", String.valueOf(bucket.getAvailableTokens()));
            response.setHeader("X-RateLimit-Limit", String.valueOf(getRateLimitForEndpoint(endpoint)));
            
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", "60"); // Retry after 60 seconds
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", HttpStatus.TOO_MANY_REQUESTS.value());
            errorResponse.put("error", "Too Many Requests");
            errorResponse.put("message", "Rate limit exceeded. Please try again later.");
            errorResponse.put("timestamp", LocalDateTime.now().toString());
            errorResponse.put("retryAfter", 60);
            
            objectMapper.writeValue(response.getWriter(), errorResponse);
        }
    }

    private String getClientId(HttpServletRequest request) {
        // Use IP address as client identifier
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

    private Bucket getBucket(String clientId, String endpoint) {
        String key = clientId + ":" + getEndpointCategory(endpoint);
        return cache.computeIfAbsent(key, this::createBucket);
    }

    private String getEndpointCategory(String endpoint) {
        if (endpoint.startsWith("/api/auth/")) {
            return "auth";
        } else if (endpoint.startsWith("/api/admin/")) {
            return "admin";
        } else {
            return "general";
        }
    }

    private int getRateLimitForEndpoint(String endpoint) {
        String category = getEndpointCategory(endpoint);
        switch (category) {
            case "auth":
                return AUTH_LIMIT;
            case "admin":
                return ADMIN_LIMIT;
            default:
                return generalLimit;
        }
    }

    private Bucket createBucket(String key) {
        String category = key.split(":")[1];
        
        BucketConfiguration configuration;
        switch (category) {
            case "auth":
                configuration = BucketConfiguration.builder()
                    .addLimit(Bandwidth.simple(AUTH_LIMIT, Duration.ofMinutes(1)))
                    .build();
                break;
            case "admin":
                configuration = BucketConfiguration.builder()
                    .addLimit(Bandwidth.simple(ADMIN_LIMIT, Duration.ofMinutes(1)))
                    .build();
                break;
            default:
                configuration = BucketConfiguration.builder()
                    .addLimit(Bandwidth.simple(generalLimit, Duration.ofMinutes(1)))
                    .addLimit(Bandwidth.simple(burstCapacity, Duration.ofSeconds(10))) // Burst capacity
                    .build();
                break;
        }
        
        Bandwidth[] bandwidths = configuration.getBandwidths();
        return Bucket.builder()
            .addLimit(bandwidths.length > 0 ? bandwidths[0] : Bandwidth.simple(100, java.time.Duration.ofMinutes(1)))
            .build();
    }
}