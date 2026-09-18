package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.List;
import com.nutritionapp.food.DevelopmentFoodCatalog;
import com.nutritionapp.food.FoodNotFoundException;
import com.nutritionapp.targets.NutrientTargets;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class DietCalculatorTest {
    private final DietCalculator calculator = new DietCalculator(new DevelopmentFoodCatalog());
    @Test void allowsDietWithoutAnyTargetsOrPatient() {
        var result = calculator.calculate(singleMeal(null, List.of(portion(1, "150"))));
        assertThat(result.totals().energyKcal().target()).isNull();
        assertThat(result.totals().energyKcal().remaining()).isNull();
        assertThat(result.totals().proteinG().remaining()).isNull();
        assertThat(result.totals().carbohydrateG().remaining()).isNull();
        assertThat(result.totals().fatG().remaining()).isNull();
        var n = result.meals().getFirst().foods().getFirst().nutrients();
        assertThat(n.energyKcal()).isEqualByComparingTo("195");
        assertThat(n.carbohydrateG()).isEqualByComparingTo("42");
        assertThat(n.proteinG()).isEqualByComparingTo("4.5");
        assertThat(n.fatG()).isEqualByComparingTo("1.5");
    }
    @Test void sumsMultipleFoodsAndComparesOnlyDefinedTargets() {
        var targets = new NutrientTargets(d("2000"), null, d("150"), d("70"));
        var result = calculator.calculate(singleMeal(targets, List.of(portion(1,"150"), portion(2,"100"))));
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("360");
        assertThat(result.totals().energyKcal().remaining()).isEqualByComparingTo("1640");
        assertThat(result.totals().proteinG().remaining()).isEqualByComparingTo("114.5");
        assertThat(result.totals().fatG().remaining()).isEqualByComparingTo("64.5");
        assertThat(result.totals().carbohydrateG().remaining()).isNull();
    }
    @Test void preservesNegativeBalancesAndExplicitZeroTargets() {
        var targets = new NutrientTargets(d("2000"), d("0"), null, d("70"));
        var result = calculator.calculate(singleMeal(targets, List.of(portion(3,"300"), portion(1,"100"))));
        assertThat(result.totals().energyKcal().remaining()).isEqualByComparingTo("-830");
        assertThat(result.totals().fatG().remaining()).isEqualByComparingTo("-231");
        assertThat(result.totals().carbohydrateG().target()).isEqualByComparingTo("0");
        assertThat(result.totals().carbohydrateG().remaining()).isEqualByComparingTo("-28");
    }
    @Test void sumsBeforeRoundingAndCountsRepeatedFoods() {
        var result = calculator.calculate(singleMeal(null, List.of(portion(1,"0.01"), portion(1,"0.01"))));
        assertThat(result.meals().getFirst().foods()).hasSize(2);
        assertThat(result.meals().getFirst().foods().getFirst().nutrients().energyKcal()).isEqualByComparingTo("0.01");
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("0.03");
        assertThat(result.totals().carbohydrateG().consumed()).isEqualByComparingTo("0.01");
    }
    @Test void emptyDietHasZeroConsumption() {
        var result = calculator.calculate(singleMeal(null,List.of()));
        assertThat(result.meals().getFirst().foods()).isEmpty();
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("0");
    }
    @Test void missingFoodIsRejected() {
        assertThatThrownBy(() -> calculator.calculate(singleMeal(null,List.of(portion(999,"100")))))
                .isInstanceOf(FoodNotFoundException.class);
    }
    @Test void keepsMealOrderAndDailyTargetsWithRepeatedFoods() {
        var result = calculator.calculate(new DietCalculationRequest(new NutrientTargets(d("1000"),null,null,null), List.of(
                new MealRequest("  Almoço  ",List.of(portion(1,"100"),portion(1,"50"))),
                new MealRequest("Almoço",List.of(portion(1,"100"),portion(2,"100"))),
                new MealRequest("Ceia",List.of()))));
        assertThat(result.meals()).extracting(CalculatedMeal::name).containsExactly("Almoço","Almoço","Ceia");
        assertThat(result.meals().get(0).totals().energyKcal()).isEqualByComparingTo("195");
        assertThat(result.meals().get(1).totals().energyKcal()).isEqualByComparingTo("295");
        assertThat(result.meals().get(2).totals().energyKcal()).isEqualByComparingTo("0");
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("490");
        assertThat(result.totals().energyKcal().remaining()).isEqualByComparingTo("510");
        assertThat(result.totals().carbohydrateG().consumed()).isEqualByComparingTo("70");
        assertThat(result.totals().proteinG().consumed()).isEqualByComparingTo("38.5");
        assertThat(result.totals().fatG().consumed()).isEqualByComparingTo("6.5");
    }
    @Test void dailyTotalDoesNotSumRoundedMealTotals() {
        var result = calculator.calculate(new DietCalculationRequest(null,List.of(
                new MealRequest("A",List.of(portion(1,"0.01"))),
                new MealRequest("B",List.of(portion(1,"0.01"))))));
        assertThat(result.meals()).allSatisfy(meal -> assertThat(meal.totals().energyKcal()).isEqualByComparingTo("0.01"));
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("0.03");
    }
    @Test void emptyDayHasNoMealsAndZeroTotals() {
        var result = calculator.calculate(new DietCalculationRequest(null,List.of()));
        assertThat(result.meals()).isEmpty();
        assertThat(result.totals().energyKcal().consumed()).isZero();
        assertThat(result.macroEnergyShares()).isNull();
    }
    @Test void macroEnergySharesUseFourFourNineAndSumExactly100() {
        // 42 g C × 4 = 168, 35.5 g P × 4 = 142, 5.5 g G × 9 = 49.5 → 359.5 kcal of macros.
        var shares = calculator.calculate(singleMeal(null, List.of(portion(1,"150"), portion(2,"100")))).macroEnergyShares();
        assertThat(shares.carbohydratePercent()).isEqualByComparingTo("46.7316");
        assertThat(shares.proteinPercent()).isEqualByComparingTo("39.4993");
        assertThat(shares.fatPercent()).isEqualByComparingTo("13.7691");
        assertThat(shares.carbohydratePercent().add(shares.proteinPercent()).add(shares.fatPercent())).isEqualByComparingTo("100");
    }
    @Test void onlyFatStillHasShares() {
        var shares = calculator.calculate(singleMeal(null, List.of(portion(3,"10")))).macroEnergyShares();
        assertThat(shares.fatPercent()).isEqualByComparingTo("100");
        assertThat(shares.carbohydratePercent()).isZero();
    }
    @Test void loadsAllFoodsOnlyOnceAcrossMeals() {
        var catalog = org.mockito.Mockito.spy(new DevelopmentFoodCatalog());
        new DietCalculator(catalog).calculate(new DietCalculationRequest(null,List.of(
                new MealRequest("A",List.of(portion(1,"100"),portion(1,"50"))),
                new MealRequest("B",List.of(portion(2,"100"),portion(1,"80"))))));
        org.mockito.Mockito.verify(catalog).findAllById(new java.util.LinkedHashSet<>(List.of(1L,2L)));
    }
    private static DietCalculationRequest singleMeal(NutrientTargets targets, List<DietCalculationRequest.FoodPortion> foods) {
        return new DietCalculationRequest(targets,List.of(new MealRequest("Almoço",foods)));
    }
    private static DietCalculationRequest.FoodPortion portion(long id,String grams) {
        return new DietCalculationRequest.FoodPortion(id,d(grams));
    }
    private static BigDecimal d(String value) { return new BigDecimal(value); }
}
