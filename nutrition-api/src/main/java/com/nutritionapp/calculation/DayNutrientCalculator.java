package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import com.nutritionapp.calculation.DietCalculationRequest.FoodPortion;
import com.nutritionapp.calculation.DietCalculationRequest.ReferenceProfile;
import com.nutritionapp.calculation.DietCalculationResponse.DayNutrient;
import com.nutritionapp.calculation.DietCalculationResponse.NutrientReference;
import com.nutritionapp.calculation.DietCalculationResponse.ReferenceSource;
import com.nutritionapp.calculation.DietCalculationResponse.TotalStatus;
import com.nutritionapp.food.FoodCatalog;
import com.nutritionapp.nutrient.FoodNutrientValue;
import com.nutritionapp.nutrient.NutrientReferences;
import static com.nutritionapp.shared.DecimalPrecision.round;

/** Day totals of every catalog nutrient over the counted portions, compared with the profile's references. */
class DayNutrientCalculator {
    private final FoodCatalog catalog;
    private final NutrientReferences references;

    DayNutrientCalculator(FoodCatalog catalog, NutrientReferences references) {
        this.catalog = catalog;
        this.references = references;
    }

    /** Null without a profile the references cover (both sexes, adults 19+). */
    ReferenceSource source(ReferenceProfile profile) {
        if (profile == null || !NutrientReferences.covers(profile.sex(), profile.age())) return null;
        return new ReferenceSource(NutrientReferences.SOURCE_NAME, NutrientReferences.describe(profile.sex(), profile.age()));
    }

    /**
     * Sums value per 100 g × quantity ÷ 100 over the portions, rounding only the total. Trace and not applicable
     * count as 0; a portion whose food has no value (not analyzed or no record) makes the total partial.
     */
    List<DayNutrient> calculate(List<FoodPortion> portions, ReferenceProfile profile) {
        if (portions.isEmpty()) return List.of();
        var foodIds = new LinkedHashSet<Long>();
        portions.forEach(portion -> foodIds.add(portion.foodId()));
        Map<Long, Map<String, FoodNutrientValue>> values = new HashMap<>();
        catalog.nutrientsOf(foodIds).forEach((foodId, list) -> {
            var byCode = new HashMap<String, FoodNutrientValue>();
            list.forEach(value -> byCode.put(value.nutrient().code(), value));
            values.put(foodId, byCode);
        });
        var covered = source(profile) != null;
        var result = new ArrayList<DayNutrient>();
        for (var nutrient : catalog.nutrientDefinitions()) {
            var sum = BigDecimal.ZERO;
            int portionsWithData = 0;
            var foodsWithoutData = new LinkedHashSet<Long>();
            for (var portion : portions) {
                var value = values.getOrDefault(portion.foodId(), Map.of()).get(nutrient.code());
                if (value == null || !value.status().hasData()) {
                    foodsWithoutData.add(portion.foodId());
                    continue;
                }
                portionsWithData++;
                if (value.amount() != null) sum = sum.add(value.amount().multiply(portion.quantityG()).movePointLeft(2));
            }
            var status = portionsWithData == 0 ? TotalStatus.NO_DATA
                    : foodsWithoutData.isEmpty() ? TotalStatus.COMPLETE : TotalStatus.PARTIAL;
            var consumed = status == TotalStatus.NO_DATA ? null : round(sum);
            var reference = covered ? references.find(nutrient.code(), profile.sex(), profile.age())
                    .map(found -> new NutrientReference(found.amount(), found.type(), consumed == null ? null
                            : consumed.multiply(BigDecimal.valueOf(100)).divide(found.amount(), 1, RoundingMode.HALF_UP)))
                    .orElse(null) : null;
            result.add(new DayNutrient(nutrient.code(), nutrient.name(), nutrient.unit(), nutrient.category(),
                    nutrient.inReport(), consumed, status, foodsWithoutData.size(), reference));
        }
        return List.copyOf(result);
    }
}
