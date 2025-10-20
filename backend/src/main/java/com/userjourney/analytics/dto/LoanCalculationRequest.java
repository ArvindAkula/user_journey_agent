package com.userjourney.analytics.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;

public class LoanCalculationRequest {
    
    @NotNull(message = "Principal amount is required")
    @DecimalMin(value = "0.01", message = "Principal must be greater than 0")
    @DecimalMax(value = "100000000.0", message = "Principal amount is too large")
    @JsonProperty("principal")
    private Double principal;
    
    @NotNull(message = "Interest rate is required")
    @DecimalMin(value = "0.0", message = "Interest rate must be non-negative")
    @DecimalMax(value = "50.0", message = "Interest rate cannot exceed 50%")
    @JsonProperty("interestRate")
    private Double interestRate; // Annual interest rate as percentage
    
    @NotNull(message = "Term in years is required")
    @DecimalMin(value = "0.1", message = "Term must be greater than 0")
    @DecimalMax(value = "50.0", message = "Term cannot exceed 50 years")
    @JsonProperty("termYears")
    private Double termYears;
    
    @JsonProperty("loanType")
    private String loanType = "personal"; // "mortgage", "auto", "personal", "student"
    
    @JsonProperty("downPayment")
    private Double downPayment = 0.0;
    
    @JsonProperty("propertyTax")
    private Double propertyTax = 0.0;
    
    @JsonProperty("insurance")
    private Double insurance = 0.0;
    
    @JsonProperty("pmi")
    private Double pmi = 0.0;
    
    @JsonProperty("includeAmortizationSchedule")
    private Boolean includeAmortizationSchedule = false;
    
    @JsonProperty("calculationMethod")
    private String calculationMethod = "standard"; // "standard", "interest-only", "balloon"
    
    @JsonProperty("notes")
    private String notes;
    
    // Constructors
    public LoanCalculationRequest() {}
    
    public LoanCalculationRequest(Double principal, Double interestRate, Double termYears) {
        this.principal = principal;
        this.interestRate = interestRate;
        this.termYears = termYears;
        this.loanType = "personal";
        this.downPayment = 0.0;
        this.includeAmortizationSchedule = false;
        this.calculationMethod = "standard";
    }
    
    // Getters and Setters
    public Double getPrincipal() { return principal; }
    public void setPrincipal(Double principal) { this.principal = principal; }
    
    public Double getInterestRate() { return interestRate; }
    public void setInterestRate(Double interestRate) { this.interestRate = interestRate; }
    
    public Double getTermYears() { return termYears; }
    public void setTermYears(Double termYears) { this.termYears = termYears; }
    
    public String getLoanType() { return loanType; }
    public void setLoanType(String loanType) { this.loanType = loanType; }
    
    public Double getDownPayment() { return downPayment; }
    public void setDownPayment(Double downPayment) { this.downPayment = downPayment; }
    
    public Double getPropertyTax() { return propertyTax; }
    public void setPropertyTax(Double propertyTax) { this.propertyTax = propertyTax; }
    
    public Double getInsurance() { return insurance; }
    public void setInsurance(Double insurance) { this.insurance = insurance; }
    
    public Double getPmi() { return pmi; }
    public void setPmi(Double pmi) { this.pmi = pmi; }
    
    public Boolean getIncludeAmortizationSchedule() { return includeAmortizationSchedule; }
    public void setIncludeAmortizationSchedule(Boolean includeAmortizationSchedule) { 
        this.includeAmortizationSchedule = includeAmortizationSchedule; 
    }
    
    public String getCalculationMethod() { return calculationMethod; }
    public void setCalculationMethod(String calculationMethod) { this.calculationMethod = calculationMethod; }
    
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}