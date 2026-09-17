package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.List;
import com.nutritionapp.targets.NutrientTargets;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record DietCalculationRequest(
        @Valid NutrientTargets targets,
        @NotNull @Size(max = 20, message = "Informe no máximo 20 refeições.") List<@NotNull @Valid MealRequest> meals) {
    public record FoodPortion(@NotNull @Positive Long foodId,
            @NotNull @Positive @Digits(integer = 7, fraction = 3) BigDecimal quantityG) {}
}
