package com.nutritionapp.energy;

import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.nutritionapp.patient.PatientContext;

public record EnergyEstimateRequest(
        @NotNull @Valid PatientContext patient,
        @NotNull Method method,
        @DecimalMin("1.40") @DecimalMax("2.40") @Digits(integer = 1, fraction = 2) BigDecimal faoPal) {
    public enum Method { DRI_2023, FAO }
}
