package com.userjourney.analytics.service;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.auth.UserRecord;
import com.userjourney.analytics.config.AuthorizedUsersConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

/**
 * Service for Firebase Authentication integration
 * Handles Firebase token verification and user authorization checks
 */
@Service
public class FirebaseAuthService {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseAuthService.class);

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private AuthorizedUsersConfig authorizedUsersConfig;

    /**
     * Verify a Firebase ID token and return the decoded token
     * 
     * @param idToken The Firebase ID token to verify
     * @return The decoded Firebase token
     * @throws FirebaseAuthException if token verification fails
     */
    public FirebaseToken verifyIdToken(String idToken) throws FirebaseAuthException {
        try {
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);
            
            // Log successful verification
            auditLogService.logSecurityEvent(
                decodedToken.getUid(), 
                "FIREBASE_TOKEN_VERIFIED", 
                "system", 
                "firebase-auth"
            );
            
            return decodedToken;
        } catch (FirebaseAuthException e) {
            logger.error("Failed to verify Firebase ID token: {}", e.getMessage());
            
            // Log failed verification
            auditLogService.logSecurityEvent(
                "unknown", 
                "FIREBASE_TOKEN_VERIFICATION_FAILED", 
                "system", 
                "firebase-auth"
            );
            
            throw e;
        }
    }

    /**
     * Get user ID from Firebase ID token
     * 
     * @param idToken The Firebase ID token
     * @return The user's unique ID
     * @throws FirebaseAuthException if token verification fails
     */
    public String getUserId(String idToken) throws FirebaseAuthException {
        FirebaseToken decodedToken = verifyIdToken(idToken);
        return decodedToken.getUid();
    }

    /**
     * Get user email from Firebase ID token
     * 
     * @param idToken The Firebase ID token
     * @return The user's email address
     * @throws FirebaseAuthException if token verification fails
     */
    public String getUserEmail(String idToken) throws FirebaseAuthException {
        FirebaseToken decodedToken = verifyIdToken(idToken);
        return decodedToken.getEmail();
    }

    /**
     * Get user claims from Firebase ID token
     * 
     * @param idToken The Firebase ID token
     * @return Map of user claims
     * @throws FirebaseAuthException if token verification fails
     */
    public Map<String, Object> getUserClaims(String idToken) throws FirebaseAuthException {
        FirebaseToken decodedToken = verifyIdToken(idToken);
        return decodedToken.getClaims();
    }

    /**
     * Check if a Firebase ID token is valid
     * 
     * @param idToken The Firebase ID token to validate
     * @return true if token is valid, false otherwise
     */
    public boolean isTokenValid(String idToken) {
        try {
            verifyIdToken(idToken);
            return true;
        } catch (FirebaseAuthException e) {
            return false;
        }
    }

    /**
     * Get user record by email from Firebase
     * 
     * @param email The user's email address
     * @return The Firebase UserRecord
     * @throws FirebaseAuthException if user retrieval fails
     */
    public UserRecord getUserByEmail(String email) throws FirebaseAuthException {
        try {
            UserRecord userRecord = FirebaseAuth.getInstance().getUserByEmail(email);
            logger.debug("Retrieved Firebase user record for email: {}", email);
            return userRecord;
        } catch (FirebaseAuthException e) {
            logger.error("Failed to retrieve user by email {}: {}", email, e.getMessage());
            throw e;
        }
    }

    /**
     * Get the role for a user based on their email
     * Checks against the authorized users configuration
     * 
     * @param email The user's email address
     * @return The user's role, or null if not found
     */
    public String getUserRole(String email) {
        Optional<String> role = authorizedUsersConfig.getUserRole(email);
        if (role.isPresent()) {
            logger.debug("Found role {} for user {}", role.get(), email);
            return role.get();
        } else {
            logger.warn("No role found for user {}", email);
            return null;
        }
    }

    /**
     * Check if a user with the given email is authorized to access the system
     * 
     * @param email The user's email address
     * @return true if the user is authorized, false otherwise
     */
    public boolean isAuthorizedUser(String email) {
        boolean isAuthorized = authorizedUsersConfig.isAuthorizedUser(email);
        
        if (isAuthorized) {
            logger.info("User {} is authorized", email);
            auditLogService.logSecurityEvent(
                email,
                "USER_AUTHORIZATION_CHECK_PASSED",
                "system",
                "firebase-auth"
            );
        } else {
            logger.warn("User {} is not authorized", email);
            auditLogService.logSecurityEvent(
                email,
                "USER_AUTHORIZATION_CHECK_FAILED",
                "system",
                "firebase-auth"
            );
        }
        
        return isAuthorized;
    }

    /**
     * Get the display name for an authorized user
     * 
     * @param email The user's email address
     * @return The user's display name, or null if not found
     */
    public String getUserDisplayName(String email) {
        return authorizedUsersConfig.getAuthorizedUser(email)
                .map(AuthorizedUsersConfig.AuthorizedUser::getDisplayName)
                .orElse(null);
    }
}