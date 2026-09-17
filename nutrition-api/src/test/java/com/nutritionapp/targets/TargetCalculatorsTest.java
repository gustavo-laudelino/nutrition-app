package com.nutritionapp.targets;

import java.math.BigDecimal;
import com.nutritionapp.shared.InvalidCalculationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.assertj.core.api.Assertions.*;
import static com.nutritionapp.targets.TargetCalculationRequest.*;

class TargetCalculatorsTest {
    private final MacroTargetCalculator macros = new MacroTargetCalculator();
    private final TargetCalculator targets = new TargetCalculator(macros);
    @Test void calculatesPercentageExample() {
        var result = macros.calculate(d("2000"),new MacroChoice(MacroMethod.PERCENTAGE,d("50"),d("20"),d("30")));
        assertThat(result.carbohydrate().grams()).isEqualByComparingTo("250");
        assertThat(result.protein().grams()).isEqualByComparingTo("100");
        assertThat(result.fat().grams()).isEqualByComparingTo("66.67");
        assertThat(result.fat().energyKcal()).isEqualByComparingTo("600");
    }
    @ParameterizedTest @CsvSource({"50,25,24.9999", "50,25,25.0001", "-1,51,50", "0,0,0"})
    void rejectsInvalidPercentageSum(String c,String p,String f) {
        assertThatThrownBy(() -> macros.calculate(d("2000"),new MacroChoice(MacroMethod.PERCENTAGE,d(c),d(p),d(f))))
                .isInstanceOf(InvalidCalculationException.class);
    }
    @Test void acceptsDecimalAndZeroPercentages() {
        var result = macros.calculate(d("2000"),new MacroChoice(MacroMethod.PERCENTAGE,d("33.3333"),d("33.3333"),d("33.3334")));
        assertThat(result.fat().grams()).isEqualByComparingTo("74.07");
        assertThat(macros.calculate(d("2000"),new MacroChoice(MacroMethod.PERCENTAGE,d("100"),d("0"),d("0"))).protein().grams()).isEqualByComparingTo("0");
    }
    @Test void percentageNeedsEnergyTarget() {
        assertThatThrownBy(() -> macros.calculate(null,new MacroChoice(MacroMethod.PERCENTAGE,d("50"),d("20"),d("30"))))
                .isInstanceOf(InvalidCalculationException.class).hasMessageContaining("meta calórica");
    }
    @Test void macrosAreEitherAbsentOrPercentages() {
        assertThat(MacroMethod.values()).containsExactly(MacroMethod.NONE, MacroMethod.PERCENTAGE);
    }
    @Test void estimateAloneNeverBecomesPrescription() {
        var result = targets.calculate(new TargetCalculationRequest(null,d("2437"),null));
        assertThat(result.targets().energyKcal()).isNull();
        assertThat(result.prescription().differenceKcal()).isNull();
    }
    @Test void prescriptionAndEstimateHaveIndependentValues() {
        var result = targets.calculate(new TargetCalculationRequest(d("2000"),d("2437"),null));
        assertThat(result.targets().energyKcal()).isEqualByComparingTo("2000");
        assertThat(result.prescription().referenceEstimateKcal()).isEqualByComparingTo("2437");
        assertThat(result.prescription().differenceKcal()).isEqualByComparingTo("-437");
    }
    @Test void percentagesUsePrescriptionNotEstimate() {
        var result = targets.calculate(new TargetCalculationRequest(d("2000"),d("2437"),
                new MacroChoice(MacroMethod.PERCENTAGE,d("50"),d("20"),d("30"))));
        assertThat(result.targets().proteinG()).isEqualByComparingTo("100");
    }
    @Test void manualPrescriptionNeedsNoEstimate() {
        var result = targets.calculate(new TargetCalculationRequest(d("2000"),null,null));
        assertThat(result.prescription().energyKcal()).isEqualByComparingTo("2000");
        assertThat(result.prescription().differenceKcal()).isNull();
    }
    @Test void perKgPrescriptionMultipliesWeightByChosenFactor() {
        var calculator = new PerKgPrescriptionCalculator();
        assertThat(calculator.calculate(new PerKgPrescriptionRequest(d("120"),d("20"))).prescribedEnergyKcal()).isEqualByComparingTo("2400");
        assertThatThrownBy(() -> calculator.calculate(new PerKgPrescriptionRequest(d("0.001"),d("0.0001"))))
                .isInstanceOf(InvalidCalculationException.class);
    }
    @Test void compositionBecomesEnergyTargetAndMacroPercentagesSummingToHundred() {
        var result = new CompositionTargetCalculator().calculate(new CompositionTargetRequest(d("124"),d("25.8"),d("2.6"),d("1")));
        assertThat(result.prescribedEnergyKcal()).isEqualByComparingTo("124");
        assertThat(result.carbohydratePercent()).isEqualByComparingTo("84.1762");
        assertThat(result.proteinPercent()).isEqualByComparingTo("8.4829");
        assertThat(result.fatPercent()).isEqualByComparingTo("7.3409");
        assertThat(result.carbohydratePercent().add(result.proteinPercent()).add(result.fatPercent())).isEqualByComparingTo("100");
        var targets = macros.calculate(result.prescribedEnergyKcal(), new MacroChoice(MacroMethod.PERCENTAGE,
                result.carbohydratePercent(), result.proteinPercent(), result.fatPercent()));
        assertThat(targets.carbohydrate().grams()).isEqualByComparingTo("26.09");
    }
    @Test void compositionRoundingResidueGoesToLargestShare() {
        var result = new CompositionTargetCalculator().calculate(new CompositionTargetRequest(d("108"),d("9"),d("9"),d("4")));
        assertThat(result.carbohydratePercent()).isEqualByComparingTo("33.3334");
        assertThat(result.proteinPercent()).isEqualByComparingTo("33.3333");
        assertThat(result.fatPercent()).isEqualByComparingTo("33.3333");
    }
    @Test void compositionWithoutEnergyOrMacrosCannotBecomeTarget() {
        var calculator = new CompositionTargetCalculator();
        assertThatThrownBy(() -> calculator.calculate(new CompositionTargetRequest(d("0"),d("0"),d("0"),d("0")))).isInstanceOf(InvalidCalculationException.class);
        assertThatThrownBy(() -> calculator.calculate(new CompositionTargetRequest(d("50"),d("0"),d("0"),d("0")))).isInstanceOf(InvalidCalculationException.class);
    }
    @Test void rejectsValuesWithoutMacroMethod() {
        assertThatThrownBy(() -> macros.calculate(null,new MacroChoice(MacroMethod.NONE,null,d("10"),null))).isInstanceOf(InvalidCalculationException.class);
    }
    private static BigDecimal d(String value) { return new BigDecimal(value); }
}
