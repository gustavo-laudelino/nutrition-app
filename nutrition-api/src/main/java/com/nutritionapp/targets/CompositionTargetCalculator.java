package com.nutritionapp.targets;

import com.nutritionapp.shared.InvalidCalculationException;
import org.springframework.stereotype.Service;
import static com.nutritionapp.shared.DecimalPrecision.round;

/**
 * Turns the current composition into targets on an explicit professional action.
 * Percentages are the {@link MacroEnergyShares} (4/4/9 kcal/g). Food-table kcal may differ from 4/4/9,
 * so macro targets derived from these percentages are close to, not always equal to, consumed grams.
 */
@Service
public class CompositionTargetCalculator {
    public CompositionTargetResponse calculate(CompositionTargetRequest request) {
        var energy = round(request.energyKcal());
        if (energy.signum() <= 0)
            throw new InvalidCalculationException("energyKcal", "Adicione alimentos com energia antes de definir a composição como meta.");
        var shares = MacroEnergyShares.of(request.carbohydrateG(), request.proteinG(), request.fatG())
                .orElseThrow(() -> new InvalidCalculationException("macros", "A composição atual não tem macronutrientes para calcular percentuais."));
        return new CompositionTargetResponse(energy, shares.carbohydratePercent(), shares.proteinPercent(), shares.fatPercent());
    }
}
