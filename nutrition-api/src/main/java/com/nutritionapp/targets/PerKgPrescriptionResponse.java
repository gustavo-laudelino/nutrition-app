package com.nutritionapp.targets;

import java.math.BigDecimal;

/** Per-kg result is a direct prescription, not an estimate. */
public record PerKgPrescriptionResponse(BigDecimal prescribedEnergyKcal) {}
