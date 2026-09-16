package com.nutritionapp.calculation;

import java.math.BigDecimal;
import static com.nutritionapp.shared.DecimalPrecision.round;
import com.nutritionapp.food.FoodResponse;

public record NutritionValues(BigDecimal energyKcal, BigDecimal carbohydrateG,
                              BigDecimal proteinG, BigDecimal fatG) {
    static NutritionValues zero() {
        return new NutritionValues(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    static NutritionValues portion(FoodResponse food, BigDecimal quantityG) {
        BigDecimal factor = quantityG.movePointLeft(2);
        return new NutritionValues(food.energyKcal().multiply(factor),
                food.carbohydrateG().multiply(factor), food.proteinG().multiply(factor),
                food.fatG().multiply(factor));
    }

    NutritionValues add(NutritionValues other) {
        return new NutritionValues(energyKcal.add(other.energyKcal),
                carbohydrateG.add(other.carbohydrateG), proteinG.add(other.proteinG),
                fatG.add(other.fatG));
    }

    NutritionValues rounded() {
        return new NutritionValues(round(energyKcal), round(carbohydrateG), round(proteinG), round(fatG));
    }

}
