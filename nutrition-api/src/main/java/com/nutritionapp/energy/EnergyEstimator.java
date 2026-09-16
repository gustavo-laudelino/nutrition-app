package com.nutritionapp.energy;

import java.math.BigDecimal;
import com.nutritionapp.patient.PatientContext;
import com.nutritionapp.shared.InvalidCalculationException;
import org.springframework.stereotype.Service;
import static com.nutritionapp.shared.DecimalPrecision.round;
import static com.nutritionapp.energy.EnergyEstimateRequest.Method;
import static com.nutritionapp.energy.EnergyEstimateResponse.FaoActivity;

@Service
public class EnergyEstimator {
    public EnergyEstimateResponse estimate(EnergyEstimateRequest request) {
        var patient = request.patient();
        PatientContext.requireWeight(patient);
        rejectOtherMethodParameters(request);
        BigDecimal estimate;
        BigDecimal basal = null;
        FaoActivity faoActivity = null;
        switch (request.method()) {
            case DRI_2023 -> {
                requireAdult(patient);
                if (patient.heightCm() == null || patient.heightCm().signum() <= 0)
                    throw invalid("patient.heightCm", "DRI exige altura positiva em centímetros.");
                if (patient.driActivity() == null) throw invalid("patient.driActivity", "Escolha uma categoria de atividade DRI.");
                estimate = DriEquation.estimate(patient, patient.driActivity());
            }
            case FAO -> {
                requireAdult(patient);
                var pal = request.faoPal();
                if (pal == null || pal.compareTo(new BigDecimal("1.40")) < 0 || pal.compareTo(new BigDecimal("2.40")) > 0
                        || pal.stripTrailingZeros().scale() > 2)
                    throw invalid("faoPal", "Informe PAL FAO de 1,40 a 2,40 com até duas casas decimais.");
                basal = FaoEquation.basal(patient);
                estimate = basal.multiply(pal); // Multiply before rounding BMR.
                faoActivity = pal.compareTo(new BigDecimal("1.70")) < 0 ? FaoActivity.SEDENTARY_LIGHT
                        : pal.compareTo(new BigDecimal("2.00")) < 0 ? FaoActivity.ACTIVE_MODERATE : FaoActivity.VIGOROUS;
            }
            default -> throw invalid("method", "Escolha um método de estimativa.");
        }
        if (round(estimate).signum() <= 0) throw invalid("patient", "Os dados informados produziram uma estimativa não positiva; revise os dados.");
        return new EnergyEstimateResponse(request.method(), round(estimate), basal == null ? null : round(basal),
                request.method() == Method.DRI_2023 ? patient.driActivity() : null, request.faoPal(), faoActivity);
    }

    private void requireAdult(PatientContext patient) {
        if (patient.age() == null || patient.age() < 19 || patient.age() > 130)
            throw invalid("patient.age", "Este MVP está disponível a partir de 19 anos; limite técnico: 130 anos.");
        if (patient.sex() == null || patient.sex() == PatientContext.Sex.UNSPECIFIED)
            throw invalid("patient.sex", "Informe masculino ou feminino para selecionar a equação.");
    }
    private void rejectOtherMethodParameters(EnergyEstimateRequest request) {
        if (request.method() != Method.FAO && request.faoPal() != null)
            throw invalid("faoPal", "PAL FAO só pode ser usado com FAO.");

    }
    private InvalidCalculationException invalid(String field, String message) { return new InvalidCalculationException(field,message); }
}
