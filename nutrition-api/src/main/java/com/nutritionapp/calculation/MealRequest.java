package com.nutritionapp.calculation;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.nutritionapp.calculation.DietCalculationRequest.FoodPortion;

/** A meal with 1 to 5 menu options; only the first option counts toward the day. */
public record MealRequest(
        @NotBlank(message = "Informe o nome da refeição.")
        @Size(max = 60, message = "O nome deve ter até 60 caracteres.") String name,
        @NotEmpty(message = "Informe ao menos uma opção.")
        @Size(max = 5, message = "Informe no máximo 5 opções por refeição.")
        List<@NotNull(message = "Informe a opção.") @Valid MealOptionRequest> options) {
    public MealRequest {
        if (name != null) name = name.trim();
    }

    public record MealOptionRequest(
            @NotNull(message = "Informe a lista de alimentos.") List<@NotNull @Valid FoodPortion> foods) {}
}
