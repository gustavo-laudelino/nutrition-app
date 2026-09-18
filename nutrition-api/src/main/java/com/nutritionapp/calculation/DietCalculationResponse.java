package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.List;
import com.nutritionapp.nutrient.NutrientCategory;
import com.nutritionapp.nutrient.NutrientReferences;
import com.nutritionapp.targets.MacroEnergyShares;

/**
 * {@code macroEnergyShares} is the day's macro distribution by energy (4/4/9), null without macros.
 * {@code nutrients} are the day's fiber and micronutrients (option 1 of each meal), compared with the
 * reference of {@code referenceSource}, which is null without a covered profile.
 */
public record DietCalculationResponse(List<CalculatedMeal> meals, Totals totals, MacroEnergyShares macroEnergyShares,
                                      List<DayNutrient> nutrients, ReferenceSource referenceSource) {
    public record CalculatedFood(Long foodId, String name, String source, String sourceCode,
                                 BigDecimal quantityG, NutritionValues nutrients) {}
    public record Balance(BigDecimal target, BigDecimal consumed, BigDecimal remaining) {}
    public record Totals(Balance energyKcal, Balance carbohydrateG, Balance proteinG, Balance fatG) {}
    /** COMPLETE: every portion had data; PARTIAL: {@code foodsWithoutData} foods had none; NO_DATA: consumed is null. */
    public enum TotalStatus { COMPLETE, PARTIAL, NO_DATA }
    public record DayNutrient(String code, String name, String unit, NutrientCategory category, boolean inReport,
                              BigDecimal consumed, TotalStatus status, int foodsWithoutData, NutrientReference reference) {}
    /** Daily reference intake; {@code percent} (consumed ÷ amount × 100) is null without consumption data. */
    public record NutrientReference(BigDecimal amount, NutrientReferences.Type type, BigDecimal percent) {}
    public record ReferenceSource(String name, String profile) {}
}
