package com.userjourney.analytics.exception;

/**
 * Custom runtime exception for exit risk prediction failures
 */
public class ExitRiskPredictionException extends RuntimeException {
    
    public ExitRiskPredictionException(String message, Throwable cause) {
        super(message, cause);
    }
    
    public ExitRiskPredictionException(String message) {
        super(message);
    }
}