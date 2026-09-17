package com.nutritionapp.calculation;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.nutritionapp.calculation.DietCalculationRequest.FoodPortion;

public record MealRequest(
        @NotBlank(message = "Informe o nome da refeição.")
        @Size(max = 60, message = "O nome deve ter até 60 caracteres.") String name,
        @NotNull(message = "Informe a lista de alimentos.") List<@NotNull @Valid FoodPortion> foods) {
    public MealRequest {
        if (name != null) name = name.trim();
    }
}
