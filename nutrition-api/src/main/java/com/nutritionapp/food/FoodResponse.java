package com.nutritionapp.food;

import java.math.BigDecimal;

/** All nutritional values refer to 100 grams of food. */
public record FoodResponse(
        Long id, String name, BigDecimal energyKcal,
        BigDecimal proteinG, BigDecimal carbohydrateG, BigDecimal fatG,
        String source, String sourceCode) {

    static FoodResponse from(Food food) {
        return new FoodResponse(food.getId(), food.getName(),
                food.getEnergyKcal(), food.getProteinG(), food.getCarbohydrateG(),
                food.getFatG(), food.getSource(), food.getSourceCode());
    }
}
