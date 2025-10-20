package com.userjourney.analytics.config;

import com.userjourney.analytics.security.JwtAuthenticationEntryPoint;
import com.userjourney.analytics.security.JwtAuthenticationFilter;
import com.userjourney.analytics.security.RateLimitingFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@Profile("production")
public class ProductionSecurityConfig {

    @Autowired
    private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private RateLimitingFilter rateLimitingFilter;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain productionFilterChain(HttpSecurity http) throws Exception {
        System.out.println("🔧 PRODUCTION SECURITY CONFIG INITIALIZED");
        
        http.cors(cors -> cors.configurationSource(productionCorsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex.authenticationEntryPoint(jwtAuthenticationEntryPoint))
            .headers(headers -> headers
                .frameOptions(frameOptions -> frameOptions.deny())
                .contentTypeOptions(contentTypeOptions -> {})
                .httpStrictTransportSecurity(hstsConfig -> hstsConfig
                    .maxAgeInSeconds(31536000)
                    .includeSubDomains(true)
                    .preload(true))
                .referrerPolicy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                .and()
                .addHeaderWriter((request, response) -> {
                    response.setHeader("X-Content-Type-Options", "nosniff");
                    response.setHeader("X-Frame-Options", "DENY");
                    response.setHeader("X-XSS-Protection", "1; mode=block");
                    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
                    response.setHeader("Content-Security-Policy", 
                        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';");
                }))
            .authorizeHttpRequests(authz -> authz
                // Allow CORS preflight requests - MUST BE FIRST
                .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                
                // Public health endpoints
                .requestMatchers("/health", "/ping", "/api/health", "/api/ping").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                
                // Public compliance endpoints
                .requestMatchers("/compliance/privacy-policy", "/compliance/terms-of-service").permitAll()
                
                // Authentication endpoints
                .requestMatchers("/auth/**", "/api/auth/**").permitAll()
                
                // Error reporting endpoints (public for frontend error tracking)
                .requestMatchers("/errors", "/errors/**", "/performance").permitAll()
                
                // Event tracking endpoints (public for demo/development) - SPECIFIC BEFORE GENERAL
                .requestMatchers("/api/events/**", "/events/**").permitAll()
                .requestMatchers("/api/analytics/dashboard", "/analytics/dashboard").permitAll()
                .requestMatchers("/api/analytics/**", "/analytics/**").permitAll()
                
                // User app endpoints (require Firebase authentication)
                .requestMatchers("/user-profile/**", "/documents/**", "/videos/**", "/calculator/**").authenticated()
                
                // Admin-only endpoints
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .requestMatchers("/compliance/audit/**").hasRole("ADMIN")
                .requestMatchers("/actuator/**").hasRole("ADMIN")
                .requestMatchers("/dashboard/**").hasRole("ADMIN")
                .requestMatchers("/predictive/**").hasRole("ADMIN")
                .requestMatchers("/nova/**").hasRole("ADMIN")
                
                // WebSocket endpoints
                .requestMatchers("/ws/**", "/ws-native/**").authenticated()
                
                // All other requests are public for now (demo mode)
                .anyRequest().permitAll()
            );

        // Add custom filters in correct order
        http.addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource productionCorsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // For development/demo, allow all localhost ports
        // In real production, use environment variable
        List<String> origins;
        if (allowedOrigins != null && !allowedOrigins.isEmpty()) {
            origins = Arrays.asList(allowedOrigins.split(","));
        } else {
            // Default to localhost ports for development
            origins = Arrays.asList(
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:3002",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:3002"
            );
        }
        
        configuration.setAllowedOrigins(origins);  // Use exact origins, not patterns
        
        configuration.setAllowedMethods(Arrays.asList(
            "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"
        ));
        
        configuration.setAllowedHeaders(Arrays.asList(
            "Authorization", "Content-Type", "X-Requested-With", "Accept", 
            "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers",
            "X-Client-Type", "X-Environment", "Cache-Control"
        ));
        
        configuration.setExposedHeaders(Arrays.asList(
            "Location", "Content-Type", "X-Total-Count"
        ));
        
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder productionPasswordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}