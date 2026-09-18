package com.nutritionapp.targets;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

/**
 * Share of each macronutrient in the macro energy, using 4/4/9 kcal/g, with 4 decimals summing exactly 100.
 * Food-table kcal may differ from the 4/4/9 sum, so these shares describe macros, not the table energy.
 */
public record MacroEnergyShares(BigDecimal carbohydratePercent, BigDecimal proteinPercent, BigDecimal fatPercent) {
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int PERCENT_SCALE = 4;

    /** Empty when there is no macro energy to divide. */
    public static Optional<MacroEnergyShares> of(BigDecimal carbohydrateG, BigDecimal proteinG, BigDecimal fatG) {
        var carbohydrate = carbohydrateG.multiply(BigDecimal.valueOf(4));
        var protein = proteinG.multiply(BigDecimal.valueOf(4));
        var fat = fatG.multiply(BigDecimal.valueOf(9));
        var macroEnergy = carbohydrate.add(protein).add(fat);
        if (macroEnergy.signum() <= 0) return Optional.empty();

        var percents = new BigDecimal[] {percent(carbohydrate, macroEnergy), percent(protein, macroEnergy), percent(fat, macroEnergy)};
        // Rounding residue (at most a few ten-thousandths) goes to the largest share so the total is exactly 100.
        var residue = HUNDRED.subtract(percents[0].add(percents[1]).add(percents[2]));
        int largest = 0;
        for (int i = 1; i < percents.length; i++) if (percents[i].compareTo(percents[largest]) > 0) largest = i;
        percents[largest] = percents[largest].add(residue);
        return Optional.of(new MacroEnergyShares(percents[0], percents[1], percents[2]));
    }

    private static BigDecimal percent(BigDecimal part, BigDecimal total) {
        return part.multiply(HUNDRED).divide(total, PERCENT_SCALE, RoundingMode.HALF_UP);
    }
}
