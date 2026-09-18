package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.List;
import com.nutritionapp.targets.MacroEnergyShares;

/** {@code macroEnergyShares} is the day's macro distribution by energy (4/4/9), null without macros. */
public record DietCalculationResponse(List<CalculatedMeal> meals, Totals totals, MacroEnergyShares macroEnergyShares) {
    public record CalculatedFood(Long foodId, String name, String source, String sourceCode,
                                 BigDecimal quantityG, NutritionValues nutrients) {}
    public record Balance(BigDecimal target, BigDecimal consumed, BigDecimal remaining) {}
    public record Totals(Balance energyKcal, Balance carbohydrateG, Balance proteinG, Balance fatG) {}
}
