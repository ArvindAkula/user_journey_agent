package com.userjourney.analytics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@SpringBootApplication(exclude = { DataSourceAutoConfiguration.class, RedisAutoConfiguration.class })
public class DevApplication {

    public static void main(String[] args) {
        SpringApplication.run(DevApplication.class, args);
    }

    @RestController
    @RequestMapping("/api/dev")
    @CrossOrigin(origins = "http://localhost:3000")
    public static class SimpleController {

        @GetMapping("/health")
        public Map<String, Object> health() {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "UP");
            response.put("timestamp", LocalDateTime.now());
            response.put("service", "User Journey Analytics Backend");
            response.put("version", "0.0.1-SNAPSHOT");
            response.put("profile", "development");
            return response;
        }

        @GetMapping("/ping")
        public Map<String, String> ping() {
            Map<String, String> response = new HashMap<>();
            response.put("message", "pong");
            response.put("backend", "running");
            return response;
        }

        @GetMapping("/demo")
        public Map<String, Object> demo() {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Demo endpoint working");
            response.put("features", new String[] { "Health Check", "Basic API", "CORS Enabled" });
            response.put("timestamp", LocalDateTime.now());
            return response;
        }

        @GetMapping("/events")
        public Map<String, Object> events() {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Events endpoint (mock)");
            response.put("events", new String[] { "user_login", "page_view", "button_click" });
            response.put("timestamp", LocalDateTime.now());
            return response;
        }
    }
}