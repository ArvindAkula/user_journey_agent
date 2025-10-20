package com.userjourney.analytics.service;

import com.userjourney.analytics.model.LoanCalculation;
import com.userjourney.analytics.dto.LoanCalculationRequest;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LoanCalculatorService {
    
    private static final Logger logger = LoggerFactory.getLogger(LoanCalculatorService.class);
    
    // In-memory storage for demo purposes - in production, this would use DynamoDB
    private final Map<String, LoanCalculation> calculationStorage = new HashMap<>();
    private final Map<String, List<String>> userCalculationHistory = new HashMap<>();
    
    /**
     * Calculate loan payments and amortization
     */
    public LoanCalculation calculateLoan(LoanCalculationRequest request) {
        logger.info("Calculating loan: principal={}, rate={}, term={}", 
                   request.getPrincipal(), request.getInterestRate(), request.getTermYears());
        
        // Validate input
        validateLoanRequest(request);
        
        // Create calculation object
        LoanCalculation calculation = new LoanCalculation(
            request.getPrincipal(), 
            request.getInterestRate(), 
            request.getTermYears()
        );
        
        calculation.setCalculationId(UUID.randomUUID().toString());
        calculation.setLoanType(request.getLoanType());
        
        // Set metadata
        LoanCalculation.CalculationMetadata metadata = new LoanCalculation.CalculationMetadata();
        metadata.setCalculationMethod(request.getCalculationMethod());
        metadata.setDownPayment(request.getDownPayment());
        metadata.setPropertyTax(request.getPropertyTax());
        metadata.setInsurance(request.getInsurance());
        metadata.setPmi(request.getPmi());
        metadata.setNotes(request.getNotes());
        calculation.setMetadata(metadata);
        
        // Calculate loan amounts
        double loanAmount = request.getPrincipal() - (request.getDownPayment() != null ? request.getDownPayment() : 0.0);
        double monthlyInterestRate = request.getInterestRate() / 100.0 / 12.0;
        int numberOfPayments = (int) Math.round(request.getTermYears() * 12);
        
        // Calculate monthly payment using standard amortization formula
        double monthlyPayment;
        if (monthlyInterestRate == 0) {
            // No interest case
            monthlyPayment = loanAmount / numberOfPayments;
        } else {
            monthlyPayment = loanAmount * 
                (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
                (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
        }
        
        calculation.setMonthlyPayment(monthlyPayment);
        
        // Calculate total amounts
        double totalPayments = monthlyPayment * numberOfPayments;
        double totalInterest = totalPayments - loanAmount;
        
        calculation.setTotalAmount(totalPayments + (request.getDownPayment() != null ? request.getDownPayment() : 0.0));
        calculation.setTotalInterest(totalInterest);
        
        // Generate amortization schedule if requested
        if (request.getIncludeAmortizationSchedule()) {
            List<LoanCalculation.PaymentScheduleItem> schedule = 
                generateAmortizationSchedule(loanAmount, monthlyInterestRate, numberOfPayments, monthlyPayment);
            calculation.setPaymentSchedule(schedule);
        }
        
        logger.info("Loan calculation completed: monthlyPayment={}, totalInterest={}", 
                   monthlyPayment, totalInterest);
        
        return calculation;
    }
    
    /**
     * Save loan calculation for a user
     */
    public String saveLoanCalculation(String userId, LoanCalculation calculation) {
        logger.info("Saving loan calculation for user: {}", userId);
        
        if (calculation.getCalculationId() == null) {
            calculation.setCalculationId(UUID.randomUUID().toString());
        }
        
        calculation.setUserId(userId);
        calculation.setSavedAt(Instant.now());
        
        // Store calculation
        calculationStorage.put(calculation.getCalculationId(), calculation);
        
        // Update user history
        userCalculationHistory.computeIfAbsent(userId, k -> new ArrayList<>())
                            .add(calculation.getCalculationId());
        
        logger.info("Saved calculation: {} for user: {}", calculation.getCalculationId(), userId);
        return calculation.getCalculationId();
    }
    
    /**
     * Get user's calculation history
     */
    public List<LoanCalculation> getUserCalculationHistory(String userId, int limit) {
        logger.info("Fetching calculation history for user: {} with limit: {}", userId, limit);
        
        List<String> calculationIds = userCalculationHistory.getOrDefault(userId, new ArrayList<>());
        
        return calculationIds.stream()
            .map(calculationStorage::get)
            .filter(Objects::nonNull)
            .sorted((c1, c2) -> c2.getCalculatedAt().compareTo(c1.getCalculatedAt())) // Most recent first
            .limit(limit)
            .collect(Collectors.toList());
    }
    
    /**
     * Get calculation by ID
     */
    public LoanCalculation getCalculationById(String calculationId) {
        logger.info("Fetching calculation by ID: {}", calculationId);
        
        LoanCalculation calculation = calculationStorage.get(calculationId);
        if (calculation == null) {
            throw new RuntimeException("Calculation not found with ID: " + calculationId);
        }
        
        return calculation;
    }
    
    /**
     * Delete calculation
     */
    public void deleteCalculation(String userId, String calculationId) {
        logger.info("Deleting calculation: {} for user: {}", calculationId, userId);
        
        LoanCalculation calculation = calculationStorage.get(calculationId);
        if (calculation == null) {
            throw new RuntimeException("Calculation not found with ID: " + calculationId);
        }
        
        if (!userId.equals(calculation.getUserId())) {
            throw new RuntimeException("User not authorized to delete this calculation");
        }
        
        calculationStorage.remove(calculationId);
        
        List<String> userHistory = userCalculationHistory.get(userId);
        if (userHistory != null) {
            userHistory.remove(calculationId);
        }
        
        logger.info("Deleted calculation: {}", calculationId);
    }
    
    /**
     * Get loan calculation statistics for analytics
     */
    public Map<String, Object> getCalculationStatistics() {
        logger.info("Fetching calculation statistics");
        
        List<LoanCalculation> allCalculations = new ArrayList<>(calculationStorage.values());
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCalculations", allCalculations.size());
        stats.put("uniqueUsers", userCalculationHistory.size());
        
        if (!allCalculations.isEmpty()) {
            // Average loan amounts
            double avgPrincipal = allCalculations.stream()
                .mapToDouble(LoanCalculation::getPrincipal)
                .average().orElse(0.0);
            stats.put("averagePrincipal", avgPrincipal);
            
            // Average interest rates
            double avgInterestRate = allCalculations.stream()
                .mapToDouble(LoanCalculation::getInterestRate)
                .average().orElse(0.0);
            stats.put("averageInterestRate", avgInterestRate);
            
            // Average terms
            double avgTerm = allCalculations.stream()
                .mapToDouble(LoanCalculation::getTermYears)
                .average().orElse(0.0);
            stats.put("averageTermYears", avgTerm);
            
            // Loan type distribution
            Map<String, Long> loanTypeDistribution = allCalculations.stream()
                .collect(Collectors.groupingBy(
                    calc -> calc.getLoanType() != null ? calc.getLoanType() : "unknown",
                    Collectors.counting()
                ));
            stats.put("loanTypeDistribution", loanTypeDistribution);
        }
        
        return stats;
    }
    
    /**
     * Generate amortization schedule
     */
    private List<LoanCalculation.PaymentScheduleItem> generateAmortizationSchedule(
            double loanAmount, double monthlyInterestRate, int numberOfPayments, double monthlyPayment) {
        
        logger.info("Generating amortization schedule for {} payments", numberOfPayments);
        
        List<LoanCalculation.PaymentScheduleItem> schedule = new ArrayList<>();
        double remainingBalance = loanAmount;
        LocalDate currentDate = LocalDate.now();
        
        for (int paymentNumber = 1; paymentNumber <= numberOfPayments; paymentNumber++) {
            double interestPayment = remainingBalance * monthlyInterestRate;
            double principalPayment = monthlyPayment - interestPayment;
            
            // Adjust last payment to account for rounding
            if (paymentNumber == numberOfPayments) {
                principalPayment = remainingBalance;
                monthlyPayment = principalPayment + interestPayment;
            }
            
            remainingBalance -= principalPayment;
            
            // Ensure remaining balance doesn't go negative due to rounding
            if (remainingBalance < 0.01) {
                remainingBalance = 0.0;
            }
            
            LoanCalculation.PaymentScheduleItem item = new LoanCalculation.PaymentScheduleItem(
                paymentNumber, principalPayment, interestPayment, remainingBalance
            );
            
            // Set due date (first payment is next month)
            LocalDate dueDate = currentDate.plusMonths(paymentNumber);
            item.setDueDate(dueDate.atStartOfDay(ZoneId.systemDefault()).toInstant());
            
            schedule.add(item);
        }
        
        logger.info("Generated amortization schedule with {} payments", schedule.size());
        return schedule;
    }
    
    /**
     * Validate loan calculation request
     */
    private void validateLoanRequest(LoanCalculationRequest request) {
        if (request.getPrincipal() == null || request.getPrincipal() <= 0) {
            throw new IllegalArgumentException("Principal amount must be greater than 0");
        }
        
        if (request.getInterestRate() == null || request.getInterestRate() < 0) {
            throw new IllegalArgumentException("Interest rate must be non-negative");
        }
        
        if (request.getTermYears() == null || request.getTermYears() <= 0) {
            throw new IllegalArgumentException("Term must be greater than 0");
        }
        
        if (request.getDownPayment() != null && request.getDownPayment() >= request.getPrincipal()) {
            throw new IllegalArgumentException("Down payment cannot be greater than or equal to principal");
        }
        
        // Validate loan type
        if (request.getLoanType() != null) {
            Set<String> validLoanTypes = Set.of("mortgage", "auto", "personal", "student");
            if (!validLoanTypes.contains(request.getLoanType().toLowerCase())) {
                throw new IllegalArgumentException("Invalid loan type. Must be one of: " + validLoanTypes);
            }
        }
        
        // Validate calculation method
        if (request.getCalculationMethod() != null) {
            Set<String> validMethods = Set.of("standard", "interest-only", "balloon");
            if (!validMethods.contains(request.getCalculationMethod().toLowerCase())) {
                throw new IllegalArgumentException("Invalid calculation method. Must be one of: " + validMethods);
            }
        }
    }
}