package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import com.nutritionapp.calculation.PortionQuantityRequest.Nutrient;
import com.nutritionapp.food.FoodCatalog;
import com.nutritionapp.food.FoodResponse;
import com.nutritionapp.shared.InvalidCalculationException;
import org.springframework.stereotype.Service;

/**
 * Portion weight that delivers a desired amount of one nutrient: amount × 100 ÷ nutrient per 100 g,
 * rounded to 0.1 g (user decision, 17/09). The portion is still kept in grams; the nutrient is only a way to enter it.
 */
@Service
public class PortionQuantityCalculator {
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int QUANTITY_SCALE = 1;
    // Same limit as a diet portion: up to 7 integer digits.
    private static final BigDecimal MAX_QUANTITY_G = new BigDecimal("9999999.9");

    private final FoodCatalog catalog;

    public PortionQuantityCalculator(FoodCatalog catalog) {
        this.catalog = catalog;
    }

    public PortionQuantityResponse calculate(PortionQuantityRequest request) {
        var food = catalog.findById(request.foodId());
        var per100g = per100g(food, request.nutrient());
        if (per100g == null || per100g.signum() <= 0)
            throw new InvalidCalculationException("nutrient", "Este alimento não tem " + label(request.nutrient()) + " para dimensionar a porção.");
        var quantity = request.amount().multiply(HUNDRED).divide(per100g, QUANTITY_SCALE, RoundingMode.HALF_UP);
        if (quantity.signum() <= 0)
            throw new InvalidCalculationException("amount", "Quantidade muito pequena: a porção ficaria com menos de 0,1 g.");
        if (quantity.compareTo(MAX_QUANTITY_G) > 0)
            throw new InvalidCalculationException("amount", "Quantidade grande demais para uma porção.");
        return new PortionQuantityResponse(food.id(), request.nutrient(), request.amount(), quantity);
    }

    private static BigDecimal per100g(FoodResponse food, Nutrient nutrient) {
        return switch (nutrient) {
            case ENERGY -> food.energyKcal();
            case CARBOHYDRATE -> food.carbohydrateG();
            case PROTEIN -> food.proteinG();
            case FAT -> food.fatG();
        };
    }

    private static String label(Nutrient nutrient) {
        return switch (nutrient) {
            case ENERGY -> "energia";
            case CARBOHYDRATE -> "carboidrato";
            case PROTEIN -> "proteína";
            case FAT -> "gordura";
        };
    }
}
