package com.nutritionapp.calculation;

import java.util.List;
import com.nutritionapp.calculation.DietCalculationResponse.CalculatedFood;

/** {@code totals} are the first option's, the one that counts toward the day. */
public record CalculatedMeal(String name, NutritionValues totals, List<CalculatedMealOption> options) {
    public record CalculatedMealOption(List<CalculatedFood> foods, NutritionValues totals) {}
}
