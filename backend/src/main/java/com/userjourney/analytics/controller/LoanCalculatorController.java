package com.userjourney.analytics.controller;

import com.userjourney.analytics.model.LoanCalculation;
import com.userjourney.analytics.dto.LoanCalculationRequest;
import com.userjourney.analytics.service.LoanCalculatorService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calculator")
@CrossOrigin(origins = "*", maxAge = 3600)
public class LoanCalculatorController {
    
    private static final Logger logger = LoggerFactory.getLogger(LoanCalculatorController.class);
    
    @Autowired
    private LoanCalculatorService loanCalculatorService;
    
    /**
     * Calculate loan payments
     * POST /api/calculator/loan
     */
    @PostMapping("/loan")
    public ResponseEntity<LoanCalculation> calculateLoan(@Valid @RequestBody LoanCalculationRequest request) {
        try {
            logger.info("Calculating loan: principal={}, rate={}, term={}", 
                       request.getPrincipal(), request.getInterestRate(), request.getTermYears());
            
            LoanCalculation calculation = loanCalculatorService.calculateLoan(request);
            
            return ResponseEntity.ok(calculation);
            
        } catch (IllegalArgumentException e) {
            logger.error("Invalid loan calculation request: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
            
        } catch (Exception e) {
            logger.error("Error calculating loan: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Save loan calculation for a user
     * POST /api/calculator/loan/save
     */
    @PostMapping("/loan/save")
    public ResponseEntity<Map<String, Object>> saveLoanCalculation(
            @RequestParam String userId,
            @Valid @RequestBody LoanCalculation calculation) {
        
        try {
            logger.info("Saving loan calculation for user: {}", userId);
            
            String calculationId = loanCalculatorService.saveLoanCalculation(userId, calculation);
            
            Map<String, Object> response = Map.of(
                "calculationId", calculationId,
                "message", "Calculation saved successfully",
                "timestamp", System.currentTimeMillis()
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error saving loan calculation for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to save calculation: " + e.getMessage()));
        }
    }
    
    /**
     * Get user's calculation history
     * GET /api/calculator/loan/history/{userId}
     */
    @GetMapping("/loan/history/{userId}")
    public ResponseEntity<List<LoanCalculation>> getUserCalculationHistory(
            @PathVariable String userId,
            @RequestParam(defaultValue = "20") int limit) {
        
        try {
            logger.info("Fetching calculation history for user: {} with limit: {}", userId, limit);
            
            List<LoanCalculation> history = loanCalculatorService.getUserCalculationHistory(userId, limit);
            
            return ResponseEntity.ok(history);
            
        } catch (Exception e) {
            logger.error("Error fetching calculation history for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get calculation by ID
     * GET /api/calculator/loan/{calculationId}
     */
    @GetMapping("/loan/{calculationId}")
    public ResponseEntity<LoanCalculation> getCalculationById(@PathVariable String calculationId) {
        try {
            logger.info("Fetching calculation by ID: {}", calculationId);
            
            LoanCalculation calculation = loanCalculatorService.getCalculationById(calculationId);
            
            return ResponseEntity.ok(calculation);
            
        } catch (RuntimeException e) {
            logger.error("Calculation not found: {}", calculationId);
            return ResponseEntity.notFound().build();
            
        } catch (Exception e) {
            logger.error("Error fetching calculation {}: {}", calculationId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Delete calculation
     * DELETE /api/calculator/loan/{calculationId}
     */
    @DeleteMapping("/loan/{calculationId}")
    public ResponseEntity<Map<String, String>> deleteCalculation(
            @PathVariable String calculationId,
            @RequestParam String userId) {
        
        try {
            logger.info("Deleting calculation: {} for user: {}", calculationId, userId);
            
            loanCalculatorService.deleteCalculation(userId, calculationId);
            
            return ResponseEntity.ok(Map.of(
                "message", "Calculation deleted successfully",
                "calculationId", calculationId
            ));
            
        } catch (RuntimeException e) {
            logger.error("Error deleting calculation {}: {}", calculationId, e.getMessage());
            return ResponseEntity.badRequest()
                .body(Map.of("error", e.getMessage()));
                
        } catch (Exception e) {
            logger.error("Error deleting calculation {}: {}", calculationId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to delete calculation"));
        }
    }
    
    /**
     * Calculate loan with amortization schedule
     * POST /api/calculator/loan/amortization
     */
    @PostMapping("/loan/amortization")
    public ResponseEntity<LoanCalculation> calculateLoanWithAmortization(
            @Valid @RequestBody LoanCalculationRequest request) {
        
        try {
            logger.info("Calculating loan with amortization schedule");
            
            // Force include amortization schedule
            request.setIncludeAmortizationSchedule(true);
            
            LoanCalculation calculation = loanCalculatorService.calculateLoan(request);
            
            return ResponseEntity.ok(calculation);
            
        } catch (IllegalArgumentException e) {
            logger.error("Invalid loan calculation request: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
            
        } catch (Exception e) {
            logger.error("Error calculating loan with amortization: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get calculation statistics
     * GET /api/calculator/loan/statistics
     */
    @GetMapping("/loan/statistics")
    public ResponseEntity<Map<String, Object>> getCalculationStatistics() {
        try {
            logger.info("Fetching calculation statistics");
            
            Map<String, Object> statistics = loanCalculatorService.getCalculationStatistics();
            
            return ResponseEntity.ok(statistics);
            
        } catch (Exception e) {
            logger.error("Error fetching calculation statistics: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Validate loan parameters
     * POST /api/calculator/loan/validate
     */
    @PostMapping("/loan/validate")
    public ResponseEntity<Map<String, Object>> validateLoanParameters(
            @Valid @RequestBody LoanCalculationRequest request) {
        
        try {
            logger.info("Validating loan parameters");
            
            // This will throw an exception if validation fails
            loanCalculatorService.calculateLoan(request);
            
            return ResponseEntity.ok(Map.of(
                "valid", true,
                "message", "Loan parameters are valid"
            ));
            
        } catch (IllegalArgumentException e) {
            logger.error("Invalid loan parameters: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "valid", false,
                "error", e.getMessage()
            ));
            
        } catch (Exception e) {
            logger.error("Error validating loan parameters: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "valid", false,
                "error", "Validation failed"
            ));
        }
    }
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "timestamp", String.valueOf(System.currentTimeMillis()),
            "service", "loan-calculator"
        ));
    }
}