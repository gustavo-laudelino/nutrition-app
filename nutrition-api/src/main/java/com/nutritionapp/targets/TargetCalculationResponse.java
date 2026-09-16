package com.nutritionapp.targets;

import java.math.BigDecimal;
import com.nutritionapp.targets.TargetCalculationRequest.MacroMethod;

public record TargetCalculationResponse(Prescription prescription, MacroResult macros, NutrientTargets targets) {
    /** Reference estimate is used only for comparison, never as an implicit prescription. */
    public record Prescription(BigDecimal energyKcal, BigDecimal referenceEstimateKcal, BigDecimal differenceKcal) {}
    public record MacroTarget(BigDecimal grams, BigDecimal energyKcal) {}
    public record MacroResult(MacroMethod method, MacroTarget carbohydrate, MacroTarget protein, MacroTarget fat) {}
}
