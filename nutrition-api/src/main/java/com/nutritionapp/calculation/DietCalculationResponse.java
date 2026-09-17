package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.List;

public record DietCalculationResponse(List<CalculatedMeal> meals, Totals totals) {
    public record CalculatedFood(Long foodId, String name, String source, String sourceCode,
                                 BigDecimal quantityG, NutritionValues nutrients) {}
    public record Balance(BigDecimal target, BigDecimal consumed, BigDecimal remaining) {}
    public record Totals(Balance energyKcal, Balance carbohydrateG, Balance proteinG, Balance fatG) {}
}
