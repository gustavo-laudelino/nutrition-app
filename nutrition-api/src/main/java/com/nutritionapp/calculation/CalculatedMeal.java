package com.nutritionapp.calculation;

import java.util.List;
import com.nutritionapp.calculation.DietCalculationResponse.CalculatedFood;

public record CalculatedMeal(String name, List<CalculatedFood> foods, NutritionValues totals) {}
