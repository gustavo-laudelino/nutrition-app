package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.List;
import com.nutritionapp.food.DevelopmentFoodCatalog;
import com.nutritionapp.food.FoodNotFoundException;
import com.nutritionapp.nutrient.NutrientReferences;
import com.nutritionapp.targets.NutrientTargets;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class DietCalculatorTest {
    private final DietCalculator calculator = new DietCalculator(new DevelopmentFoodCatalog(), new NutrientReferences());
    @Test void allowsDietWithoutAnyTargetsOrPatient() {
        var result = calculator.calculate(singleMeal(null, List.of(portion(1, "150"))));
        assertThat(result.totals().energyKcal().target()).isNull();
        assertThat(result.totals().energyKcal().remaining()).isNull();
        assertThat(result.totals().proteinG().remaining()).isNull();
        assertThat(result.totals().carbohydrateG().remaining()).isNull();
        assertThat(result.totals().fatG().remaining()).isNull();
        var n = result.meals().getFirst().options().getFirst().foods().getFirst().nutrients();
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
        assertThat(result.meals().getFirst().options().getFirst().foods()).hasSize(2);
        assertThat(result.meals().getFirst().options().getFirst().foods().getFirst().nutrients().energyKcal()).isEqualByComparingTo("0.01");
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("0.03");
        assertThat(result.totals().carbohydrateG().consumed()).isEqualByComparingTo("0.01");
    }
    @Test void emptyDietHasZeroConsumption() {
        var result = calculator.calculate(singleMeal(null,List.of()));
        assertThat(result.meals().getFirst().options().getFirst().foods()).isEmpty();
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("0");
    }
    @Test void missingFoodIsRejected() {
        assertThatThrownBy(() -> calculator.calculate(singleMeal(null,List.of(portion(999,"100")))))
                .isInstanceOf(FoodNotFoundException.class);
    }
    @Test void keepsMealOrderAndDailyTargetsWithRepeatedFoods() {
        var result = calculator.calculate(new DietCalculationRequest(new NutrientTargets(d("1000"),null,null,null), List.of(
                meal("  Almoço  ",List.of(portion(1,"100"),portion(1,"50"))),
                meal("Almoço",List.of(portion(1,"100"),portion(2,"100"))),
                meal("Ceia",List.of()))));
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
                meal("A",List.of(portion(1,"0.01"))),
                meal("B",List.of(portion(1,"0.01"))))));
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
        new DietCalculator(catalog, new NutrientReferences()).calculate(new DietCalculationRequest(null,List.of(
                meal("A",List.of(portion(1,"100"),portion(1,"50"))),
                meal("B",List.of(portion(2,"100"),portion(1,"80"))))));
        org.mockito.Mockito.verify(catalog).findAllById(new java.util.LinkedHashSet<>(List.of(1L,2L)));
    }
    @Test void onlyTheFirstOptionCountsForTheDay() {
        var targets = new NutrientTargets(d("2000"), null, null, null);
        var result = calculator.calculate(new DietCalculationRequest(targets, List.of(new MealRequest("Almoço", List.of(
                option(portion(1,"150")), option(portion(2,"100"), portion(3,"50")), option())))));
        var meal = result.meals().getFirst();
        assertThat(meal.options()).hasSize(3);
        assertThat(meal.options().get(0).totals().energyKcal()).isEqualByComparingTo("195");
        assertThat(meal.options().get(1).totals().energyKcal()).isEqualByComparingTo("615");
        assertThat(meal.options().get(1).foods()).extracting(DietCalculationResponse.CalculatedFood::foodId).containsExactly(2L, 3L);
        assertThat(meal.options().get(2).foods()).isEmpty();
        assertThat(meal.options().get(2).totals().energyKcal()).isZero();
        assertThat(meal.totals()).isEqualTo(meal.options().getFirst().totals());
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("195");
        assertThat(result.totals().energyKcal().remaining()).isEqualByComparingTo("1805");
        assertThat(result.totals().fatG().consumed()).isEqualByComparingTo("1.5");
        assertThat(result.macroEnergyShares().fatPercent())
                .isEqualByComparingTo(calculator.calculate(singleMeal(null, List.of(portion(1,"150")))).macroEnergyShares().fatPercent());
    }
    @Test void otherOptionsDoNotChangeTheDay() {
        var alone = calculator.calculate(singleMeal(null, List.of(portion(1,"100"))));
        var withOptions = calculator.calculate(new DietCalculationRequest(null, List.of(new MealRequest("A", List.of(
                option(portion(1,"100")), option(portion(3,"300")))))));
        assertThat(withOptions.totals()).isEqualTo(alone.totals());
        assertThat(withOptions.macroEnergyShares()).isEqualTo(alone.macroEnergyShares());
    }
    @Test void portionLimitCountsEveryOption() {
        var many = java.util.Collections.nCopies(250, portion(1,"1"));
        var ok = calculator.calculate(new DietCalculationRequest(null, List.of(new MealRequest("A", List.of(
                option(many.toArray(DietCalculationRequest.FoodPortion[]::new)), option(many.toArray(DietCalculationRequest.FoodPortion[]::new)))))));
        assertThat(ok.totals().energyKcal().consumed()).isEqualByComparingTo("325");
        assertThatThrownBy(() -> calculator.calculate(new DietCalculationRequest(null, List.of(new MealRequest("A", List.of(
                option(many.toArray(DietCalculationRequest.FoodPortion[]::new)), option(many.toArray(DietCalculationRequest.FoodPortion[]::new)),
                option(portion(1,"1"))))))))
                .isInstanceOf(com.nutritionapp.shared.InvalidCalculationException.class);
    }
    @Test void missingFoodInAnotherOptionIsRejected() {
        assertThatThrownBy(() -> calculator.calculate(new DietCalculationRequest(null, List.of(new MealRequest("A", List.of(
                option(portion(1,"100")), option(portion(999,"100"))))))))
                .isInstanceOf(FoodNotFoundException.class);
    }
    @Test void loadsFoodsOfEveryOptionOnlyOnce() {
        var catalog = org.mockito.Mockito.spy(new DevelopmentFoodCatalog());
        new DietCalculator(catalog, new NutrientReferences()).calculate(new DietCalculationRequest(null,List.of(
                new MealRequest("A",List.of(option(portion(1,"100")), option(portion(2,"100"), portion(1,"80")))),
                meal("B",List.of(portion(3,"10"))))));
        org.mockito.Mockito.verify(catalog).findAllById(new java.util.LinkedHashSet<>(List.of(1L,2L,3L)));
    }
    // Nutrients (synthetic catalog): food 1 fiber 2.7, calcium 5, iron trace, vitamin C not analyzed, cholesterol NA;
    // food 2 fiber NA, calcium 10, iron 1.2, vitamin C trace, cholesterol 80; food 3 has no records.
    private static DietCalculationResponse.DayNutrient nutrient(DietCalculationResponse result, String code) {
        return result.nutrients().stream().filter(item -> item.code().equals(code)).findFirst().orElseThrow();
    }
    private static final DietCalculationRequest.ReferenceProfile WOMAN_30 =
            new DietCalculationRequest.ReferenceProfile(com.nutritionapp.patient.PatientContext.Sex.FEMALE, 30);
    @Test void sumsNutrientsWithTraceAndNotApplicableAsZeroAndFlagsFoodsWithoutData() {
        var result = calculator.calculate(singleMeal(null, List.of(portion(1,"150"), portion(2,"100"), portion(3,"10"))));
        assertThat(result.nutrients()).extracting(DietCalculationResponse.DayNutrient::code)
                .containsExactly("FIBER", "CALCIUM", "IRON", "VITAMIN_C", "CHOLESTEROL");
        var fiber = nutrient(result, "FIBER");
        assertThat(fiber.consumed()).isEqualByComparingTo("4.05");
        assertThat(fiber.status()).isEqualTo(DietCalculationResponse.TotalStatus.PARTIAL);
        assertThat(fiber.foodsWithoutData()).isEqualTo(1);
        assertThat(fiber.inReport()).isFalse();
        assertThat(nutrient(result, "CALCIUM").consumed()).isEqualByComparingTo("17.5");
        assertThat(nutrient(result, "IRON").consumed()).isEqualByComparingTo("1.2");
        assertThat(nutrient(result, "CHOLESTEROL").consumed()).isEqualByComparingTo("80");
        var vitaminC = nutrient(result, "VITAMIN_C");
        assertThat(vitaminC.consumed()).isEqualByComparingTo("0");
        assertThat(vitaminC.foodsWithoutData()).isEqualTo(2);
        assertThat(result.nutrients()).allSatisfy(item -> assertThat(item.reference()).isNull());
        assertThat(result.referenceSource()).isNull();
    }
    @Test void completeWhenEveryPortionHasDataAndNoDataWhenNoneHas() {
        var complete = calculator.calculate(singleMeal(null, List.of(portion(1,"100"), portion(2,"100"))));
        assertThat(nutrient(complete, "FIBER").status()).isEqualTo(DietCalculationResponse.TotalStatus.COMPLETE);
        assertThat(nutrient(complete, "FIBER").foodsWithoutData()).isZero();
        assertThat(nutrient(complete, "VITAMIN_C").status()).isEqualTo(DietCalculationResponse.TotalStatus.PARTIAL);
        var none = calculator.calculate(singleMeal(null, List.of(portion(3,"100"), portion(3,"50"))));
        assertThat(none.nutrients()).allSatisfy(item -> {
            assertThat(item.status()).isEqualTo(DietCalculationResponse.TotalStatus.NO_DATA);
            assertThat(item.consumed()).isNull();
            assertThat(item.foodsWithoutData()).isEqualTo(1);
        });
    }
    @Test void nutrientTotalsRoundOnlyAtTheEnd() {
        // 0.1 g of food 1 has 0.005 mg of calcium: rounding each portion would give 0.03, the exact sum 0.015 gives 0.02.
        var result = calculator.calculate(singleMeal(null, List.of(portion(1,"0.1"), portion(1,"0.1"), portion(1,"0.1"))));
        assertThat(nutrient(result, "CALCIUM").consumed()).isEqualByComparingTo("0.02");
    }
    @Test void emptyDayHasNoNutrients() {
        assertThat(calculator.calculate(new DietCalculationRequest(null, List.of())).nutrients()).isEmpty();
        assertThat(calculator.calculate(singleMeal(null, List.of())).nutrients()).isEmpty();
    }
    @Test void onlyTheFirstOptionCountsForNutrients() {
        var result = calculator.calculate(new DietCalculationRequest(null, List.of(new MealRequest("A", List.of(
                option(portion(1,"100")), option(portion(2,"500"), portion(3,"100")))))));
        assertThat(nutrient(result, "CALCIUM").consumed()).isEqualByComparingTo("5");
        assertThat(nutrient(result, "CALCIUM").status()).isEqualTo(DietCalculationResponse.TotalStatus.COMPLETE);
        assertThat(nutrient(result, "CHOLESTEROL").consumed()).isEqualByComparingTo("0");
    }
    @Test void comparesWithTheReferenceOfTheProfile() {
        var result = calculator.calculate(new DietCalculationRequest(null,
                List.of(meal("A", List.of(portion(1,"150"), portion(2,"100")))), WOMAN_30));
        assertThat(result.referenceSource()).isEqualTo(new DietCalculationResponse.ReferenceSource(
                "Food and Nutrition Board / IOM (DRI)", "Mulher, 19–30 anos"));
        var calcium = nutrient(result, "CALCIUM").reference();
        assertThat(calcium.amount()).isEqualByComparingTo("1000");
        assertThat(calcium.type()).isEqualTo(com.nutritionapp.nutrient.NutrientReferences.Type.RDA);
        assertThat(calcium.percent()).isEqualByComparingTo("1.8");
        assertThat(nutrient(result, "IRON").reference().percent()).isEqualByComparingTo("6.7");
        assertThat(nutrient(result, "FIBER").reference().type()).isEqualTo(com.nutritionapp.nutrient.NutrientReferences.Type.AI);
        assertThat(nutrient(result, "FIBER").reference().percent()).isEqualByComparingTo("16.2");
        assertThat(nutrient(result, "CHOLESTEROL").reference()).isNull();
        var noData = calculator.calculate(new DietCalculationRequest(null, List.of(meal("A", List.of(portion(3,"100")))), WOMAN_30));
        assertThat(nutrient(noData, "CALCIUM").reference().amount()).isEqualByComparingTo("1000");
        assertThat(nutrient(noData, "CALCIUM").reference().percent()).isNull();
    }
    @Test void noReferenceWithoutACoveredProfile() {
        var sex = com.nutritionapp.patient.PatientContext.Sex.class;
        for (var profile : List.of(new DietCalculationRequest.ReferenceProfile(null, 30),
                new DietCalculationRequest.ReferenceProfile(Enum.valueOf(sex, "UNSPECIFIED"), 30),
                new DietCalculationRequest.ReferenceProfile(Enum.valueOf(sex, "MALE"), null),
                new DietCalculationRequest.ReferenceProfile(Enum.valueOf(sex, "MALE"), 18))) {
            var result = calculator.calculate(new DietCalculationRequest(null, List.of(meal("A", List.of(portion(1,"100")))), profile));
            assertThat(result.referenceSource()).isNull();
            assertThat(result.nutrients()).allSatisfy(item -> assertThat(item.reference()).isNull());
        }
    }
    @Test void loadsNutrientsOnlyForCountedFoodsInOneCall() {
        var catalog = org.mockito.Mockito.spy(new DevelopmentFoodCatalog());
        new DietCalculator(catalog, new NutrientReferences()).calculate(new DietCalculationRequest(null, List.of(
                new MealRequest("A", List.of(option(portion(1,"100"), portion(1,"50")), option(portion(3,"10")))),
                meal("B", List.of(portion(2,"100"))))));
        org.mockito.Mockito.verify(catalog).nutrientsOf(new java.util.LinkedHashSet<>(List.of(1L, 2L)));
        org.mockito.Mockito.verify(catalog, org.mockito.Mockito.times(1)).nutrientsOf(org.mockito.ArgumentMatchers.any());
    }
    private static MealRequest meal(String name, List<DietCalculationRequest.FoodPortion> foods) {
        return new MealRequest(name, List.of(new MealRequest.MealOptionRequest(foods)));
    }
    private static MealRequest.MealOptionRequest option(DietCalculationRequest.FoodPortion... foods) {
        return new MealRequest.MealOptionRequest(List.of(foods));
    }
    private static DietCalculationRequest singleMeal(NutrientTargets targets, List<DietCalculationRequest.FoodPortion> foods) {
        return new DietCalculationRequest(targets,List.of(meal("Almoço",foods)));
    }
    private static DietCalculationRequest.FoodPortion portion(long id,String grams) {
        return new DietCalculationRequest.FoodPortion(id,d(grams));
    }
    private static BigDecimal d(String value) { return new BigDecimal(value); }
}
