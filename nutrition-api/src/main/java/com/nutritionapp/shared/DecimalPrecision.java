package com.nutritionapp.shared;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class DecimalPrecision {
    private DecimalPrecision() {}

    public static BigDecimal round(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
