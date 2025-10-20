package com.userjourney.analytics.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Configuration class for loading authorized users from authorized-users.yml
 * This class manages the list of users who are permitted to access the system
 * and their associated roles.
 */
@Configuration
@ConfigurationProperties(prefix = "authorized")
public class AuthorizedUsersConfig {

    private List<AuthorizedUser> users = new ArrayList<>();

    public List<AuthorizedUser> getUsers() {
        return users;
    }

    public void setUsers(List<AuthorizedUser> users) {
        this.users = users;
    }

    /**
     * Check if a user with the given email is authorized
     * 
     * @param email The user's email address
     * @return true if the user is authorized, false otherwise
     */
    public boolean isAuthorizedUser(String email) {
        return users.stream()
                .anyMatch(user -> user.getEmail().equalsIgnoreCase(email));
    }

    /**
     * Get the role for a user with the given email
     * 
     * @param email The user's email address
     * @return Optional containing the user's role, or empty if user not found
     */
    public Optional<String> getUserRole(String email) {
        return users.stream()
                .filter(user -> user.getEmail().equalsIgnoreCase(email))
                .map(AuthorizedUser::getRole)
                .findFirst();
    }

    /**
     * Get the authorized user details for a given email
     * 
     * @param email The user's email address
     * @return Optional containing the authorized user, or empty if not found
     */
    public Optional<AuthorizedUser> getAuthorizedUser(String email) {
        return users.stream()
                .filter(user -> user.getEmail().equalsIgnoreCase(email))
                .findFirst();
    }

    /**
     * Represents an authorized user in the system
     */
    public static class AuthorizedUser {
        private String email;
        private String role;
        private String displayName;
        private String description;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }
}
