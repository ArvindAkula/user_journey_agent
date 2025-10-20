package com.userjourney.analytics.service;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.userjourney.analytics.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class FirebaseAuthService {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseAuthService.class);

    @Autowired
    private AuditLogService auditLogService;

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

    public String getUserId(String idToken) throws FirebaseAuthException {
        FirebaseToken decodedToken = verifyIdToken(idToken);
        return decodedToken.getUid();
    }

    public String getUserEmail(String idToken) throws FirebaseAuthException {
        FirebaseToken decodedToken = verifyIdToken(idToken);
        return decodedToken.getEmail();
    }

    public Map<String, Object> getUserClaims(String idToken) throws FirebaseAuthException {
        FirebaseToken decodedToken = verifyIdToken(idToken);
        return decodedToken.getClaims();
    }

    public boolean isTokenValid(String idToken) {
        try {
            verifyIdToken(idToken);
            return true;
        } catch (FirebaseAuthException e) {
            return false;
        }
    }
}