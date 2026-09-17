package com.nutritionapp.targets;

import java.math.BigDecimal;
import jakarta.validation.constraints.*;

/** Consumed day totals, as returned by the diet calculation, to be turned into targets. */
public record CompositionTargetRequest(
        @NotNull @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal energyKcal,
        @NotNull @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal carbohydrateG,
        @NotNull @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal proteinG,
        @NotNull @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal fatG) {}
