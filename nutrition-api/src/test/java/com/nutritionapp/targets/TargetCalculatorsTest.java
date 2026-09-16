package com.nutritionapp.targets;

import java.math.BigDecimal;
import com.nutritionapp.patient.PatientContext;
import com.nutritionapp.shared.InvalidCalculationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.assertj.core.api.Assertions.*;
import static com.nutritionapp.targets.TargetCalculationRequest.*;

class TargetCalculatorsTest {
    private final MacroTargetCalculator macros = new MacroTargetCalculator();
    private final TargetCalculator targets = new TargetCalculator(macros);
    private PatientContext patient(int age, PatientContext.Sex sex) {
        return new PatientContext(null,d("80"),null,age,sex,null,null);
    }
    @Test void calculatesPercentageExample() {
        var result = macros.calculate(null,d("2000"),new MacroChoice(MacroMethod.PERCENTAGE,d("50"),d("20"),d("30")));
        assertThat(result.carbohydrate().grams()).isEqualByComparingTo("250");
        assertThat(result.protein().grams()).isEqualByComparingTo("100");
        assertThat(result.fat().grams()).isEqualByComparingTo("66.67");
        assertThat(result.fat().energyKcal()).isEqualByComparingTo("600");
    }
    @ParameterizedTest @CsvSource({"50,25,24.9999", "50,25,25.0001", "-1,51,50", "0,0,0"})
    void rejectsInvalidPercentageSum(String c,String p,String f) {
        assertThatThrownBy(() -> macros.calculate(null,d("2000"),new MacroChoice(MacroMethod.PERCENTAGE,d(c),d(p),d(f))))
                .isInstanceOf(InvalidCalculationException.class);
    }
    @Test void acceptsDecimalAndZeroPercentages() {
        var result = macros.calculate(null,d("2000"),new MacroChoice(MacroMethod.PERCENTAGE,d("33.3333"),d("33.3333"),d("33.3334")));
        assertThat(result.fat().grams()).isEqualByComparingTo("74.07");
        assertThat(macros.calculate(null,d("2000"),new MacroChoice(MacroMethod.PERCENTAGE,d("100"),d("0"),d("0"))).protein().grams()).isEqualByComparingTo("0");
    }
    @Test void percentageNeedsEnergyTarget() {
        assertThatThrownBy(() -> macros.calculate(null,null,new MacroChoice(MacroMethod.PERCENTAGE,d("50"),d("20"),d("30"))))
                .isInstanceOf(InvalidCalculationException.class).hasMessageContaining("meta calórica");
    }
    @Test void manualMacrosCanBePartialAndIndependentOfEnergy() {
        var result = macros.calculate(null,null,new MacroChoice(MacroMethod.MANUAL,null,d("150"),d("70")));
        assertThat(result.carbohydrate()).isNull();
        assertThat(result.protein().grams()).isEqualByComparingTo("150");
        assertThat(result.protein().energyKcal()).isEqualByComparingTo("600");
        assertThat(result.fat().energyKcal()).isEqualByComparingTo("630");
    }
    @Test void perKgMacrosUseWeightAndProvidedFactors() {
        var result = macros.calculate(patient(30,PatientContext.Sex.UNSPECIFIED),null,new MacroChoice(MacroMethod.PER_KG,null,d("1.8"),d("0.8")));
        assertThat(result.carbohydrate()).isNull();
        assertThat(result.protein().grams()).isEqualByComparingTo("144");
        assertThat(result.protein().energyKcal()).isEqualByComparingTo("576");
        assertThat(result.fat().grams()).isEqualByComparingTo("64");
        assertThat(result.fat().energyKcal()).isEqualByComparingTo("576");
    }
    @Test void perKgAllowsPartialTargets() {
        var result = macros.calculate(patient(30,PatientContext.Sex.UNSPECIFIED),null,new MacroChoice(MacroMethod.PER_KG,null,d("1.8"),null));
        assertThat(result.fat()).isNull();
        assertThat(result.protein().grams()).isEqualByComparingTo("144");
    }
    @Test void doesNotInventCarbohydrateFactorOrPatientWeight() {
        assertThatThrownBy(() -> macros.calculate(patient(30,PatientContext.Sex.MALE),null,new MacroChoice(MacroMethod.PER_KG,d("3"),null,null))).isInstanceOf(InvalidCalculationException.class);
        assertThatThrownBy(() -> macros.calculate(null,null,new MacroChoice(MacroMethod.PER_KG,null,d("1.8"),null))).isInstanceOf(InvalidCalculationException.class);
    }
    @Test void estimateAloneNeverBecomesPrescription() {
        var result = targets.calculate(new TargetCalculationRequest(null,null,d("2437"),null));
        assertThat(result.targets().energyKcal()).isNull();
        assertThat(result.prescription().differenceKcal()).isNull();
    }
    @Test void prescriptionAndEstimateHaveIndependentValues() {
        var result = targets.calculate(new TargetCalculationRequest(null,d("2000"),d("2437"),null));
        assertThat(result.targets().energyKcal()).isEqualByComparingTo("2000");
        assertThat(result.prescription().referenceEstimateKcal()).isEqualByComparingTo("2437");
        assertThat(result.prescription().differenceKcal()).isEqualByComparingTo("-437");
    }
    @Test void percentagesUsePrescriptionNotEstimate() {
        var result = targets.calculate(new TargetCalculationRequest(null,d("2000"),d("2437"),
                new MacroChoice(MacroMethod.PERCENTAGE,d("50"),d("20"),d("30"))));
        assertThat(result.targets().proteinG()).isEqualByComparingTo("100");
    }
    @Test void manualPrescriptionNeedsNoEstimate() {
        var result = targets.calculate(new TargetCalculationRequest(null,d("2000"),null,null));
        assertThat(result.prescription().energyKcal()).isEqualByComparingTo("2000");
        assertThat(result.prescription().differenceKcal()).isNull();
    }
    @Test void perKgPrescriptionMultipliesWeightByChosenFactor() {
        var calculator = new PerKgPrescriptionCalculator();
        assertThat(calculator.calculate(new PerKgPrescriptionRequest(d("120"),d("20"))).prescribedEnergyKcal()).isEqualByComparingTo("2400");
        assertThatThrownBy(() -> calculator.calculate(new PerKgPrescriptionRequest(d("0.001"),d("0.0001"))))
                .isInstanceOf(InvalidCalculationException.class);
    }
    @Test void rejectsEmptyAndInactiveMacroValues() {
        assertThatThrownBy(() -> macros.calculate(null,null,new MacroChoice(MacroMethod.NONE,null,d("10"),null))).isInstanceOf(InvalidCalculationException.class);
        assertThatThrownBy(() -> macros.calculate(null,null,new MacroChoice(MacroMethod.MANUAL,null,null,null))).isInstanceOf(InvalidCalculationException.class);
    }
    private static BigDecimal d(String value) { return new BigDecimal(value); }
}
