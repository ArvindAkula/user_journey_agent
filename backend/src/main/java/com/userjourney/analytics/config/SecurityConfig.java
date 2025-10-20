package com.userjourney.analytics.config;

import com.userjourney.analytics.security.JwtAuthenticationEntryPoint;
import com.userjourney.analytics.security.JwtAuthenticationFilter;
import com.userjourney.analytics.security.RateLimitingFilter;
import com.userjourney.analytics.config.LoggingConfig.CorrelationIdFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.context.annotation.Profile;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@Profile("!production")
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private RateLimitingFilter rateLimitingFilter;

    @Autowired
    private CorrelationIdFilter correlationIdFilter;

    /**
     * Configure role hierarchy: ADMIN > ANALYST > VIEWER
     * This means:
     * - ADMIN has all permissions of ANALYST and VIEWER
     * - ANALYST has all permissions of VIEWER
     * - VIEWER has only their own permissions
     */
    @Bean
    public RoleHierarchy roleHierarchy() {
        RoleHierarchyImpl roleHierarchy = new RoleHierarchyImpl();
        // Define hierarchy: higher roles inherit permissions from lower roles
        String hierarchy = "ROLE_ADMIN > ROLE_ANALYST \n ROLE_ANALYST > ROLE_VIEWER";
        roleHierarchy.setHierarchy(hierarchy);
        return roleHierarchy;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // CORS must be configured BEFORE csrf and BEFORE authorization
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(jwtAuthenticationEntryPoint))
                .authorizeHttpRequests(authz -> authz
                        // Allow CORS preflight requests - MUST BE FIRST
                        .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                        
                        // Public endpoints - no authentication required
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/public/**").permitAll()
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers("/api/health/**").permitAll()
                        .requestMatchers("/api/ping").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/actuator/prometheus").permitAll()
                        .requestMatchers("/api/compliance/privacy-policy").permitAll()
                        .requestMatchers("/api/compliance/terms-of-service").permitAll()
                        
                        // Demo endpoints (temporarily public for development)
                        .requestMatchers("/api/events/**").permitAll()
                        .requestMatchers("/events/**").permitAll()
                        
                        // Admin-only endpoints - requires ADMIN role
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/compliance/audit/**").hasRole("ADMIN")
                        .requestMatchers("/api/monitoring/**").hasRole("ADMIN")
                        .requestMatchers("/actuator/**").hasRole("ADMIN")
                        .requestMatchers("/api/users/manage/**").hasRole("ADMIN")
                        
                        // Analytics endpoints - requires ANALYST or ADMIN role (via hierarchy)
                        .requestMatchers("/api/analytics/**").hasRole("ANALYST")
                        .requestMatchers("/analytics/**").hasRole("ANALYST")
                        .requestMatchers("/api/dashboard/**").hasRole("ANALYST")
                        .requestMatchers("/api/reports/**").hasRole("ANALYST")
                        .requestMatchers("/api/predictive/**").hasRole("ANALYST")
                        .requestMatchers("/api/nova/**").hasRole("ANALYST")
                        
                        // Viewer endpoints - requires VIEWER, ANALYST, or ADMIN role (via hierarchy)
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/events/**").hasRole("VIEWER")
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/analytics/view/**").hasRole("VIEWER")
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/dashboard/view/**").hasRole("VIEWER")
                        
                        // All other requests require authentication
                        .anyRequest().authenticated());

        // Add custom filters in order
        http.addFilterBefore(correlationIdFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterAfter(rateLimitingFilter, LoggingConfig.CorrelationIdFilter.class);
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Use setAllowedOrigins for exact matches (more reliable than patterns)
        configuration.setAllowedOrigins(Arrays.asList(
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:3002",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:3002"
        ));
        
        configuration.setAllowedMethods(Arrays.asList(
                "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"
        ));
        
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "Accept",
                "X-Requested-With",
                "X-Client-Type",
                "X-Environment",
                "Cache-Control",
                "Origin"
        ));
        
        configuration.setExposedHeaders(Arrays.asList(
                "Location",
                "Content-Type",
                "X-Total-Count"
        ));
        
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}