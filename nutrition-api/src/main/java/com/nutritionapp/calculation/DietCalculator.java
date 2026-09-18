package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import com.nutritionapp.food.FoodCatalog;
import com.nutritionapp.food.FoodResponse;
import com.nutritionapp.nutrient.NutrientReferences;
import com.nutritionapp.targets.MacroEnergyShares;
import com.nutritionapp.targets.NutrientTargets;
import org.springframework.stereotype.Service;
import com.nutritionapp.calculation.CalculatedMeal.CalculatedMealOption;
import static com.nutritionapp.calculation.DietCalculationResponse.*;
import static com.nutritionapp.shared.DecimalPrecision.round;

@Service
public class DietCalculator {
    private final FoodCatalog catalog;
    private final DayNutrientCalculator nutrients;
    public DietCalculator(FoodCatalog catalog, NutrientReferences references) {
        this.catalog = catalog;
        this.nutrients = new DayNutrientCalculator(catalog, references);
    }

    public DietCalculationResponse calculate(DietCalculationRequest request) {
        var targets = request.targets() == null ? NutrientTargets.none() : request.targets();
        var ids = new LinkedHashSet<Long>();
        long portionCount = request.meals().stream().flatMap(meal -> meal.options().stream())
                .mapToLong(option -> option.foods().size()).sum();
        if (portionCount > 500) {
            throw new com.nutritionapp.shared.InvalidCalculationException("meals", "Informe no máximo 500 porções no dia.");
        }
        request.meals().forEach(meal -> meal.options().forEach(
                option -> option.foods().forEach(selection -> ids.add(selection.foodId()))));
        Map<Long, FoodResponse> selectedFoods = catalog.findAllById(ids);
        var meals = new ArrayList<CalculatedMeal>();
        var consumed = NutritionValues.zero();
        var countedPortions = new ArrayList<DietCalculationRequest.FoodPortion>();
        for (var meal : request.meals()) {
            countedPortions.addAll(meal.options().getFirst().foods());
            var options = new ArrayList<CalculatedMealOption>();
            NutritionValues firstOption = null;
            for (var option : meal.options()) {
                var portions = new ArrayList<CalculatedFood>();
                var optionConsumed = NutritionValues.zero();
                for (var selection : option.foods()) {
                    var food = selectedFoods.get(selection.foodId());
                    var nutrients = NutritionValues.portion(food, selection.quantityG());
                    optionConsumed = optionConsumed.add(nutrients);
                    portions.add(new CalculatedFood(food.id(), food.name(), food.source(), food.sourceCode(),
                            selection.quantityG(), nutrients.rounded()));
                }
                if (firstOption == null) firstOption = optionConsumed;
                options.add(new CalculatedMealOption(List.copyOf(portions), optionConsumed.rounded()));
            }
            // Only option 1 counts; keep its exact sum for the day, independently of displayed totals.
            consumed = consumed.add(firstOption);
            meals.add(new CalculatedMeal(meal.name(), firstOption.rounded(), List.copyOf(options)));
        }
        consumed = consumed.rounded();
        var totals = new Totals(balance(targets.energyKcal(), consumed.energyKcal()),
                balance(targets.carbohydrateG(), consumed.carbohydrateG()),
                balance(targets.proteinG(), consumed.proteinG()), balance(targets.fatG(), consumed.fatG()));
        var shares = MacroEnergyShares.of(consumed.carbohydrateG(), consumed.proteinG(), consumed.fatG()).orElse(null);
        return new DietCalculationResponse(List.copyOf(meals), totals, shares,
                nutrients.calculate(countedPortions, request.referenceProfile()), nutrients.source(request.referenceProfile()));
    }

    private Balance balance(BigDecimal target, BigDecimal consumed) {
        return target == null ? new Balance(null, consumed, null)
                : new Balance(round(target), consumed, round(target).subtract(consumed));
    }
}
