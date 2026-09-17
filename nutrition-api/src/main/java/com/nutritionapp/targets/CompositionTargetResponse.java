package com.nutritionapp.targets;

import java.math.BigDecimal;

/** Energy target equals consumed energy; macro percentages come from 4/4/9 macro energy and sum to exactly 100. */
public record CompositionTargetResponse(BigDecimal prescribedEnergyKcal,
        BigDecimal carbohydratePercent, BigDecimal proteinPercent, BigDecimal fatPercent) {}
