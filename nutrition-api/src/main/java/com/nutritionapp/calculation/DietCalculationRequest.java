package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.List;
import com.nutritionapp.targets.NutrientTargets;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record DietCalculationRequest(
        @Valid NutrientTargets targets,
        @NotNull @Size(max = 500) List<@NotNull @Valid FoodPortion> foods) {
    public record FoodPortion(@NotNull @Positive Long foodId,
            @NotNull @Positive @Digits(integer = 7, fraction = 3) BigDecimal quantityG) {}
}
