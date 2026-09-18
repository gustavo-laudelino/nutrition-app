package com.nutritionapp.calculation;

import java.math.BigDecimal;
import java.util.List;
import com.nutritionapp.patient.PatientContext.Sex;
import com.nutritionapp.targets.NutrientTargets;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record DietCalculationRequest(
        @Valid NutrientTargets targets,
        @NotNull @Size(max = 20, message = "Informe no máximo 20 refeições.") List<@NotNull @Valid MealRequest> meals,
        @Valid ReferenceProfile referenceProfile) {
    public DietCalculationRequest(NutrientTargets targets, List<MealRequest> meals) {
        this(targets, meals, null);
    }

    /** Selects the daily nutrient references; incomplete, UNSPECIFIED or under 19 means no reference (not an error). */
    public record ReferenceProfile(
            Sex sex,
            @Min(value = 0, message = "Informe uma idade válida.")
            @Max(value = 130, message = "Informe uma idade de até 130 anos.") Integer age) {}

    public record FoodPortion(
            @NotNull(message = "Informe o alimento.") @Positive(message = "Informe um alimento válido.") Long foodId,
            @NotNull(message = "Informe a quantidade em gramas.")
            @Positive(message = "Informe uma quantidade maior que zero.")
            @Digits(integer = 7, fraction = 3, message = "Use até 7 inteiros e 3 decimais.") BigDecimal quantityG) {}
}
