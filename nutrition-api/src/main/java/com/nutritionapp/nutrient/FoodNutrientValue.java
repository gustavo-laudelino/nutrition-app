package com.nutritionapp.nutrient;

import java.math.BigDecimal;

/** One nutrient of one food, per 100 g; {@code amount} is null when the value was not analyzed. */
public record FoodNutrientValue(NutrientDefinition nutrient, BigDecimal amount, NutrientStatus status) {}
