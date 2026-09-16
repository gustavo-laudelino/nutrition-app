package com.nutritionapp.energy;

import java.math.BigDecimal;
import com.nutritionapp.patient.PatientContext;
import com.nutritionapp.shared.InvalidCalculationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import static org.assertj.core.api.Assertions.*;
import static com.nutritionapp.energy.EnergyEstimateRequest.*;
import static com.nutritionapp.patient.PatientContext.*;

class EnergyEstimatorTest {
    private final EnergyEstimator estimator = new EnergyEstimator();
    private PatientContext patient(int age, Sex sex) {
        return new PatientContext(null,d("80"),d("175"),age,sex,null,DriActivity.ACTIVE);
    }
    @ParameterizedTest @CsvSource({
        "MALE,INACTIVE,2693.67", "MALE,LOW_ACTIVE,2904.27", "MALE,ACTIVE,3093.72", "MALE,VERY_ACTIVE,3417.77",
        "FEMALE,INACTIVE,2312.40", "FEMALE,LOW_ACTIVE,2491.67", "FEMALE,ACTIVE,2631.65", "FEMALE,VERY_ACTIVE,2893.58"})
    void driUsesEveryAdultSexAndActivityEquation(Sex sex,DriActivity activity,String expected) {
        var result = estimator.estimate(request(patient(30,sex),Method.DRI_2023,activity,null));
        assertThat(result.estimatedKcal()).isEqualByComparingTo(expected);
        assertThat(result.basalKcal()).isNull();
        assertThat(result.faoPal()).isNull();
        assertThat(result.driActivity()).isEqualTo(activity);
    }
    @ParameterizedTest @CsvSource({
        "19,MALE,1896.76,3034.82", "29,MALE,1896.76,3034.82", "30,MALE,1790.86,2865.38", "59,MALE,1790.86,2865.38", "60,MALE,1524.58,2439.33", "61,MALE,1524.58,2439.33",
        "19,FEMALE,1672.04,2675.26", "29,FEMALE,1672.04,2675.26", "30,FEMALE,1495.68,2393.09", "59,FEMALE,1495.68,2393.09", "60,FEMALE,1385.06,2216.10", "61,FEMALE,1385.06,2216.10"})
    void faoComputesBmrThenPalWithNew60PlusBoundary(int age,Sex sex,String basal,String total) {
        var result=estimator.estimate(request(patient(age,sex),Method.FAO,null,d("1.60")));
        assertThat(result.basalKcal()).isEqualByComparingTo(basal);
        assertThat(result.estimatedKcal()).isEqualByComparingTo(total);
        assertThat(result.driActivity()).isNull();
    }
    @ParameterizedTest @CsvSource({"1.40,SEDENTARY_LIGHT","1.69,SEDENTARY_LIGHT","1.70,ACTIVE_MODERATE","1.99,ACTIVE_MODERATE","2.00,VIGOROUS","2.40,VIGOROUS"})
    void faoClassifiesExplicitPalWithoutChoosingIt(String pal,EnergyEstimateResponse.FaoActivity activity) {
        assertThat(estimator.estimate(request(patient(30,Sex.MALE),Method.FAO,null,d(pal))).faoActivity()).isEqualTo(activity);
    }
    @ParameterizedTest @EnumSource(Goal.class)
    void patientObjectiveNeverChangesEstimateOrFactor(Goal goal) {
        var patient=new PatientContext(null,d("80"),d("175"),30,Sex.MALE,goal,DriActivity.ACTIVE);
        assertThat(estimator.estimate(request(patient,Method.DRI_2023,DriActivity.ACTIVE,null)).estimatedKcal()).isEqualByComparingTo("3093.72");
        assertThat(estimator.estimate(request(patient,Method.FAO,null,d("1.60"))).estimatedKcal()).isEqualByComparingTo("2865.38");
    }
    @Test void doesNotMixMethodParameters() {
        for (var activity : DriActivity.values()) {
            var result = estimator.estimate(request(patient(30,Sex.MALE),Method.FAO,activity,d("1.60")));
            assertThat(result.estimatedKcal()).isEqualByComparingTo("2865.38");
            assertThat(result.driActivity()).isNull();
        }
        assertThatThrownBy(()->estimator.estimate(request(patient(30,Sex.MALE),Method.DRI_2023,DriActivity.ACTIVE,d("1.60")))).isInstanceOf(InvalidCalculationException.class);
    }
    @Test void requiresMethodSpecificActivity() {
        assertThatThrownBy(()->estimator.estimate(request(patient(30,Sex.MALE),Method.FAO,null,null))).isInstanceOf(InvalidCalculationException.class);
        assertThatThrownBy(()->estimator.estimate(request(patient(30,Sex.MALE),Method.DRI_2023,null,null))).isInstanceOf(InvalidCalculationException.class);
    }
    @Test void adultEquationsAreNotExtrapolatedToMinors() {
        assertThatThrownBy(()->estimator.estimate(request(patient(18,Sex.MALE),Method.DRI_2023,DriActivity.ACTIVE,null))).isInstanceOf(InvalidCalculationException.class);
        assertThatThrownBy(()->estimator.estimate(request(patient(18,Sex.MALE),Method.FAO,null,d("1.60")))).isInstanceOf(InvalidCalculationException.class);
        assertThat(estimator.estimate(request(patient(19,Sex.MALE),Method.DRI_2023,DriActivity.ACTIVE,null)).estimatedKcal()).isPositive();
    }
    @Test void rejectsMissingSexAndHeight() {
        assertThatThrownBy(()->estimator.estimate(request(patient(30,Sex.UNSPECIFIED),Method.FAO,null,d("1.60")))).isInstanceOf(InvalidCalculationException.class);
        var noHeight=new PatientContext(null,d("80"),null,30,Sex.MALE,null,DriActivity.ACTIVE);
        assertThatThrownBy(()->estimator.estimate(request(noHeight,Method.DRI_2023,DriActivity.ACTIVE,null))).isInstanceOf(InvalidCalculationException.class);
    }
    @ParameterizedTest @ValueSource(strings={"1.39","2.41","1.695"})
    void rejectsOutOfRangeOrExcessivelyPreciseFaoPal(String pal) {
        assertThatThrownBy(()->estimator.estimate(request(patient(30,Sex.MALE),Method.FAO,null,d(pal)))).isInstanceOf(InvalidCalculationException.class);
    }
    @Test void faoMultipliesUnroundedBasal() {
        // 30-year-old male, 80.003 kg: BMR 1790.894416; early rounding would incorrectly give 3026.60.
        var patient=new PatientContext(null,d("80.003"),null,30,Sex.MALE,null,DriActivity.ACTIVE);
        var result=estimator.estimate(request(patient,Method.FAO,null,d("1.69")));
        assertThat(result.basalKcal()).isEqualByComparingTo("1790.89");
        assertThat(result.estimatedKcal()).isEqualByComparingTo("3026.61");
    }
    private EnergyEstimateRequest request(PatientContext p, Method method, DriActivity activity, BigDecimal pal) {
        var profile = new PatientContext(p.name(),p.weightKg(),p.heightCm(),p.age(),p.sex(),p.goal(),activity);
        return new EnergyEstimateRequest(profile,method,pal);
    }
    private static BigDecimal d(String value) { return new BigDecimal(value); }
}

