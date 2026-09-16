package com.nutritionapp.targets;

import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record TargetCalculationRequest(
        @Positive @Digits(integer = 12, fraction = 2) BigDecimal prescribedEnergyKcal,
        @Positive @Digits(integer = 12, fraction = 2) BigDecimal referenceEstimateKcal,
        @Valid MacroChoice macros) {
    public enum MacroMethod { NONE, PERCENTAGE }
    /** Values are percentages of the prescribed energy. */
    public record MacroChoice(@NotNull MacroMethod method,
            @PositiveOrZero @Digits(integer = 7, fraction = 4) BigDecimal carbohydrate,
            @PositiveOrZero @Digits(integer = 7, fraction = 4) BigDecimal protein,
            @PositiveOrZero @Digits(integer = 7, fraction = 4) BigDecimal fat) {}
}
