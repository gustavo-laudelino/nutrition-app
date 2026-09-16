package com.nutritionapp.energy;

import java.math.BigDecimal;

/** An estimate is never a prescribed target. Basal energy is present only for FAO. */
public record EnergyEstimateResponse(EnergyEstimateRequest.Method method, BigDecimal estimatedKcal,
        BigDecimal basalKcal, com.nutritionapp.patient.PatientContext.DriActivity driActivity,
        BigDecimal faoPal, FaoActivity faoActivity) {
    public enum FaoActivity { SEDENTARY_LIGHT, ACTIVE_MODERATE, VIGOROUS }
}
