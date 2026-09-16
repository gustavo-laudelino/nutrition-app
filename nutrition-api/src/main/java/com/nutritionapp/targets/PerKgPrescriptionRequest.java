package com.nutritionapp.targets;

import java.math.BigDecimal;
import jakarta.validation.constraints.*;

public record PerKgPrescriptionRequest(
        @NotNull @Positive @Digits(integer = 4, fraction = 3) BigDecimal weightKg,
        @NotNull @Positive @Digits(integer = 4, fraction = 4) BigDecimal kcalPerKg) {}
