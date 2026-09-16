package com.nutritionapp.energy;

import java.math.BigDecimal;
import com.nutritionapp.patient.PatientContext;
import static com.nutritionapp.patient.PatientContext.DriActivity;

/** DRI 2023 adult EER: activity selects the equation, never a multiplier on BMR. */
final class DriEquation {
    private DriEquation() {}
    static BigDecimal estimate(PatientContext patient, DriActivity activity) {
        String[] coefficients = patient.sex() == PatientContext.Sex.MALE
                ? switch (activity) {
                    case INACTIVE -> new String[]{"753.07", "10.83", "6.50", "14.10"};
                    case LOW_ACTIVE -> new String[]{"581.47", "10.83", "8.30", "14.94"};
                    case ACTIVE -> new String[]{"1004.82", "10.83", "6.52", "15.91"};
                    case VERY_ACTIVE -> new String[]{"-517.88", "10.83", "15.61", "19.11"};
                }
                : switch (activity) {
                    case INACTIVE -> new String[]{"584.90", "7.01", "5.72", "11.71"};
                    case LOW_ACTIVE -> new String[]{"575.77", "7.01", "6.60", "12.14"};
                    case ACTIVE -> new String[]{"710.25", "7.01", "6.54", "12.34"};
                    case VERY_ACTIVE -> new String[]{"511.83", "7.01", "9.07", "12.56"};
                };
        return new BigDecimal(coefficients[0])
                .subtract(new BigDecimal(coefficients[1]).multiply(BigDecimal.valueOf(patient.age())))
                .add(new BigDecimal(coefficients[2]).multiply(patient.heightCm()))
                .add(new BigDecimal(coefficients[3]).multiply(patient.weightKg()));
    }
}
