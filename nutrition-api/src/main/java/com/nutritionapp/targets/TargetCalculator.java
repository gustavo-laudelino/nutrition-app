package com.nutritionapp.targets;

import org.springframework.stereotype.Service;
import static com.nutritionapp.targets.TargetCalculationResponse.*;
import static com.nutritionapp.shared.DecimalPrecision.round;

@Service
public class TargetCalculator {
    private final MacroTargetCalculator macroCalculator;
    public TargetCalculator(MacroTargetCalculator macroCalculator) { this.macroCalculator = macroCalculator; }
    public TargetCalculationResponse calculate(TargetCalculationRequest request) {
        var prescribed = request.prescribedEnergyKcal();
        var reference = request.referenceEstimateKcal();
        var prescription = new Prescription(prescribed, reference,
                prescribed == null || reference == null ? null : round(prescribed.subtract(reference)));
        var macros = macroCalculator.calculate(request.patient(), prescribed, request.macros());
        var targets = new NutrientTargets(prescribed,
                macros.carbohydrate() == null ? null : macros.carbohydrate().grams(),
                macros.protein() == null ? null : macros.protein().grams(),
                macros.fat() == null ? null : macros.fat().grams());
        return new TargetCalculationResponse(prescription, macros, targets);
    }
}
