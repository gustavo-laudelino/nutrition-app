package com.nutritionapp.targets;

import java.math.BigDecimal;
import java.math.RoundingMode;
import com.nutritionapp.shared.InvalidCalculationException;
import org.springframework.stereotype.Service;
import static com.nutritionapp.shared.DecimalPrecision.round;

/**
 * Turns the current composition into targets on an explicit professional action.
 * Percentages use 4/4/9 kcal/g energy per macro. Food-table kcal may differ from 4/4/9,
 * so macro targets derived from these percentages are close to, not always equal to, consumed grams.
 */
@Service
public class CompositionTargetCalculator {
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int PERCENT_SCALE = 4;

    public CompositionTargetResponse calculate(CompositionTargetRequest request) {
        var energy = round(request.energyKcal());
        if (energy.signum() <= 0)
            throw new InvalidCalculationException("energyKcal", "Adicione alimentos com energia antes de definir a composição como meta.");
        var carbohydrate = request.carbohydrateG().multiply(BigDecimal.valueOf(4));
        var protein = request.proteinG().multiply(BigDecimal.valueOf(4));
        var fat = request.fatG().multiply(BigDecimal.valueOf(9));
        var macroEnergy = carbohydrate.add(protein).add(fat);
        if (macroEnergy.signum() <= 0)
            throw new InvalidCalculationException("macros", "A composição atual não tem macronutrientes para calcular percentuais.");

        var percents = new BigDecimal[] {percent(carbohydrate, macroEnergy), percent(protein, macroEnergy), percent(fat, macroEnergy)};
        // Rounding residue (at most a few ten-thousandths) goes to the largest share so the total is exactly 100.
        var residue = HUNDRED.subtract(percents[0].add(percents[1]).add(percents[2]));
        int largest = 0;
        for (int i = 1; i < percents.length; i++) if (percents[i].compareTo(percents[largest]) > 0) largest = i;
        percents[largest] = percents[largest].add(residue);
        return new CompositionTargetResponse(energy, percents[0], percents[1], percents[2]);
    }

    private BigDecimal percent(BigDecimal part, BigDecimal total) {
        return part.multiply(HUNDRED).divide(total, PERCENT_SCALE, RoundingMode.HALF_UP);
    }
}
