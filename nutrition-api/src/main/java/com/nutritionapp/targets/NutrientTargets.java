package com.nutritionapp.targets;

import java.math.BigDecimal;
import jakarta.validation.constraints.*;

/** Null means no target; zero is an explicitly defined target. */
public record NutrientTargets(
        @Positive @Digits(integer = 12, fraction = 2) BigDecimal energyKcal,
        @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal carbohydrateG,
        @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal proteinG,
        @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal fatG) {
    public static NutrientTargets none() { return new NutrientTargets(null, null, null, null); }
}
