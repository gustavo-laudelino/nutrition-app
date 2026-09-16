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
        var result = calculator.calculate(new DietCalculationRequest(null, List.of(portion(1, "150"))));
        assertThat(result.totals().energyKcal().target()).isNull();
        assertThat(result.totals().energyKcal().remaining()).isNull();
        assertThat(result.totals().proteinG().remaining()).isNull();
        assertThat(result.totals().carbohydrateG().remaining()).isNull();
        assertThat(result.totals().fatG().remaining()).isNull();
        var n = result.foods().getFirst().nutrients();
        assertThat(n.energyKcal()).isEqualByComparingTo("195");
        assertThat(n.carbohydrateG()).isEqualByComparingTo("42");
        assertThat(n.proteinG()).isEqualByComparingTo("4.5");
        assertThat(n.fatG()).isEqualByComparingTo("1.5");
    }
    @Test void sumsMultipleFoodsAndComparesOnlyDefinedTargets() {
        var targets = new NutrientTargets(d("2000"), null, d("150"), d("70"));
        var result = calculator.calculate(new DietCalculationRequest(targets, List.of(portion(1,"150"), portion(2,"100"))));
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("360");
        assertThat(result.totals().energyKcal().remaining()).isEqualByComparingTo("1640");
        assertThat(result.totals().proteinG().remaining()).isEqualByComparingTo("114.5");
        assertThat(result.totals().fatG().remaining()).isEqualByComparingTo("64.5");
        assertThat(result.totals().carbohydrateG().remaining()).isNull();
    }
    @Test void preservesNegativeBalancesAndExplicitZeroTargets() {
        var targets = new NutrientTargets(d("2000"), d("0"), null, d("70"));
        var result = calculator.calculate(new DietCalculationRequest(targets, List.of(portion(3,"300"), portion(1,"100"))));
        assertThat(result.totals().energyKcal().remaining()).isEqualByComparingTo("-830");
        assertThat(result.totals().fatG().remaining()).isEqualByComparingTo("-231");
        assertThat(result.totals().carbohydrateG().target()).isEqualByComparingTo("0");
        assertThat(result.totals().carbohydrateG().remaining()).isEqualByComparingTo("-28");
    }
    @Test void sumsBeforeRoundingAndCountsRepeatedFoods() {
        var result = calculator.calculate(new DietCalculationRequest(null, List.of(portion(1,"0.01"), portion(1,"0.01"))));
        assertThat(result.foods()).hasSize(2);
        assertThat(result.foods().getFirst().nutrients().energyKcal()).isEqualByComparingTo("0.01");
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("0.03");
        assertThat(result.totals().carbohydrateG().consumed()).isEqualByComparingTo("0.01");
    }
    @Test void emptyDietHasZeroConsumption() {
        var result = calculator.calculate(new DietCalculationRequest(null,List.of()));
        assertThat(result.foods()).isEmpty();
        assertThat(result.totals().energyKcal().consumed()).isEqualByComparingTo("0");
    }
    @Test void missingFoodIsRejected() {
        assertThatThrownBy(() -> calculator.calculate(new DietCalculationRequest(null,List.of(portion(999,"100")))))
                .isInstanceOf(FoodNotFoundException.class);
    }
    private static DietCalculationRequest.FoodPortion portion(long id,String grams) {
        return new DietCalculationRequest.FoodPortion(id,d(grams));
    }
    private static BigDecimal d(String value) { return new BigDecimal(value); }
}
