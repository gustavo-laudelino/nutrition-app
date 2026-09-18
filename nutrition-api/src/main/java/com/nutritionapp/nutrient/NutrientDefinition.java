package com.nutritionapp.nutrient;

/** How a nutrient is named, measured and shown; {@code inReport} marks the day's micronutrient report. */
public record NutrientDefinition(String code, String name, String unit, NutrientCategory category,
                                 int displayOrder, boolean inReport) {}
