package com.nutritionapp.targets;

import java.math.BigDecimal;
import com.nutritionapp.shared.InvalidCalculationException;
import java.math.RoundingMode;
import org.springframework.stereotype.Component;
import static com.nutritionapp.targets.TargetCalculationRequest.*;
import static com.nutritionapp.targets.TargetCalculationResponse.*;
import static com.nutritionapp.shared.DecimalPrecision.round;

@Component
public class MacroTargetCalculator {
    public MacroResult calculate(BigDecimal targetKcal, MacroChoice choice) {
        if (choice == null) choice = new MacroChoice(MacroMethod.NONE, null, null, null);
        var c = choice.carbohydrate(); var p = choice.protein(); var f = choice.fat();
        return switch (choice.method()) {
            case NONE -> {
                if (c != null || p != null || f != null)
                    throw new InvalidCalculationException("macros", "Não envie valores quando o método de macros for nenhum.");
                yield new MacroResult(choice.method(), null, null, null);
            }
            case PERCENTAGE -> {
                if (targetKcal == null) throw new InvalidCalculationException("macros.method", "A distribuição percentual exige uma meta calórica.");
                if (c == null || p == null || f == null || c.signum() < 0 || p.signum() < 0 || f.signum() < 0
                        || c.add(p).add(f).compareTo(new BigDecimal("100")) != 0)
                    throw new InvalidCalculationException("macros", "Os percentuais devem ser não negativos e totalizar exatamente 100%.");
                yield new MacroResult(choice.method(), fromPercent(targetKcal, c, 4), fromPercent(targetKcal, p, 4), fromPercent(targetKcal, f, 9));
            }
        };
    }

    private MacroTarget fromPercent(BigDecimal kcal, BigDecimal percent, int kcalPerGram) {
        var energy = kcal.multiply(percent).movePointLeft(2);
        return new MacroTarget(energy.divide(BigDecimal.valueOf(kcalPerGram), 2, RoundingMode.HALF_UP), round(energy));
    }
}

