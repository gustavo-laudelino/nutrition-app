package com.nutritionapp.targets;

import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.nutritionapp.patient.PatientContext;

public record TargetCalculationRequest(@Valid PatientContext patient,
        @Positive @Digits(integer = 12, fraction = 2) BigDecimal prescribedEnergyKcal,
        @Positive @Digits(integer = 12, fraction = 2) BigDecimal referenceEstimateKcal,
        @Valid MacroChoice macros) {
    public enum MacroMethod { NONE, PERCENTAGE, PER_KG, MANUAL }
    /** Values are percentages, g/kg or grams according to the selected method. */
    public record MacroChoice(@NotNull MacroMethod method,
            @PositiveOrZero @Digits(integer = 7, fraction = 4) BigDecimal carbohydrate,
            @PositiveOrZero @Digits(integer = 7, fraction = 4) BigDecimal protein,
            @PositiveOrZero @Digits(integer = 7, fraction = 4) BigDecimal fat) {}
}
