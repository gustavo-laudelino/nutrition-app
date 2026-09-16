package com.nutritionapp.patient;

import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import com.nutritionapp.shared.InvalidCalculationException;

/** Temporary calculation context, not a persistence entity. No universal activity classification. */
public record PatientContext(
        @Size(max = 200) String name,
        @Positive @Digits(integer = 4, fraction = 3) BigDecimal weightKg,
        @Positive @Digits(integer = 3, fraction = 2) BigDecimal heightCm,
        @Min(19) @Max(130) Integer age,
        Sex sex, Goal goal, DriActivity driActivity) {
    public enum Sex { FEMALE, MALE, UNSPECIFIED }
    public enum Goal { WEIGHT_LOSS, MAINTENANCE, WEIGHT_GAIN }
    public enum DriActivity { INACTIVE, LOW_ACTIVE, ACTIVE, VERY_ACTIVE }

    public static BigDecimal requireWeight(PatientContext patient) {
        if (patient == null || patient.weightKg() == null || patient.weightKg().signum() <= 0)
            throw new InvalidCalculationException("patient.weightKg", "Informe um peso positivo em kg.");
        return patient.weightKg();
    }
}
