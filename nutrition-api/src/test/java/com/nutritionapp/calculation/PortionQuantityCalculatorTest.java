package com.nutritionapp.calculation;

import java.math.BigDecimal;
import com.nutritionapp.calculation.PortionQuantityRequest.Nutrient;
import com.nutritionapp.food.DevelopmentFoodCatalog;
import com.nutritionapp.food.FoodNotFoundException;
import com.nutritionapp.shared.InvalidCalculationException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Synthetic catalog per 100 g — A: 130 kcal, 28 C, 3 P, 1 G · B: 165 kcal, 0 C, 31 P, 4 G · C: 900 kcal, 0 C, 0 P, 100 G.
class PortionQuantityCalculatorTest {
    private final PortionQuantityCalculator calculator = new PortionQuantityCalculator(new DevelopmentFoodCatalog());

    @ParameterizedTest
    @CsvSource({
            "1, CARBOHYDRATE, 40, 142.9",   // 40 × 100 / 28 = 142.857 → 0.1 g
            "1, ENERGY, 150, 115.4",        // 150 × 100 / 130 = 115.38
            "2, PROTEIN, 25, 80.6",         // 25 × 100 / 31 = 80.645
            "3, FAT, 10, 10.0",
            "1, FAT, 0.5, 50.0"})
    void weightDeliversTheRequestedNutrientRoundedToTenthOfGram(long foodId, Nutrient nutrient, String amount, String expected) {
        var response = calculator.calculate(new PortionQuantityRequest(foodId, nutrient, new BigDecimal(amount)));
        assertThat(response.quantityG()).isEqualByComparingTo(expected);
        assertThat(response.quantityG().scale()).isEqualTo(1);
        assertThat(response.foodId()).isEqualTo(foodId);
        assertThat(response.nutrient()).isEqualTo(nutrient);
    }

    @Test
    void foodWithoutTheNutrientCannotBeSizedByIt() {
        assertThatThrownBy(() -> calculator.calculate(new PortionQuantityRequest(2L, Nutrient.CARBOHYDRATE, new BigDecimal("10"))))
                .isInstanceOf(InvalidCalculationException.class)
                .hasMessage("Este alimento não tem carboidrato para dimensionar a porção.")
                .extracting(error -> ((InvalidCalculationException) error).field()).isEqualTo("nutrient");
    }

    @Test
    void weightMustStayWithinPortionLimits() {
        assertThatThrownBy(() -> calculator.calculate(new PortionQuantityRequest(3L, Nutrient.FAT, new BigDecimal("0.01"))))
                .isInstanceOf(InvalidCalculationException.class)
                .extracting(error -> ((InvalidCalculationException) error).field()).isEqualTo("amount");
        assertThatThrownBy(() -> calculator.calculate(new PortionQuantityRequest(1L, Nutrient.PROTEIN, new BigDecimal("9999999"))))
                .isInstanceOf(InvalidCalculationException.class)
                .hasMessage("Quantidade grande demais para uma porção.");
    }

    @Test
    void missingFoodIsNotFound() {
        assertThatThrownBy(() -> calculator.calculate(new PortionQuantityRequest(999L, Nutrient.ENERGY, BigDecimal.TEN)))
                .isInstanceOf(FoodNotFoundException.class);
    }
}
