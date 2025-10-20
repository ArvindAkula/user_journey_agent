package com.userjourney.analytics.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import java.time.Instant;
import java.util.List;

public class LoanCalculation {
    
    @JsonProperty("calculationId")
    private String calculationId;
    
    @JsonProperty("userId")
    private String userId;
    
    @NotNull(message = "Principal amount is required")
    @DecimalMin(value = "0.01", message = "Principal must be greater than 0")
    @JsonProperty("principal")
    private Double principal;
    
    @NotNull(message = "Interest rate is required")
    @DecimalMin(value = "0.0", message = "Interest rate must be non-negative")
    @JsonProperty("interestRate")
    private Double interestRate; // Annual interest rate as percentage
    
    @NotNull(message = "Term in years is required")
    @DecimalMin(value = "0.1", message = "Term must be greater than 0")
    @JsonProperty("termYears")
    private Double termYears;
    
    @JsonProperty("monthlyPayment")
    private Double monthlyPayment;
    
    @JsonProperty("totalInterest")
    private Double totalInterest;
    
    @JsonProperty("totalAmount")
    private Double totalAmount;
    
    @JsonProperty("paymentSchedule")
    private List<PaymentScheduleItem> paymentSchedule;
    
    @JsonProperty("calculatedAt")
    private Instant calculatedAt;
    
    @JsonProperty("savedAt")
    private Instant savedAt;
    
    @JsonProperty("loanType")
    private String loanType; // "mortgage", "auto", "personal", "student"
    
    @JsonProperty("metadata")
    private CalculationMetadata metadata;
    
    // Constructors
    public LoanCalculation() {}
    
    public LoanCalculation(Double principal, Double interestRate, Double termYears) {
        this.principal = principal;
        this.interestRate = interestRate;
        this.termYears = termYears;
        this.calculatedAt = Instant.now();
    }
    
    // Getters and Setters
    public String getCalculationId() { return calculationId; }
    public void setCalculationId(String calculationId) { this.calculationId = calculationId; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public Double getPrincipal() { return principal; }
    public void setPrincipal(Double principal) { this.principal = principal; }
    
    public Double getInterestRate() { return interestRate; }
    public void setInterestRate(Double interestRate) { this.interestRate = interestRate; }
    
    public Double getTermYears() { return termYears; }
    public void setTermYears(Double termYears) { this.termYears = termYears; }
    
    public Double getMonthlyPayment() { return monthlyPayment; }
    public void setMonthlyPayment(Double monthlyPayment) { this.monthlyPayment = monthlyPayment; }
    
    public Double getTotalInterest() { return totalInterest; }
    public void setTotalInterest(Double totalInterest) { this.totalInterest = totalInterest; }
    
    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }
    
    public List<PaymentScheduleItem> getPaymentSchedule() { return paymentSchedule; }
    public void setPaymentSchedule(List<PaymentScheduleItem> paymentSchedule) { this.paymentSchedule = paymentSchedule; }
    
    public Instant getCalculatedAt() { return calculatedAt; }
    public void setCalculatedAt(Instant calculatedAt) { this.calculatedAt = calculatedAt; }
    
    public Instant getSavedAt() { return savedAt; }
    public void setSavedAt(Instant savedAt) { this.savedAt = savedAt; }
    
    public String getLoanType() { return loanType; }
    public void setLoanType(String loanType) { this.loanType = loanType; }
    
    public CalculationMetadata getMetadata() { return metadata; }
    public void setMetadata(CalculationMetadata metadata) { this.metadata = metadata; }
    
    // Inner classes
    public static class PaymentScheduleItem {
        private Integer paymentNumber;
        private Double principalPayment;
        private Double interestPayment;
        private Double totalPayment;
        private Double remainingBalance;
        private Instant dueDate;
        
        public PaymentScheduleItem() {}
        
        public PaymentScheduleItem(Integer paymentNumber, Double principalPayment, 
                                 Double interestPayment, Double remainingBalance) {
            this.paymentNumber = paymentNumber;
            this.principalPayment = principalPayment;
            this.interestPayment = interestPayment;
            this.totalPayment = principalPayment + interestPayment;
            this.remainingBalance = remainingBalance;
        }
        
        public Integer getPaymentNumber() { return paymentNumber; }
        public void setPaymentNumber(Integer paymentNumber) { this.paymentNumber = paymentNumber; }
        
        public Double getPrincipalPayment() { return principalPayment; }
        public void setPrincipalPayment(Double principalPayment) { this.principalPayment = principalPayment; }
        
        public Double getInterestPayment() { return interestPayment; }
        public void setInterestPayment(Double interestPayment) { this.interestPayment = interestPayment; }
        
        public Double getTotalPayment() { return totalPayment; }
        public void setTotalPayment(Double totalPayment) { this.totalPayment = totalPayment; }
        
        public Double getRemainingBalance() { return remainingBalance; }
        public void setRemainingBalance(Double remainingBalance) { this.remainingBalance = remainingBalance; }
        
        public Instant getDueDate() { return dueDate; }
        public void setDueDate(Instant dueDate) { this.dueDate = dueDate; }
    }
    
    public static class CalculationMetadata {
        private String calculationMethod; // "standard", "interest-only", "balloon"
        private Double downPayment;
        private Double propertyTax;
        private Double insurance;
        private Double pmi; // Private Mortgage Insurance
        private String notes;
        
        public CalculationMetadata() {}
        
        public String getCalculationMethod() { return calculationMethod; }
        public void setCalculationMethod(String calculationMethod) { this.calculationMethod = calculationMethod; }
        
        public Double getDownPayment() { return downPayment; }
        public void setDownPayment(Double downPayment) { this.downPayment = downPayment; }
        
        public Double getPropertyTax() { return propertyTax; }
        public void setPropertyTax(Double propertyTax) { this.propertyTax = propertyTax; }
        
        public Double getInsurance() { return insurance; }
        public void setInsurance(Double insurance) { this.insurance = insurance; }
        
        public Double getPmi() { return pmi; }
        public void setPmi(Double pmi) { this.pmi = pmi; }
        
        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
    }
}