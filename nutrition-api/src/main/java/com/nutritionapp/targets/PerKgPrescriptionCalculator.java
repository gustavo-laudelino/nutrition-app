package com.nutritionapp.targets;

import com.nutritionapp.shared.InvalidCalculationException;
import org.springframework.stereotype.Service;
import static com.nutritionapp.shared.DecimalPrecision.round;

@Service
public class PerKgPrescriptionCalculator {
    public PerKgPrescriptionResponse calculate(PerKgPrescriptionRequest request) {
        var prescribed = round(request.weightKg().multiply(request.kcalPerKg()));
        if (prescribed.signum() <= 0)
            throw new InvalidCalculationException("kcalPerKg", "Os valores informados produziram uma meta não positiva; revise peso e fator.");
        return new PerKgPrescriptionResponse(prescribed);
    }
}
