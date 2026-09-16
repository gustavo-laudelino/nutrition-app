package com.nutritionapp.energy;

import java.math.BigDecimal;
import com.nutritionapp.patient.PatientContext;

/** Adult BMR only. The estimator applies the explicitly selected PAL afterwards. */
final class FaoEquation {
    private FaoEquation() {}
    static BigDecimal basal(PatientContext patient) {
        // Latest rule is 60+: [19,30), [30,60), [60,130]. Adult PAL is not extrapolated to minors.
        int band = patient.age() < 30 ? 0 : patient.age() < 60 ? 1 : 2;
        String[][] coefficients = patient.sex() == PatientContext.Sex.MALE
                ? new String[][] {{"15.057", "692.2"}, {"11.472", "873.1"}, {"11.711", "587.7"}}
                : new String[][] {{"14.818", "486.6"}, {"8.126", "845.6"}, {"9.082", "658.5"}};
        return patient.weightKg().multiply(new BigDecimal(coefficients[band][0]))
                .add(new BigDecimal(coefficients[band][1]));
    }
}
