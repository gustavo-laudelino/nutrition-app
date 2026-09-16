package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import com.nutritionapp.food.FoodCatalog;
import com.nutritionapp.food.FoodResponse;
import com.nutritionapp.targets.NutrientTargets;
import org.springframework.stereotype.Service;
import static com.nutritionapp.calculation.DietCalculationResponse.*;
import static com.nutritionapp.shared.DecimalPrecision.round;

@Service
public class DietCalculator {
    private final FoodCatalog catalog;
    public DietCalculator(FoodCatalog catalog) { this.catalog = catalog; }

    public DietCalculationResponse calculate(DietCalculationRequest request) {
        var targets = request.targets() == null ? NutrientTargets.none() : request.targets();
        var ids = new LinkedHashSet<Long>();
        request.foods().forEach(selection -> ids.add(selection.foodId()));
        Map<Long, FoodResponse> selectedFoods = catalog.findAllById(ids);
        var portions = new ArrayList<CalculatedFood>();
        var consumed = NutritionValues.zero();
        for (var selection : request.foods()) {
            var food = selectedFoods.get(selection.foodId());
            var nutrients = NutritionValues.portion(food, selection.quantityG());
            consumed = consumed.add(nutrients);
            portions.add(new CalculatedFood(food.id(), food.name(), food.source(), food.sourceCode(),
                    selection.quantityG(), nutrients.rounded()));
        }
        consumed = consumed.rounded();
        var totals = new Totals(balance(targets.energyKcal(), consumed.energyKcal()),
                balance(targets.carbohydrateG(), consumed.carbohydrateG()),
                balance(targets.proteinG(), consumed.proteinG()), balance(targets.fatG(), consumed.fatG()));
        return new DietCalculationResponse(List.copyOf(portions), totals);
    }

    private Balance balance(BigDecimal target, BigDecimal consumed) {
        return target == null ? new Balance(null, consumed, null)
                : new Balance(round(target), consumed, round(target).subtract(consumed));
    }
}
